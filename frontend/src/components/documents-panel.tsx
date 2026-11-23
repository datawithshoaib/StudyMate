"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { FileText, LoaderCircle, Trash2, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteDocument, listDocuments, uploadDocuments } from "@/lib/api";
import type { StudyDocument } from "@/lib/types";
import { cn } from "@/lib/utils";

const ALLOWED_EXTENSION = /\.(pdf|docx|txt|md)$/i;

type Stage = "idle" | "extracting" | "chunking" | "embedding";

const STAGE_LABELS: Record<Stage, string> = {
  idle: "",
  extracting: "Extracting text…",
  chunking: "Chunking text…",
  embedding: "Embedding chunks…",
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function DocumentsPanel({ workspaceId }: { workspaceId: number }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const timersRef = useRef<number[]>([]);
  const [documents, setDocuments] = useState<StudyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<Stage>("idle");
  const [dragging, setDragging] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listDocuments(workspaceId)
      .then((items) => {
        if (!active) return;
        setDocuments(items);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Could not load documents.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workspaceId]);

  useEffect(() => () => timersRef.current.forEach(window.clearTimeout), []);

  async function refresh() {
    try {
      setDocuments(await listDocuments(workspaceId));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load documents.");
    }
  }

  const busy = stage !== "idle";

  async function handleFiles(files: FileList | null) {
    if (!files?.length || busy) return;
    const selected = Array.from(files);
    const accepted = selected.filter((file) => ALLOWED_EXTENSION.test(file.name));
    const rejected = selected.length - accepted.length;
    if (!accepted.length) {
      setError("Choose PDF, DOCX, TXT, or Markdown files.");
      return;
    }

    setError(null);
    setStage("extracting");
    timersRef.current = [
      window.setTimeout(() => setStage("chunking"), 400),
      window.setTimeout(() => setStage("embedding"), 900),
    ];
    try {
      await uploadDocuments(workspaceId, accepted);
      await refresh();
      if (rejected > 0) {
        setError(`${rejected} unsupported file(s) were skipped.`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not upload documents.");
    } finally {
      timersRef.current.forEach(window.clearTimeout);
      timersRef.current = [];
      setStage("idle");
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    void handleFiles(event.target.files);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void handleFiles(event.dataTransfer.files);
  }

  async function handleDelete(documentId: number) {
    setDeletingId(documentId);
    setError(null);
    try {
      await deleteDocument(workspaceId, documentId);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete document.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents</CardTitle>
        <CardDescription>
          Upload study materials to index them for this workspace.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.md"
          className="hidden"
          onChange={handleInputChange}
        />
        <div
          role="button"
          tabIndex={busy ? -1 : 0}
          aria-disabled={busy}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-8 text-center transition-colors",
            dragging ? "border-primary bg-primary/5" : "border-border",
            busy && "pointer-events-none opacity-70",
          )}
        >
          <UploadCloud className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">Drop documents here or click to browse</p>
          <p className="text-xs text-muted-foreground">PDF, DOCX, TXT, and Markdown</p>
        </div>

        {busy ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <LoaderCircle className="size-4 animate-spin" />
            {STAGE_LABELS[stage]}
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Indexed documents</h3>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No documents yet. Upload one to get started.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {documents.map((document) => (
                <li key={document.id} className="flex items-center gap-3 px-3 py-2">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{document.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {dateFormatter.format(new Date(document.uploaded_at))} · {document.chunk_count}{" "}
                      {document.chunk_count === 1 ? "chunk" : "chunks"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${document.filename}`}
                    title="Delete document"
                    disabled={busy || deletingId === document.id}
                    onClick={() => void handleDelete(document.id)}
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
