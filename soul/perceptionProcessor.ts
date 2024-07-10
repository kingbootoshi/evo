import { ChatMessageRoleEnum, MemoryIntegrator } from "@opensouls/engine"
import { safeName } from "./util/userMemories.js";

const defaultPerceptionProcessor: MemoryIntegrator = async ({ perception, workingMemory, currentProcess, soul }) => {
  
  workingMemory = workingMemory.withRegion("core", {
    role: ChatMessageRoleEnum.System,
    content: soul.staticMemories.core,
    name: soul.name,
  }).withRegionalOrder("core", "userMemory", "summary", "chat", "default")
  
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