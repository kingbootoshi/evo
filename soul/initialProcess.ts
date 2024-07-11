import { MentalProcess, useActions, ChatMessageRoleEnum, useSoulMemory, usePerceptions, indentNicely, useSoulStore} from "@opensouls/engine";
import externalDialog from "./cognitiveSteps/externalDialog.js";
import internalMonologue from "./cognitiveSteps/internalMonologue.js";
import { ChatLog, UserMemory, GlobalUserInteractions, safeName } from "./util/userMemories.js";

const core: MentalProcess = async ({ workingMemory }) => {
  const { speak, log } = useActions();
  const { set, fetch, search } = useSoulStore();
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
  
  // loading in long term memory vector search results for long term memory
  let searched = await search(invokingPerception?.content ?? '', { minSimilarity: 0.6 });

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
  
  log("Top 3 relevant long term memory results:\n", top3Results);

  userMemory.current.longTermMemories = top3Results

  //Formatting all user memories into one variable
  const userInteractionSummary = indentNicely`
    ## INFO ABOUT ${userMemory.current.name}:\n
    - INTERACTION COUNT WITH ${userMemory.current.name}: ${userMemory.current.totalInteractions}\n
    - LAST INTERACTION: ${new Date(userMemory.current.lastInteraction).toLocaleString([], { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' -')}\n
    - NOTES: ${userMemory.current.notes}\n
    - MY CURRENT FEELINGS TOWARDS THEM: ${userMemory.current.feelings.description}\n
    - LAST CONVO SUMMARY: ${userMemory.current.lastConversationSummary}\n
    - RELEVANT LONG TERM MEMORIES:
    ${top3Results}
  `;

  //Creating a memory variable for organization
  const userMemories = () => (
    {
      role: ChatMessageRoleEnum.Assistant,
      content: indentNicely`
        ${userInteractionSummary}
      `
    }
  );

  //Adding the unique user memory to the workingMemory
  workingMemory = workingMemory.withRegion("userMemory", userMemories()).withRegionalOrder("core", "userMemory", "summary", "chat", "default");

  //Pushing new user message to the unique chatlog history
  const newUserChat: ChatLog = {
    timestamp: Date.now(),
    speaker: "user",
    content: invokingPerception?.content ?? "null"
  };

  userMemory.current.recentChatLogs.push(newUserChat);

  //Handle AI response to user message

  //THINK LOGIC
  const [withThoughts, thought] = await internalMonologue(
    workingMemory,
    { instructions: "Formulate a thought before speaking", verb: "thinks" },
    { model: "fast" }
  );

  log("Evo thinks...", thought);

  const [withDialog, stream, resp] = await externalDialog(
    withThoughts,
    "Based on your previous thought, talk to the user",
    { stream: true, model: "gpt-4o" }
  );

  speak(stream);

  //Pushing the AI's response to the unique chatlog history
  const newAIChat: ChatLog = {
    timestamp: Date.now(),
    speaker: "ai",
    content: (await resp).replace(/^Evo said: "(.*)"$/, '$1')
  };

  userMemory.current.recentChatLogs.push(newAIChat);
  userMemory.current.lastInteraction = Date.now();
  
  //Grabs the current chat region from working memory and and adds on top of it
  const chatMemories = workingMemory.withOnlyRegions("chat").withMemory({ role: ChatMessageRoleEnum.Assistant, content: await resp });

  return workingMemory.withRegion("chat", ...chatMemories.memories);
}

export default core