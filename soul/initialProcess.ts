import { MentalProcess, useActions, ChatMessageRoleEnum, useSoulMemory, usePerceptions, indentNicely, useSoulStore} from "@opensouls/engine";
import externalDialog from "./cognitiveSteps/externalDialog.js";
import internalMonologue from "./cognitiveSteps/internalMonologue.js";
import { ChatLog, UserMemory, GlobalUserInteractions, safeName } from "./util/userMemories.js";

const core: MentalProcess = async ({ workingMemory }) => {
  const { speak, log } = useActions();
  const { set, fetch, search } = useSoulStore();
  const lastThought = useSoulMemory("lastThought", "...")
  const lastFeeling = useSoulMemory("lastFeeling", "...")
  const { invokingPerception, pendingPerceptions } = usePerceptions();
  const userName = safeName(invokingPerception?.name ?? 'null');
  const globalInteractions = useSoulMemory<GlobalUserInteractions>("globalUserInteractions", {});
  const taskListCount = useSoulMemory("taskListCount", 4)
  const taskList = useSoulMemory("taskList", [] as string[]);
  const currentSummary = useSoulMemory("conversationSummary", "...")
  const lastSummary = useSoulMemory("lastSummary", "...")

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
  
  // User-specific memory search
  let userSearched = await search(invokingPerception?.content ?? '', { 
    minSimilarity: 0.6,
    filter: { username: userName }
  });

  // General memory search
  let generalSearched = await search(invokingPerception?.content ?? '', { 
    minSimilarity: 0.6
  });
  // Extract and format top 3 results for user-specific memories
  const top3UserResults = userSearched.slice(0, 3).map(formatSearchResult).join('\n');

  // Extract and format top 3 results for general memories
  let top3GeneralResults = generalSearched.slice(0, 2).map(formatSearchResult);

  // Remove duplicates from top3GeneralResults
  top3GeneralResults = top3GeneralResults.filter(result => {
    const resultContent = result.split(' - ')[1]; // Remove the timestamp
    return !currentSummary.current.includes(resultContent) && 
          !lastSummary.current.includes(resultContent);
  });

  // Join the filtered results or set to "N/A" if empty
  const formattedGeneralResults = top3GeneralResults.length > 0 ? top3GeneralResults.join('\n') : "N/A";

  // Set current user memory to the user-specific vector result
  userMemory.current.longTermMemories = top3UserResults;

  // Helper function to format search results
  function formatSearchResult(result: any) {
    const timestamp = result.metadata?.timestamp as number;
    if (timestamp) {
      const date = new Date(timestamp);
      const formattedDate = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().substr(-2)}`;
      return `${formattedDate} - ${result.content}`;
    }
    return `Unknown Date - ${result.content}`;
  }

  //Formatting all user memories into one variable
  const userInteractionSummary = indentNicely`
    - INTERACTION COUNT WITH ${userMemory.current.name}: ${userMemory.current.totalInteractions}\n
    - LAST INTERACTION: ${new Date(userMemory.current.lastInteraction).toLocaleString([], { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' -')}\n
    - NOTES: ${userMemory.current.notes}\n
    - MY CURRENT FEELINGS TOWARDS THEM: ${userMemory.current.feelings.description}\n
    - LAST CONVO SUMMARY: ${userMemory.current.lastConversationSummary}\n
    - RELEVANT LONG TERM MEMORIES:
    ${top3UserResults}
  `;

  // Creating a memory variable for user information
  const userMemories = {
    role: ChatMessageRoleEnum.Assistant,
    content: indentNicely`
      ## INFO ABOUT ${userMemory.current.name}
      ${userInteractionSummary}
    ` 
  };

  // Creating a memory variable for user information
  const generalMemories = {
    role: ChatMessageRoleEnum.Assistant,
    content: indentNicely`
      ## RELEVANT GENERAL MEMORIES
      ${formattedGeneralResults}
    ` 
  };

  // Create a new memory for the tasklist
  const scratchpadMemory = {
    role: ChatMessageRoleEnum.Assistant,
    content: indentNicely`
      ## Evo's previous feeling:
      ${lastFeeling.current}

      ## Evo's previous thought:
      ${lastThought.current}
    
      ## IMPORTANT: TASKLIST (Updates in ${5 - taskListCount.current} turns)\n
      Make sure to complete these tasks!
      ${taskList.current.map((task, index) => `Task ${index + 1} - ${task}`).join('\n')}
    `
  };

  //Adding the unique user memories to the workingMemory
  workingMemory = workingMemory.withRegion("userMemory", userMemories).withRegion("scratchpad", scratchpadMemory).withRegion("generalMemories", generalMemories).withRegionalOrder("core", "userMemory", "generalMemories", "summary", "chat", "scratchpad", "default");

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
    { instructions: "In only !!ONE!! word, describe intuitively how this response makes Evo feel. ", verb: "feels" },
    { model: "exp/llama-v3-70b-instruct", temperature: 0.8 }
  );

  log("Evo feels...", feels)
  lastFeeling.current = feels

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
    `Evo feels ${feels} and thinks: "${thought}". Based on this feeling and thought, Evo will now speak outloud`,
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