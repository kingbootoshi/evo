import { createCognitiveStep, WorkingMemory, ChatMessageRoleEnum, indentNicely } from "@opensouls/engine";

/**
 * Used by the summarizeAndCompress subprocess to summarize a conversation, and then compress it down
 * to a smaller amount of WorkingMemory memories. 
 */
const userNotes = createCognitiveStep((existing: string) => {
  return {
    command: ({ soulName: name }: WorkingMemory) => {
      return {
        role: ChatMessageRoleEnum.System,
        content: indentNicely`
          ## Existing notes
          ${existing}

          ## Instructions
          Extract bullet point details about the user learned from recent chat logs that should be saved.
          Make sure to keep details that ${name} would want to remember.

          ## Rules
          * Focus on new information about the user
          * Use concise language
          * Include relevant personal details, preferences, or experiences shared by the user
          * Note any significant changes in the user's mood or attitude

          Please reply with ONLY the updated notes about the user, the straight raw bullet points, NOTHING else
        `,
      }
    },
  }
})

export default userNotes
