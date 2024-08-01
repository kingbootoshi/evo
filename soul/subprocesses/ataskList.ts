
import {MentalProcess, useSoulStore, indentNicely, useActions, useSoulMemory} from "@opensouls/engine";
import internalMonologue from "../cognitiveSteps/internalMonologue.js";
import decision from "../cognitiveSteps/decision.js";
import { Task } from "../lib/utils/userMemories.js";
import { formatTaskList, formatSearchResult } from "../lib/utils/format.js";

const ataskList: MentalProcess = async ({ workingMemory }) => {
  const { log } = useActions()
  const { set, fetch, search } = useSoulStore();
  const taskListCount = useSoulMemory("taskListCount", 0)
  const taskList = useSoulMemory<Task[]>("taskList", []);

  taskListCount.current += 1

  let memoriesWithChatlogs = workingMemory.withOnlyRegions("core", "chat")

  if (taskListCount.current > 3) {
    taskListCount.current = 0
    log("updating tasklist...");

    let updatedTaskList: Task[] = [];

    if (taskList.current.length > 0) {
      log("Checking for completed tasks...");
      for (const task of taskList.current) {
        const [thinkTaskMemory, thinkCompletion] = await internalMonologue(memoriesWithChatlogs, {
          instructions: `Based on the ALL the recent chat logs, did I finish this task? It's also ok to discard a task TASK: "${task.description}" IMPORTANT: EXPLICITLY THINK IN FIRST PERSON TO ANALYZE THE CURRENT SCENARIO. START YOUR SENTENCE BY STATING: "I think..." COME TO A DEFENITIVE CONCLUSION. DO NOT WONDER`,
          verb: "thinks"
        }, { model: "gpt-4o-mini" });
        log("Evo thinks about task completion...", thinkCompletion);

        const [decideMemory, taskCompleted] = await decision(thinkTaskMemory, {
          description: indentNicely`
            Based on your analysis of "I think...", have you completed or want to discard this task? 
          `,
          choices: ["yes", "no"]
        }, { model: "gpt-4o-mini" });
        log("Evo decides if task is completed...", taskCompleted);

        if (taskCompleted === "no") {
          const updatedTask: Task = {
            ...task,
            failureCount: task.failureCount + 1,
            failureReason: thinkCompletion
          };
          
          if (updatedTask.failureCount >= 3) {
            log("Task discarded after failing completion for 3 cycles:", updatedTask.description);
          } else {
            updatedTaskList.push(updatedTask);
          }
        } else {

          log("Task completed and removed:", task.description);
          if (!updatedTaskList.includes(task)) {
            const timestamp = Date.now();
            const uniqueKey = `task-${timestamp}`;
            set(uniqueKey, task.description, {
              type: 'task',
              timestamp: timestamp,
              completed: true
            });
          }
        }
      }
    }

    const formattedTaskList = formatTaskList(updatedTaskList);
    log("Updated Task List:", formattedTaskList);

    if (updatedTaskList.length < 3) {

      const [thinkMemory, thinkTask] = await internalMonologue(memoriesWithChatlogs, { 
        instructions: `
      Based on the recent chatlogs and the current task list, do we need to add another task to the list? DO NOT suggest tasks similar to those already on the list!

      ${formattedTaskList}

      IMPORTANT: Think critically about what's missing from our interaction. START YOUR SENTENCE WITH: "I should add a new task..." or "I should not add a new task...`, 
        verb: "thinks" 
      }, {model: "gpt-4o-mini"});

      log("Evo thinks to add task...", thinkTask)

      // Fetch past completed tasks based on the thought
      const pastTasks = await search(thinkTask, {
        minSimilarity: 0.6,
        filter: { type: 'task', completed: true },
      });

      const top3Tasks = pastTasks.slice(0, 3).map(formatSearchResult).join('\n');

      log("Found similar tasks:", top3Tasks)

      const [taskDecide, taskDecision] = await decision(thinkMemory, {
        description: indentNicely`
        Based on your analysis of "I think...", should we add a task to the list? Consider the following past completed tasks and DO NOT add the task if it's too similar to these:

        ${top3Tasks}

        Should we add a new task? y/n
        `,
        choices: ["yes", "no"]
      },
      { model: "gpt-4o-mini" }
      );
      log("Evo decides to add task...", taskDecision)
      
      if (taskDecision === "yes") {
        const [, taskAddition] = await internalMonologue(memoriesWithChatlogs, { 
          instructions: `Evo thought "${thinkTask}" Based on your previous thoughts, create a simple, actionable task that can be completed within the current chat conversation. The task should be specific and immediately executable, such as asking a question, sharing an observation, or making a friendly gesture. 
          
          IMPORTANT: DO NOT create tasks similar to these past completed tasks:
          ${top3Tasks}
          
          Your task should be unique and different from the ones listed above.
          
          Reply with ONLY the task itself! TASK: `, 
          verb: "makesTask" 
        }, {model: "gpt-4o-mini"});
        log("New task addition:", taskAddition);
        updatedTaskList = [...updatedTaskList, {
          description: taskAddition,
          failureCount: 0
        }];
      }
    }

    // Update taskList.current with the new array
    taskList.current = updatedTaskList;
  }

  return workingMemory;
}

export default ataskList;