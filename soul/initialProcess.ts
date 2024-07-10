
import { MentalProcess, useActions, ChatMessageRoleEnum, useSoulMemory, usePerceptions, indentNicely} from "@opensouls/engine";
import externalDialog from "./cognitiveSteps/externalDialog.js";
import { ChatLog, UserMemory, GlobalUserInteractions, safeName } from "./util/userMemories.js";

const core: MentalProcess = async ({ workingMemory }) => {
  const { speak, log } = useActions()
  const { invokingPerception, pendingPerceptions } = usePerceptions()

  const userName = safeName(invokingPerception?.name ?? 'null');

  // Global interaction tracker
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
    longTermMemories: [],
  });

  //Formatting all user memories into one variable
  const userInteractionSummary = indentNicely`
    ## INFO ABOUT ${userMemory.current.name}:\n
    ### LAST INTERACTION: ${new Date(userMemory.current.lastInteraction).toLocaleString()}\n
    ### NOTES: ${userMemory.current.notes}\n
    ### MY FEELINGS TOWARDS THEM: ${userMemory.current.feelings.description}\n
    ### LAST CONVO SUMMARY: ${userMemory.current.lastConversationSummary}\n
    ### RELEVANT LONG TERM MEMORIES: ${JSON.stringify(userMemory.current.longTermMemories, null, 2)}\n
  `;

  //Creating a memory variable for organization
  const userMemories = () => (
    {
      role: ChatMessageRoleEnum.Assistant,
      content: indentNicely`
        ${userInteractionSummary}
      `
    }
  )

  //Adding the unique user memory to the workingMemory
  workingMemory = workingMemory.withRegion("userMemory", userMemories()).withRegionalOrder("core", "userMemory", "summary", "chat", "default")

  //Pushing new user message to the unique chatlog history
  const newUserChat: ChatLog = {
    timestamp: Date.now(),
    speaker: "user",
    content: invokingPerception?.content ?? "null"
  };

  userMemory.current.recentChatLogs.push(newUserChat);

  //Handle AI response to user message
  const [withDialog, stream, resp] = await externalDialog(
    workingMemory,
    "Talk to the user",
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
  
  //Grabs the current chat region from working memory and and adds on top of it
  const chatMemories = workingMemory.withOnlyRegions("chat").withMemory({ role: ChatMessageRoleEnum.Assistant, content: await resp })

  return workingMemory.withRegion("chat", ...chatMemories.memories)
}

export default core