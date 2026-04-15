// Auth
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  full_name?: string;
}

// RAG / Chat
export interface QueryInsights {
  latency_ms: number;
  retrieval_count: number;
  retrieval_ms?: number;
  generation_ms?: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  model: string;
  workflow_steps?: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: SourceChunk[];
  insights?: QueryInsights;
  command?: string;
  workflowStep?: string;
  isRCA?: boolean;
}

export interface SourceChunk {
  id?: string;
  text: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface QueryRequest {
  query: string;
  collection_name?: string;
  top_k?: number;
}

export interface QueryResponse {
  answer: string;
  sources: SourceChunk[];
  insights?: QueryInsights;
}

// Stream events from backend
export type StreamEvent =
  | { type: "sources"; sources: SourceChunk[]; retrieval_count: number; retrieval_ms: number }
  | { type: "token"; token: string; step?: string }
  | { type: "insights" } & QueryInsights
  | { type: "step_start"; step: string; step_index: number; total_steps: number }
  | { type: "step_end"; step: string; step_index: number }
  | { type: "done" };

// Documents
export interface IngestResponse {
  chunks: number;
  point_ids: string[];
}

export interface DocumentItem {
  id: string;
  text: string;
  metadata: Record<string, unknown>;
}

export interface DocumentListResponse {
  documents: DocumentItem[];
  total: number;
  next_offset: string | null;
}

export interface CollectionStats {
  collection: string;
  vectors_count: number;
  status: string;
}

// Conversations
export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ConversationDetail extends Conversation {
  messages: ConversationMessage[];
}

// User Memory
export interface UserMemoryEntry {
  id: string;
  query: string;
  summary: string;
  tags: string[];
  timestamp: Date;
}
