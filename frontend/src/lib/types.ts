export type Workspace = {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
};

export type StudyDocument = {
  id: number;
  workspace_id: number;
  filename: string;
  uploaded_at: string;
  chunk_count: number;
};

export type Citation = {
  number: number;
  document_id: number;
  filename: string;
  page: number;
  snippet: string;
};

export type ChatMessage = {
  id: number;
  workspace_id: number;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  created_at: string;
};

export type Summary = {
  id: number;
  workspace_id: number;
  document_id: number;
  content: string;
  created_at: string;
};
