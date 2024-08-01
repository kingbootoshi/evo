import { MentalProcess, useActions, ChatMessageRoleEnum, useSoulMemory, usePerceptions, indentNicely, useSoulStore, useBlueprintStore} from "@opensouls/engine";
import externalDialog from "./cognitiveSteps/externalDialog.js";
import internalMonologue from "./cognitiveSteps/internalMonologue.js";
import { ChatLog, UserMemory, GlobalUserInteractions, safeName } from "./lib/utils/userMemories.js";
import { Task } from "./lib/utils/userMemories.js";
import { formatTaskList } from "./lib/utils/format.js";
import { formatSearchResult, formatTaskListMetadata } from "./lib/utils/format.js";

const core: MentalProcess = async ({ workingMemory }) => {
  const { speak, log, dispatch } = useActions();
  const { set, fetch, search } = useSoulStore();
  const { search: blueprintSearch, set: blueprintSet} = useBlueprintStore();
  const lastThought = useSoulMemory("lastThought", "...")
  const lastFeeling = useSoulMemory("lastFeeling", "...")
  const { invokingPerception, pendingPerceptions } = usePerceptions();
  const userName = safeName(invokingPerception?.name ?? 'null');
  const globalInteractions = useSoulMemory<GlobalUserInteractions>("globalUserInteractions", {});
  const taskListCount = useSoulMemory("taskListCount", 4)
  const taskList = useSoulMemory<Task[]>("taskList", []);
  const currentSummary = useSoulMemory("conversationSummary", "...")
  const lastSummary = useSoulMemory("lastSummary", "...")
  log("Incoming metadata...", invokingPerception)
  log("Tasklist", taskList.current)

  // Extract clientuserid from invokingPerception metadata
  const clientUserId = invokingPerception?._metadata?.clientuserid;
  
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
    minSimilarity: 0.6,
    filter: { type: { $ne: 'task' } }
  });
  
  // Extract and format top 3 results for user-specific memories
  const top3UserResults = userSearched.slice(0, 3).map(formatSearchResult).join('\n');

  // Extract and format top 2 results for general memories
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

  const formattedTaskList = formatTaskList(taskList.current)

  // Create a new memory for the tasklist
  const scratchpadMemory = {
    role: ChatMessageRoleEnum.Assistant,
    content: indentNicely`
      # IMPORTANT: EVO TASKS (Updates in ${4 - taskListCount.current} turns)
     ** CRITICAL: Make sure to complete these tasks! **
      
      ${formattedTaskList}
    `
  };

  //Adding the unique user memories to the workingMemory
  workingMemory = workingMemory.withRegion("userMemory", userMemories).withRegion("scratchpad", scratchpadMemory).withRegion("generalMemories", generalMemories).withRegionalOrder("core", "scratchpad", "userMemory", "generalMemories", "summary", "chat", "default");

  //Pushing new user message to the unique chatlog history
  const newUserChat: ChatLog = {
    timestamp: Date.now(),
    speaker: "user",
    content: invokingPerception?.content ?? "null"
  };

  userMemory.current.recentChatLogs.push(newUserChat);

  // Handle AI response to user message

    //FEELS LOGIC
    const [withFeels, feels] = await internalMonologue(
      workingMemory,
      { instructions: "CRITICAL: ONLY GIVE ONE WORD, THE FEELING In only !!ONE!! word, describe intuitively how this response makes Evo feel", verb: "feels" },
      { model: "exp/llama-v3p1-8b-instruct", temperature: 1 }
    );

    log("Evo feels...", feels)
    lastFeeling.current = feels

    //THINK LOGIC
    const [withThoughts, thought] = await internalMonologue(
      workingMemory,
      { instructions: `Evo feels ${feels}. Now, Evo internally thinks`, verb: "thinks" },
      { model: "exp/llama-v3p1-70b-instruct", temperature: .9}
    );

    log("Evo thinks...", thought);
    lastThought.current = thought

  const [withDialog, stream] = await externalDialog(
    workingMemory,
    `Evo feels ${feels} & thought "${thought}". The user cannot see these thoughts. Now, speak out loud`,
    { model: "exp/llama-v3p1-70b-instruct", temperature: .9 }
  );

  // Helper function to clean the AI response
  const cleanAIResponse = (response: string): string => {
    // Remove 'Evo said: ' prefix if present
    let cleaned = response.replace(/^Evo said:\s*/, '');
    // Remove surrounding quotes if present
    cleaned = cleaned.replace(/^"(.+?)"?$/, '$1');
    // Trim any remaining whitespace
    return cleaned.trim();
  };

  const cleanedStream = cleanAIResponse(stream);

  dispatch({
    action: "says",
    content: cleanedStream,
    _metadata: {
      ...(clientUserId && { clientuserid: clientUserId }), // Include clientuserid if it exists
      feels: feels,
      thoughts: thought,
      tasklist: formatTaskListMetadata(taskList.current),
      feelingsTowardsUser: userMemory.current.feelings.description,
      notesOnUser: userMemory.current.notes,
      interactionCount: userMemory.current.totalInteractions
    },
  });

  // Pushing the AI's response to the unique chatlog history
  const newAIChat: ChatLog = {
    timestamp: Date.now(),
    speaker: "ai",
    content: cleanedStream
  };

  userMemory.current.recentChatLogs.push(newAIChat);
  userMemory.current.lastInteraction = Date.now();
  
  //Grabs the current chat region from working memory and and adds on top of it
  const chatMemories = workingMemory.withOnlyRegions("chat").withMemory({ role: ChatMessageRoleEnum.Assistant, content: stream });

  return workingMemory.withRegion("chat", ...chatMemories.memories);
}

export default core