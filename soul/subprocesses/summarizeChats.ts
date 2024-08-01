import { ChatMessageRoleEnum, MentalProcess, WorkingMemory, useSoulStore, indentNicely, useBlueprintStore, useActions, useSoulMemory } from "@opensouls/engine";
import internalMonologue from "../cognitiveSteps/internalMonologue.js";
import conversationNotes from "../cognitiveSteps/conversationNotes.js";

// Initializing new convo summary
export const INITIAL_CONVERSATION_SUMMARY = indentNicely`
  Talking to users for the first time
`
//Setting a memory template for summary region
export const summaryMemory = (content: string, lastSum: string) => (
  {
    role: ChatMessageRoleEnum.Assistant,
    content: indentNicely`
      ## LAST SUMMARY DETAILS
      ${lastSum}

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
      ## RECENT CHAT LOGS
      ${content}
    `
  }
)

const summarizesConversation: MentalProcess = async ({ workingMemory }) => {
  const currentSummary = useSoulMemory("conversationSummary", INITIAL_CONVERSATION_SUMMARY)
  const lastSummary = useSoulMemory("lastSummary", "...")
  const chatCountRAG = useSoulMemory("chatCountRAG", 0)

  const { log } = useActions()
  const { set, fetch, search } = useSoulStore()
  const { search: blueprintSearch, set: blueprintSet} = useBlueprintStore();

  let memory = workingMemory.withOnlyRegions("core", "summary", "chat")

  if (memory.memories.length > 18) {
    log("updating conversation notes");
    [memory, ] = await internalMonologue(memory, { instructions: "What have I learned in this conversation.", verb: "noted" }, {model: "gpt-4o-mini"})

    const [, summary] = await conversationNotes(memory, currentSummary.current,  {model: "gpt-4o-mini"})

    log("New chat summary!", summary)

    lastSummary.current = currentSummary.current

    currentSummary.current = summary as string

    // Save to long-term memory
    const timestamp = Date.now();
    chatCountRAG.current += 1;
    const uniqueKey = `generalChat_${chatCountRAG.current}`;

    // Get raw chat memories
    const rawChatMemories = workingMemory.withOnlyRegions("chat").memories;

    set(uniqueKey, summary, {
      generalChat: true,
      rawChatLogs: rawChatMemories.map(mem => mem.content).join('\n'),
      timestamp: timestamp
    });

    log("Long-term general chat memory saved!");

    // Get the 4th to last, 3rd to last, and 2nd to last memories, to keep the convo going after summary.
    const relevantMemories = memory.memories.slice(-4, -1);

    // Combine the three memories into one formatted string
    const combinedContent = relevantMemories.map(mem => mem.content).join('\n\n');

    return workingMemory
      .withRegion(
        "summary", 
        summaryMemory(currentSummary.current, lastSummary.current)
      )
      .withRegion("chat", lastConvo(combinedContent))
  }

  return workingMemory
}

export default summarizesConversation