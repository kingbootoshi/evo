export interface ChatLog {
    timestamp: number;
    speaker: "user" | "ai";
    content: string;
  }
  
export interface UserMemory {
    name: string;
    recentChatLogs: ChatLog[];
    lastInteraction: number;
    totalInteractions: number;
    notes: string;
    feelings: {
      description: string;
    };
    lastConversationSummary: string;
    longTermMemories: string; // This will store RAG-retrievable summaries
  }

export interface GlobalUserInteractions {
    [username: string]: number;
  }

export function safeName(name?: string) {
    return (name || "").replace(/[^a-zA-Z0-9_-{}]/g, '_').slice(0, 62);
  }

export interface Task {
  description: string;
  failureCount: number;
  failureReason?: string;
}