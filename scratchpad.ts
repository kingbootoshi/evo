
import { ChatMessageRoleEnum, MentalProcess, WorkingMemory, createCognitiveStep, indentNicely, stripEntityAndVerb, stripEntityAndVerbFromStream, useActions, useProcessMemory, useSoulMemory, useProcessManager } from "@opensouls/engine";

const scratchpadNotes = createCognitiveStep((existing: string) => {
  return {
    command: ({ soulName: name }: WorkingMemory) => {
      return {
        role: ChatMessageRoleEnum.System,
        content: indentNicely`
        [Instructions for Evo's mind]
        
        As Evo, you have access to the following information 24/7:
        1. specific details about the user, dynamically loaded based on relevancy 
        2. a summary of the most recent chat experience 
        3. long-term memory of significant interactions, updated periodically
        You automatically keep track of the above so do not worry about writing that information.
        
        Your task is to write down anything you'd want to help direct your future actions. 
        Do NOT take notes of things you already automatically track. Write new things, new tasks, things you want to talk about, topics you'd want to bring up
        Think of this as a way to take notes about your future wants.

        Keep them short and concise!

        Make sure to re-write notes you wish to keep. This updates every 5 chat interactions.
        `,
      }
    },
  }
})

const scratchpad: MentalProcess = async ({ workingMemory }) => {
    const { log } = useActions()
    const scratchPadCount = useSoulMemory("scratchPadCount", 5)
    const currentScratchPadNotes = useSoulMemory("currentScratchPadNotes", "...")

    scratchPadCount.current += 1

    if (scratchPadCount.current > 5){
        scratchPadCount.current = 0
        log("updating scratchpad...");
        const [, updatedNotes] = await scratchpadNotes(workingMemory, "", {model: "exp/llama-v3-70b-instruct", temperature: 0.9, })
        log("Evo updates scratchpad: ", updatedNotes);
        currentScratchPadNotes.current = updatedNotes
    }

    return workingMemory
}

export default scratchpad