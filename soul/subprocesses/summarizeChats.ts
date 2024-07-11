import { ChatMessageRoleEnum, MentalProcess, WorkingMemory, createCognitiveStep, indentNicely, stripEntityAndVerb, stripEntityAndVerbFromStream, useActions, useSoulMemory } from "@opensouls/engine";

export const INITIAL_CONVERSATION_SUMMARY = indentNicely`
  Your initial conversation.
`

export const summaryMemory = (content: string) => (
  {
    role: ChatMessageRoleEnum.Assistant,
    content: indentNicely`
      ## CURRENT CONVERSATION DETAILS
      ${content}
    `
  }
)

export const lastConvo = (content: string) => (
  {
    role: ChatMessageRoleEnum.Assistant,
    content: indentNicely`
      ## LAST CONVO BIT
      ${content}
    `
  }
)

const conversationNotes = createCognitiveStep((existing: string) => {
  return {
    command: ({ soulName: name }: WorkingMemory) => {
      return {
        role: ChatMessageRoleEnum.System,
        content: indentNicely`
          ## Existing notes
          ${existing}

          ## Description
          Write an updated and clear paragraph describing the conversation so far.
          Make sure to keep details that ${name} would want to remember.

          ## Rules
          * Keep descriptions as a paragraph
          * Keep relevant information from before
          * Use abbreviated language to keep the notes short
          * Be specific with user names and context
          * Make sure to include important context that keeps the previous conversation flowing.

          Please reply with ONLY raw, updated notes on the conversation:
        `,
      }
    },
  }
})

const internalMonologue = createCognitiveStep((instructions: string | { instructions: string; verb: string }) => {
  let instructionString: string, verb: string;
  if (typeof instructions === "string") {
    instructionString = instructions;
    verb = "thought";
  } else {
    instructionString = instructions.instructions;
    verb = instructions.verb;
  }

  return {
    command: ({ soulName: name }: WorkingMemory) => {
      return {
        role: ChatMessageRoleEnum.System,
        name: name,
        content: indentNicely`
          Model the mind of ${name}.

          ## Description
          ${instructionString}

          ## Rules
          * Internal monologue thoughts should match the speaking style of ${name}.
          * Only respond with the format '${name} ${verb}: "..."', no additional commentary or text.
          * Follow the Description when creating the internal thought!

          Please reply with the next internal monologue thought of ${name}. Use the format: '${name} ${verb}: "..."'
        `
      };
    },
    streamProcessor: stripEntityAndVerbFromStream,
    postProcess: async (memory: WorkingMemory, response: string) => {
      const stripped = stripEntityAndVerb(memory.soulName, verb, response);
      const newMemory = {
        role: ChatMessageRoleEnum.Assistant,
        content: `${memory.soulName} ${verb}: "${stripped}"`
      };
      return [newMemory, stripped];
    }
  }
})

const summarizesConversation: MentalProcess = async ({ workingMemory }) => {
  const conversationModel = useSoulMemory("conversationSummary", INITIAL_CONVERSATION_SUMMARY)

  const { log } = useActions()

  let memory = workingMemory.withOnlyRegions("core", "summary", "chat")

  if (memory.memories.length > 11) {
    log("updating conversation notes");
    [memory, ] = await internalMonologue(memory, { instructions: "What have I learned in this conversation.", verb: "noted" }, {model: "fast"})

    const [, updatedNotes] = await conversationNotes(memory, conversationModel.current,  {model: "exp/llama-v3-70b-instruct"})

    conversationModel.current = updatedNotes as string

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