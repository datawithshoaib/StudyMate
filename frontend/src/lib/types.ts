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

export type Summary = {
  id: number;
  workspace_id: number;
  document_id: number;
  content: string;
  created_at: string;
};
