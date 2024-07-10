import { MentalProcess, useSoulMemory, useActions, ChatMessageRoleEnum, indentNicely} from "@opensouls/engine";
import { UserMemory, GlobalUserInteractions } from "../util/userMemories.js";
import summarize from "../cognitiveSteps/summarize.js";
import internalMonologue from "../cognitiveSteps/internalMonologue.js";
import conversationNotes from "../cognitiveSteps/conversationNotes.js";

const processUserInteractions: MentalProcess = async ({ workingMemory }) => {
  const { log } = useActions();
  const globalInteractions = useSoulMemory<GlobalUserInteractions>("globalUserInteractions", {});

  //setting workingMemory here to only contain the core Evo.md prompt
  const coreMemory = workingMemory.withOnlyRegions("core")

  for (const [username, interactionCount] of Object.entries(globalInteractions.current)) {
    if (interactionCount > 10) { // Process when interaction count is greater than 10
    log(`Processing user interactions for ${username}`)
      const userMemory = useSoulMemory<UserMemory>(username, {
        name: username,
        recentChatLogs: [],
        lastInteraction: Date.now(),
        totalInteractions: 0,
        notes: "No notes yet",
        feelings: {
          description: "Neutral",
        },
        lastConversationSummary: `${username} & Evo just started talking for the first time`,
        longTermMemories: [],
      });

      // USER DATA HANDLING LOGIC STARTS HERE

      //Format the recent chat logs into a string
      const formattedChatLogs = userMemory.current.recentChatLogs
      .map(log => {
        const speaker = log.speaker === "user" ? username : "Evo";
        return `${speaker} said: ${log.content}`;
      })
      .join("\n");

      //Formatting information about the user into memory
      const userInteractionSummary = indentNicely`
      Information about ${userMemory.current.name}:
      Last interaction: ${new Date(userMemory.current.lastInteraction).toLocaleString()}
      Notes on user: ${userMemory.current.notes}
      My feelings towards them: ${userMemory.current.feelings.description}
      Last conversation summary: ${userMemory.current.lastConversationSummary}
      Relevant long term memories: ${JSON.stringify(userMemory.current.longTermMemories, null, 2)}
    `;

    // Adding the chat logs and previous saved memory to a new memory
    const memoryWithChatlog = coreMemory
    .withMemory({ role: ChatMessageRoleEnum.Assistant, content: `## RECENT CHAT LOGS BETWEEN EVO AND ${username}\n\n"${formattedChatLogs}"` })
    .withMemory({ role: ChatMessageRoleEnum.Assistant, content: `## INFORMATION PREVIOUSLY REMEMBERED ABOUT ${username}\n\n"${userInteractionSummary}"` })

    //Summarize the short term chatlogs
    const [, summary] = await summarize(
        memoryWithChatlog,
        `Summarize the following chatlogs between ${username} & Evo in a couple concise sentences. Keep ALL important details`,
        { model: "exp/llama-v3-70b-instruct" }
    );

    log(`Summarized chatlogs with ${username}: `, summary)

    //Asking how Evo now feels about a user
    const [, feelings] = await internalMonologue(
        memoryWithChatlog,
        { instructions: `In one sentence, how do you currently feel about the user? Why? !! Start your sentence with "I feel X towards ${username} because..."`, verb: "feels" },
        { model: "exp/llama-v3-70b-instruct" }
    );

    log(`Evo's new feelings towards ${username}: `, feelings)

    //Evo taking notes on a user
    const [, updatedNotes] = await conversationNotes(memoryWithChatlog, userMemory.current.notes, { model: "exp/llama-v3-70b-instruct" })
    log(`Evo's new notes about ${username}`, updatedNotes)

    userMemory.current.lastConversationSummary = summary
    userMemory.current.recentChatLogs = []
    userMemory.current.feelings.description = feelings
    userMemory.current.notes = updatedNotes
    globalInteractions.current[username] = 0;

    }
  }

  return workingMemory;
};

export default processUserInteractions;