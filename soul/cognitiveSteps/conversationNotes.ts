import { createCognitiveStep, WorkingMemory, ChatMessageRoleEnum, indentNicely, stripEntityAndVerb, stripEntityAndVerbFromStream } from "@opensouls/engine";


const conversationNotes = createCognitiveStep((existing: string) => {
  return {
    command: ({ soulName: name }: WorkingMemory) => {
      return {
        role: ChatMessageRoleEnum.System,
        content: indentNicely`
          ## LAST SUMMARY
          ${existing}

          ## Description
          Write a clear 2-4 sentence paragraph describing the conversation so far.
          Make sure to keep details that ${name} would want to remember.

          ## Rules
          * Keep descriptions as a paragraph
          * Start by trailing relevant information from the last summary
          * Use abbreviated language to keep the notes short
          * Be specific with user names and context

          Please reply with ONLY the raw summary:
        `,
      }
    },
  }
})

export default conversationNotes