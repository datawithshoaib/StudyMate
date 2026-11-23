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

export type Flashcard = {
  id: number;
  workspace_id: number;
  question: string;
  answer: string;
  source_page: number | null;
  source_doc: string | null;
  created_at: string;
  last_review: "got_it" | "missed_it" | null;
};

export type QuizQuestion = {
  id: number;
  question: string;
  options: string[];
  correct_option: number | null;
  explanation: string | null;
  source_page: number | null;
  source_doc: string | null;
  selected_option?: number | null;
  is_correct?: boolean | null;
};

export type Quiz = {
  id: number;
  workspace_id: number;
  difficulty: string;
  created_at: string;
  question_count: number;
  score: number | null;
  submitted: boolean;
  questions: QuizQuestion[];
};
