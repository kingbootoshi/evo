import { ChatMessageRoleEnum, MemoryIntegrator } from "@opensouls/engine"
import { safeName } from "./lib/utils/userMemories.js";

const currentDate = new Date();
const formattedDate = `${currentDate.getMonth() + 1}/${currentDate.getDate()}/${currentDate.getFullYear().toString().slice(-2)}`;
const formattedTime = currentDate.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
const currentDateTime = `${formattedDate} ${formattedTime}`;

const defaultPerceptionProcessor: MemoryIntegrator = async ({ perception, workingMemory, currentProcess, soul }) => {
  
  workingMemory = workingMemory.withRegion("core", {
    role: ChatMessageRoleEnum.System,
    content: soul.staticMemories.core,
    name: soul.name,
  }, {role: ChatMessageRoleEnum.Assistant, content: `## CURRENT TIME\n${currentDateTime}`})
  .withRegionalOrder("core", "scratchpad", "userMemory", "generalMemories", "summary", "chat", "default")
  
  const content = `${perception.name} ${perception.action}: "${perception.content}"`
  
  // Get existing chat memories
  const existingChatMemories = workingMemory.withOnlyRegions("chat").memories

  // Add new perception to existing chat memories
  const updatedChatMemories = [
    ...existingChatMemories,
    {
      role: perception.internal ? ChatMessageRoleEnum.Assistant : ChatMessageRoleEnum.User,
      content,
      ...(perception.name ? { name: safeName(perception.name) } : {}),
      metadata: {
        ...perception._metadata,
        timestamp: perception._timestamp
      }
    }
  ]

  // Update working memory with the combined chat memories
  workingMemory = workingMemory.withRegion("chat", ...updatedChatMemories)

  return [workingMemory, currentProcess]
}

export default defaultPerceptionProcessor