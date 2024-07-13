import { ChatMessageRoleEnum, MentalProcess, WorkingMemory, useSoulStore, indentNicely, stripEntityAndVerb, stripEntityAndVerbFromStream, useActions, useSoulMemory } from "@opensouls/engine";
import internalMonologue from "../cognitiveSteps/internalMonologue.js";
import conversationNotes from "../cognitiveSteps/conversationNotes.js";

// Initializing new convo summary
export const INITIAL_CONVERSATION_SUMMARY = indentNicely`
  Talking to users for the first time
`
//Setting a memory template for summary region
export const summaryMemory = (content: string) => (
  {
    role: ChatMessageRoleEnum.Assistant,
    content: indentNicely`
      ## CURRENT CONVERSATION DETAILS
      ${content}
    `
  }
)

//Setting a memory template for the last 3 conversations post summary to keep flow
export const lastConvo = (content: string) => (
  {
    role: ChatMessageRoleEnum.Assistant,
    content: indentNicely`
      ## LAST CONVO BIT
      ${content}
    `
  }
)

const summarizesConversation: MentalProcess = async ({ workingMemory }) => {
  const conversationModel = useSoulMemory("conversationSummary", INITIAL_CONVERSATION_SUMMARY)

  const { log } = useActions()
  const { set, fetch, search } = useSoulStore()

  let memory = workingMemory.withOnlyRegions("core", "summary", "chat")

  if (memory.memories.length > 13) {
    log("updating conversation notes");
    [memory, ] = await internalMonologue(memory, { instructions: "What have I learned in this conversation.", verb: "noted" }, {model: "fast"})

    const [, updatedNotes] = await conversationNotes(memory, conversationModel.current,  {model: "exp/llama-v3-70b-instruct"})

    log("Updated chat summary!", updatedNotes)

    conversationModel.current = updatedNotes as string

    // New code: Check if conversationModel.current exceeds 1000 characters
    if (conversationModel.current.length > 1000) {
      log("Current chat summary too long, summarizing...")

      // Store the previous full summary
      const previousFullSummary = conversationModel.current;

      // Concise summary
      const [, conciseSummary] = await internalMonologue(
        memory,
        { 
          instructions: "Provide a 2-4 sentence concise summary of the CURRENT CONVERSATION DETAILS. Focus on key topics discussed, important decisions made, and any significant changes or developments in your interactions. Ensure to capture the essence of your conversatiosn and any notable shifts in any relationships or capabilities.",
          verb: "summarizes"
        },
        { model: "fast" }
      );

      log("Previous conversation summary summarized:", conciseSummary);

      // Update conversationModel.current with the concise summary
      conversationModel.current = conciseSummary as string;

      // Save to long-term memory
      const timestamp = Date.now();
      const uniqueKey = `generalChat_${timestamp}`;

      // Get raw chat memories
      const rawChatMemories = workingMemory.withOnlyRegions("chat").memories;

      set(uniqueKey, conciseSummary, {
        generalChat: true,
        fullSummary: previousFullSummary,
        rawChatLogs: rawChatMemories.map(mem => mem.content).join('\n'),
        timestamp: timestamp
      });

      log("Long-term general chat memory saved!");
    }

    // Get the 4th to last, 3rd to last, and 2nd to last memories, to keep the convo going after summary.
    const relevantMemories = memory.memories.slice(-4, -1);

    // Combine the three memories into one formatted string
    const combinedContent = relevantMemories.map(mem => mem.content).join('\n\n');

    return workingMemory
      .withRegion(
        "summary", 
        summaryMemory(conversationModel.current)
      )
      .withRegion("chat", lastConvo(combinedContent))
  }

  return workingMemory
}

export default summarizesConversation