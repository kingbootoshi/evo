import { MentalProcess, useActions, ChatMessageRoleEnum, useSoulMemory, usePerceptions, indentNicely, useSoulStore} from "@opensouls/engine";
import externalDialog from "./cognitiveSteps/externalDialog.js";
import internalMonologue from "./cognitiveSteps/internalMonologue.js";
import { ChatLog, UserMemory, GlobalUserInteractions, safeName } from "./util/userMemories.js";

const core: MentalProcess = async ({ workingMemory }) => {
  const { speak, log } = useActions();
  const { set, fetch, search } = useSoulStore();
  const scratchPadCount = useSoulMemory("scratchPadCount", 5)
  const currentScratchPadNotes = useSoulMemory("currentScratchPadNotes", "...")
  const lastThought = useSoulMemory("lastThought", "...")
  const { invokingPerception, pendingPerceptions } = usePerceptions();
  const userName = safeName(invokingPerception?.name ?? 'null');
  const globalInteractions = useSoulMemory<GlobalUserInteractions>("globalUserInteractions", {});

  // Increment interaction count for the current user
  if (userName !== 'null') {
    globalInteractions.current[userName] = (globalInteractions.current[userName] || 0) + 1;
  }

  log(`Temp interaction count with ${userName}:`, globalInteractions.current);

  //Setting interchangable memory unique to each user
  const userMemory = useSoulMemory<UserMemory>(userName, {
    name: userName,
    recentChatLogs: [],
    lastInteraction: Date.now(),
    totalInteractions: 0,
    notes: "",
    feelings: {
      description: "Neutral",
    },
    lastConversationSummary: `${userName} & Evo just started talking for the first time`,
    longTermMemories: "",
  });

  //Adding to the total interaction count
  userMemory.current.totalInteractions += 1;
  
  // Loading in long term memory vector search results for long term memory
  let searched = await search(invokingPerception?.content ?? '', { 
    minSimilarity: 0.6,
    filter: { username: userName }
  });

  // Extract top 3 results, format them, and log the formatted content. Saving it to userMemory so rememberUser.ts doesn't have to vector search again
  const top3Results = searched.slice(0, 3).map(result => {
    const timestamp = result.metadata?.timestamp as number;
    if (timestamp) {
      const date = new Date(timestamp);
      const formattedDate = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().substr(-2)}`;
      return `${formattedDate} - ${result.content}`;
    }
    return `Unknown Date - ${result.content}`;
  }).join('\n');

  //Set current user memory to the vector result
  userMemory.current.longTermMemories = top3Results

  //Formatting all user memories into one variable
  const userInteractionSummary = indentNicely`
    - INTERACTION COUNT WITH ${userMemory.current.name}: ${userMemory.current.totalInteractions}\n
    - LAST INTERACTION: ${new Date(userMemory.current.lastInteraction).toLocaleString([], { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' -')}\n
    - NOTES: ${userMemory.current.notes}\n
    - MY CURRENT FEELINGS TOWARDS THEM: ${userMemory.current.feelings.description}\n
    - LAST CONVO SUMMARY: ${userMemory.current.lastConversationSummary}\n
    - RELEVANT LONG TERM MEMORIES:
    ${top3Results}
  `;

  // Creating a memory variable for user information
  const userMemories = {
    role: ChatMessageRoleEnum.Assistant,
    content: indentNicely`
      ## INFO ABOUT ${userMemory.current.name}
      ${userInteractionSummary}
    `
  };

  // Create a new memory for the scratchpad
  const scratchpadMemory = {
    role: ChatMessageRoleEnum.Assistant,
    content: indentNicely`
      ## SCRATCHPAD NOTES (Updates in ${5 - scratchPadCount.current} turns)
      ${currentScratchPadNotes.current}

      ## Evo's previous thought:
      ${lastThought.current}
    `
  };

  //Adding the unique user memories to the workingMemory
  workingMemory = workingMemory.withRegion("userMemory", userMemories).withRegion("scratchpad", scratchpadMemory).withRegionalOrder("core", "scratchpad", "userMemory", "summary", "chat", "default");

  //Pushing new user message to the unique chatlog history
  const newUserChat: ChatLog = {
    timestamp: Date.now(),
    speaker: "user",
    content: invokingPerception?.content ?? "null"
  };

  userMemory.current.recentChatLogs.push(newUserChat);

  //Handle AI response to user message

  //FEELS LOGIC
  const [withFeels, feels] = await internalMonologue(
    workingMemory,
    { instructions: "In one word, describe intuitively how this response makes you feel", verb: "feels" },
    { model: "exp/llama-v3-70b-instruct", temperature: 0.9 }
  );

  log("Evo feels...", feels)

  //THINK LOGIC
  const [withThoughts, thought] = await internalMonologue(
    workingMemory,
    { instructions: `Evo feels ${feels}. Now, formulate a thought before speaking`, verb: "thinks" },
    { model: "exp/llama-v3-70b-instruct", temperature: 0.9 }
  );

  log("Evo thinks...", thought);
  lastThought.current = thought

  const [withDialog, stream] = await externalDialog(
    workingMemory,
    `I feel ${feels} and I just thought: "${thought}". Based on this feeling and thought, I will now speak outloud`,
    { model: "exp/llama-v3-70b-instruct", temperature: 0.9 }
  );

  speak(stream.replace(/^Evo said: "(.*)"$/, '$1').replace(/^"/, '').replace(/"$/, ''));

  //Pushing the AI's response to the unique chatlog history
  const newAIChat: ChatLog = {
    timestamp: Date.now(),
    speaker: "ai",
    content: (stream).replace(/^Evo said: "(.*)"$/, '$1')
  };

  userMemory.current.recentChatLogs.push(newAIChat);
  userMemory.current.lastInteraction = Date.now();
  
  //Grabs the current chat region from working memory and and adds on top of it
  const chatMemories = workingMemory.withOnlyRegions("chat").withMemory({ role: ChatMessageRoleEnum.Assistant, content: stream });

  return workingMemory.withRegion("chat", ...chatMemories.memories);
}

export default core