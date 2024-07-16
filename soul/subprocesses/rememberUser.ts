import { MentalProcess, useSoulMemory, useActions, ChatMessageRoleEnum, indentNicely, useSoulStore} from "@opensouls/engine";
import { UserMemory, GlobalUserInteractions } from "../util/userMemories.js";
import summarize from "../cognitiveSteps/summarize.js";
import internalMonologue from "../cognitiveSteps/internalMonologue.js";
import userNotes from "../cognitiveSteps/userNotes.js";

const processUserInteractions: MentalProcess = async ({ workingMemory }) => {
  const { log } = useActions();
  const { set, fetch, search } = useSoulStore()
  const globalInteractions = useSoulMemory<GlobalUserInteractions>("globalUserInteractions", {});

  //setting workingMemory here to only contain the core Evo.md prompt
  const coreMemory = workingMemory.withOnlyRegions("core")

  for (const [username, interactionCount] of Object.entries(globalInteractions.current)) {
    // Process when interaction count is greater than 10
    if (interactionCount > 10) {
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
        longTermMemories: "",
      });

        // USER DATA HANDLING LOGIC STARTS HERE

        //Format the recent chat logs into a string
        const formattedChatLogs = userMemory.current.recentChatLogs
        .map(log => {
          const speaker = log.speaker === "user" ? username : "Evo";
          return `${speaker} said: ${log.content}`;
        })
        .join("\n");

      //Formatting all user memories into one variable
      const userInteractionSummary = indentNicely`
        ## INFO ABOUT ${userMemory.current.name}:\n
        - INTERACTION COUNT WITH ${userMemory.current.name}: ${userMemory.current.totalInteractions}\n
        - LAST INTERACTION: ${new Date(userMemory.current.lastInteraction).toLocaleString()}\n
        - NOTES: ${userMemory.current.notes}\n
        - MY FEELINGS TOWARDS THEM: ${userMemory.current.feelings.description}\n
        - LAST CONVO SUMMARY: ${userMemory.current.lastConversationSummary}\n
      `;

      // Adding the chat logs and previous saved memory to a new memory
      const memoryWithChatlog = coreMemory
      .withMemory({ role: ChatMessageRoleEnum.Assistant, content: `## INFORMATION PREVIOUSLY REMEMBERED ABOUT ${username}\n\n"${userInteractionSummary}"` })
      .withMemory({ role: ChatMessageRoleEnum.Assistant, content: `## RECENT CHAT LOGS BETWEEN EVO AND ${username}\n\n"${formattedChatLogs}"` })

      //Summarizing notes only when the first batch are in and saving it to long term memory RAG
      if(userMemory.current.totalInteractions > 11){
        const [, longTermSummary] = await internalMonologue(
          memoryWithChatlog,
          { instructions: `Provide a 1-2 sentence snapshot of your current notes on ${username} based on the following information. Focus on key traits, interests, and the nature of your interactions. Be specific and factual. This is going in your long term memory.`, verb: "summarizes" },
          { model: "fast" }
        );
      
        log("User long-term memory updated:", longTermSummary)

        const timestamp = Date.now();
        const uniqueKey = `${username}-memory-${userMemory.current.totalInteractions}`;
      
        set(uniqueKey, longTermSummary, {
          username: username,
          interactionCount: userMemory.current.totalInteractions,
          lastInteraction: userMemory.current.lastInteraction,
          notes: userMemory.current.notes,
          feelings: userMemory.current.feelings.description,
          lastConversationSummary: userMemory.current.lastConversationSummary,
          rawChatLogs: formattedChatLogs,
          timestamp: timestamp
        });
      }
          
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
          { instructions: `In one sentence, how do you currently feel about ${username}? Why? !! Start your sentence with "I feel X towards ${username} because..."`, verb: "feels" },
          { model: "exp/llama-v3-70b-instruct" }
      );

      log(`Evo's new feelings towards ${username}: `, feelings)

      //Evo taking notes on a user
      const [, updatedNotes] = await userNotes(memoryWithChatlog, `${userMemory.current.notes}\n\nThe user is ${username}`, { model: "exp/llama-v3-70b-instruct" })
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