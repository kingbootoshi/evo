import { createCognitiveStep, WorkingMemory, ChatMessageRoleEnum, indentNicely, stripEntityAndVerb, stripEntityAndVerbFromStream } from "@opensouls/engine";


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

export default conversationNotes