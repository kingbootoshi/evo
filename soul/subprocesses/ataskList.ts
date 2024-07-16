
import { ChatMessageRoleEnum, MentalProcess, WorkingMemory, createCognitiveStep, indentNicely, stripEntityAndVerb, stripEntityAndVerbFromStream, useActions, useProcessMemory, useSoulMemory, useProcessManager } from "@opensouls/engine";
import internalMonologue from "../cognitiveSteps/internalMonologue.js";
import decision from "../cognitiveSteps/decision.js";

const ataskList: MentalProcess = async ({ workingMemory }) => {
    const { log } = useActions()
    const taskListCount = useSoulMemory("taskListCount", 4)
    const taskList = useSoulMemory("taskList", [] as string[]);

    taskListCount.current += 1

    let memoriesWithChatlogs = workingMemory.withOnlyRegions("core", "chat")

    if (taskListCount.current > 4){
      taskListCount.current = 0
      log("updating tasklist...");

      if(taskList.current.length > 0){
        log("Checking for completed tasks...");
        const updatedTaskList = [];
        for (const task of taskList.current) {
          const [thinkTaskMemory, thinkCompletion] = await internalMonologue(memoriesWithChatlogs, {
              instructions: `Based on the recent chat logs, did I finish this task? TASK: "${task}" IMPORTANT: EXPLICITLY THINK IN FIRST PERSON TO ANALYZE THE CURRENT SCENARIO. START YOUR SENTENCE BY STATING: "I think..." COME TO A DEFENITIVE CONCLUSION. DO NOT WONDER`,
              verb: "thinks"
          }, { model: "exp/llama-v3-70b-instruct" });
          log("Evo thinks about task completion...", thinkCompletion);

          const [decideMemory, taskCompleted] = await decision(thinkTaskMemory, {
              description: indentNicely`
                  Based on your analysis of "I think...", have you completed this task? y/n
              `,
              choices: ["yes", "no"]
          }, { model: "fast" });
          log("Evo decides if task is completed...", taskCompleted);

          if (taskCompleted === "no") {
            const failureReason = `PREVIOUS FAILURE REASON: ${thinkCompletion}`;
            if (task.startsWith("IMPORTANT! FAILED TO COMPLETE TASK LAST CYCLE.")) {
                updatedTaskList.push(`HYPER IMPORTANT, TASK FAILED COMPLETION 2 CYCLES. COMPLETE THIS CHAT CYCLE OR TASK WILL BE DISCARDED - ${task.split('- ')[1]} | ${failureReason}`);
            } else {
                updatedTaskList.push(`IMPORTANT! FAILED TO COMPLETE TASK LAST CYCLE. COMPLETE NOW: - ${task} | ${failureReason}`);
            }
        } else if (task.startsWith("HYPER IMPORTANT, TASK FAILED COMPLETION 2 CYCLES.")) {
            log("Task discarded after failing completion for 2 cycles:", task);
        } else {
            log("Task completed and removed:", task);
        }
      }

      taskList.current = updatedTaskList;
      }

      if (taskList.current.length < 3) {
        const formattedTaskList = taskList.current.length > 0 
          ? `### CURRENT TASK LIST:\n${taskList.current.map((task, index) => `${index + 1}. ${task}`).join('\n')}`
          : "### CURRENT TASK LIST: Empty";

        const [thinkMemory, thinkTask] = await internalMonologue(memoriesWithChatlogs, { 
          instructions: `Based on the recent chatlogs and the current task list, can you identify a NEW and UNIQUE task that hasn't been addressed yet. Consider various aspects of conversation and development. DO NOT suggest tasks similar to those already on the list! ${formattedTaskList} IMPORTANT: Think critically about what's missing from our interaction. START YOUR SENTENCE WITH: "I think..."`, 
          verb: "thinks" 
        }, {model: "exp/llama-v3-70b-instruct"})
        log("Evo thinks to add task...", thinkTask)

        const [taskDecide, taskDecision] = await decision(thinkMemory, {
          description: indentNicely`
          Based on your analysis of "I think...", is this task truly new, unique, and valuable to add to the task list? Consider if it's different from existing tasks and if it will contribute to your growth or the conversation. y/n
          `,
          choices: ["yes", "no"]
        },
        { model: "fast" }
        );
        log("Evo decides to add task...", taskDecision)
        
        if(taskDecision === "yes"){
          const [, taskAddition] = await internalMonologue(thinkMemory, { instructions: `Based on your previous thoughts, create a simple, actionable task that can be completed within the current chat conversation. The task should be specific and immediately executable, such as asking a question, sharing an observation, or making a friendly gesture. Reply with ONLY the task itself! TASK: `, verb: "exp/llama-v3-70b-instruct" }, {model: "fast"})
          log("New task addition:", taskAddition)
          taskList.current.push(taskAddition)
        }
      }
  }

  return workingMemory
}

export default ataskList