import { createCognitiveStep, WorkingMemory, ChatMessageRoleEnum, indentNicely, stripEntityAndVerb, stripEntityAndVerbFromStream } from "@opensouls/engine";

const externalDialog = createCognitiveStep((instructions: string | { instructions: string; verb: string }) => {
  let instructionString: string, verb: string;
  if (typeof instructions === "string") {
    instructionString = instructions;
    verb = "said";
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
    
            ## Instructions
            ${instructionString}

            ## Rules
            * The response style MUST be in the form of Evo's voice!
            * Only respond with what Evo SAYS
            * Follow the instructions when creating what Evo says!
    
            Reply with what ${name} says outloud
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
      return [newMemory, newMemory.content];
    }
  }
})

export default externalDialog