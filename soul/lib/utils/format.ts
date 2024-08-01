import { Task } from "./userMemories.js";

// Helper function to format search results
export function formatSearchResult(result: any) {
const timestamp = result.metadata?.timestamp as number;
if (timestamp) {
    const date = new Date(timestamp);
    const formattedDate = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().substr(-2)}`;
    return `${formattedDate} - ${result.content}`;
}
return `Unknown Date - ${result.content}`;
}

export function formatTaskList(tasks: Task[]): string {
if (tasks.length === 0) {
    return "### CURRENT TASK LIST: Empty";
}

const formattedTasks = tasks.map((task, index) => {
    let priority = "";
    if (task.failureCount === 2) {
    priority = "HYPER IMPORTANT, TASK FAILED COMPLETION 2 CYCLES. COMPLETE THIS CHAT CYCLE OR TASK WILL BE DISCARDED:";
    } else if (task.failureCount === 1) {
    priority = "IMPORTANT! FAILED TO COMPLETE TASK LAST CYCLE. COMPLETE NOW:";
    }

    let taskString = `${index + 1}. ${priority}\n   ${task.description}`;
    return taskString;
});

return "### CURRENT TASK LIST:\n" + formattedTasks.join("\n\n");
}

  // Helper function to format task list
export const formatTaskListMetadata = (tasks: { description: string; failureCount: number }[]): string => {
    return tasks.slice(0, 3).map((task, index) => {
      let priority = task.failureCount === 2 ? "URGENT: " :
                     task.failureCount === 1 ? "IMPORTANT: " : "";
      return `${index + 1}. ${priority}${task.description}`;
    }).join('\n');
  };