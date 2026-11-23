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
