import type { ChatMessage, Citation, Flashcard, Quiz, StudyDocument, Summary, Workspace } from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: isFormData
      ? init?.headers
      : {
          "Content-Type": "application/json",
          ...init?.headers,
        },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { detail?: string | { msg?: string }[] }
      | null;
    const detail = body?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail[0]?.msg
          : undefined;
    throw new Error(message ?? `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function listWorkspaces(): Promise<Workspace[]> {
  return request<Workspace[]>("/api/workspaces");
}

export function createWorkspace(name: string): Promise<Workspace> {
  return request<Workspace>("/api/workspaces", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function renameWorkspace(id: number, name: string): Promise<Workspace> {
  return request<Workspace>(`/api/workspaces/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name }),
  });
}

export function deleteWorkspace(id: number): Promise<void> {
  return request<void>(`/api/workspaces/${id}`, { method: "DELETE" });
}

export function listDocuments(workspaceId: number): Promise<StudyDocument[]> {
  return request<StudyDocument[]>(`/api/workspaces/${workspaceId}/documents`);
}

export function uploadDocuments(workspaceId: number, files: File[]): Promise<StudyDocument[]> {
  const body = new FormData();
  for (const file of files) {
    body.append("files", file);
  }
  return request<StudyDocument[]>(`/api/workspaces/${workspaceId}/documents`, {
    method: "POST",
    body,
  });
}

export function deleteDocument(workspaceId: number, documentId: number): Promise<void> {
  return request<void>(`/api/workspaces/${workspaceId}/documents/${documentId}`, {
    method: "DELETE",
  });
}

export function listMessages(workspaceId: number): Promise<ChatMessage[]> {
  return request<ChatMessage[]>(`/api/workspaces/${workspaceId}/messages`);
}

export function clearMessages(workspaceId: number): Promise<void> {
  return request<void>(`/api/workspaces/${workspaceId}/messages`, { method: "DELETE" });
}

export async function streamChat(
  workspaceId: number,
  message: string,
  documentId: number | null,
  onToken: (token: string) => void,
  onCitation: (citation: Citation) => void,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, document_id: documentId }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Request failed with status ${response.status}`);
  }
  if (!response.body) throw new Error("The server did not return a stream");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      const line = event.split("\n").find((part) => part.startsWith("data: "));
      if (!line) continue;
      const parsed = JSON.parse(line.slice(6)) as { type: string; data: string | Citation | { message?: string } };
      if (parsed.type === "token" && typeof parsed.data === "string") onToken(parsed.data);
      if (parsed.type === "citation") onCitation(parsed.data as Citation);
      if (parsed.type === "error") throw new Error((parsed.data as { message?: string }).message ?? "Chat failed");
    }
    if (done) break;
  }
}

export function listSummaries(workspaceId: number): Promise<Summary[]> {
  return request<Summary[]>(`/api/workspaces/${workspaceId}/summaries`);
}

export function generateSummary(
  workspaceId: number,
  documentId: number,
  perspective: string,
): Promise<Summary> {
  return request<Summary>(`/api/workspaces/${workspaceId}/summaries/generate`, {
    method: "POST",
    body: JSON.stringify({ document_id: documentId, perspective }),
  });
}

export function listFlashcards(workspaceId: number): Promise<Flashcard[]> {
  return request<Flashcard[]>(`/api/workspaces/${workspaceId}/flashcards`);
}

export function generateFlashcards(workspaceId: number): Promise<Flashcard[]> {
  return request<Flashcard[]>(`/api/workspaces/${workspaceId}/flashcards/generate`, { method: "POST" });
}

export function reviewFlashcard(
  workspaceId: number,
  cardId: number,
  result: "got_it" | "missed_it",
): Promise<Flashcard> {
  return request<Flashcard>(`/api/workspaces/${workspaceId}/flashcards/${cardId}/review`, {
    method: "POST",
    body: JSON.stringify({ result }),
  });
}

export function listQuizzes(workspaceId: number): Promise<Quiz[]> {
  return request<Quiz[]>(`/api/workspaces/${workspaceId}/quizzes`);
}

export function getQuiz(workspaceId: number, quizId: number): Promise<Quiz> {
  return request<Quiz>(`/api/workspaces/${workspaceId}/quizzes/${quizId}`);
}

export function generateQuiz(workspaceId: number, count: number, difficulty: string): Promise<Quiz> {
  return request<Quiz>(`/api/workspaces/${workspaceId}/quizzes/generate`, {
    method: "POST",
    body: JSON.stringify({ count, difficulty }),
  });
}

export function submitQuiz(workspaceId: number, quizId: number, answers: Record<number, number>): Promise<Quiz> {
  return request<Quiz>(`/api/workspaces/${workspaceId}/quizzes/${quizId}/submit`, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
}
