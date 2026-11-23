import type { StudyDocument, Summary, Workspace } from "@/lib/types";

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
