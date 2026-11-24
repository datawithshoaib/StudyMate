"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { FileText, LoaderCircle, Trash2, TriangleAlert, UploadCloud } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
    <section className="surface p-4 sm:p-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileText className="size-5" />
          </div>
          <div>
            <h2 className="font-heading text-base font-semibold tracking-tight">Documents</h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Upload study materials to index them for this workspace.
            </p>
          </div>
        </div>
        {!loading ? (
          <Badge variant="secondary">{documents.length} indexed</Badge>
        ) : null}
      </header>

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
          "group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-9 text-center transition-all duration-200",
          dragging
            ? "border-primary bg-primary/5 ring-4 ring-primary/10"
            : "border-border bg-muted/20 hover:border-primary/50 hover:bg-primary/5",
          busy && "pointer-events-none opacity-70",
        )}
      >
        <span className="flex size-12 items-center justify-center rounded-2xl bg-background shadow-sm ring-1 ring-border transition-transform group-hover:-translate-y-0.5">
          <UploadCloud className="size-5 text-primary" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-medium">Drop documents here or click to browse</p>
          <p className="text-xs text-muted-foreground">PDF, DOCX, TXT, and Markdown</p>
        </div>
      </div>

      {busy ? (
        <div
          role="status"
          aria-live="polite"
          className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"
        >
          <LoaderCircle className="size-4 animate-spin text-primary" />
          {STAGE_LABELS[stage]}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 flex items-center gap-1.5 text-sm text-destructive">
          <TriangleAlert className="size-4" />
          {error}
        </p>
      ) : null}

      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Indexed documents</h3>
        </div>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        ) : documents.length === 0 ? (
          <Empty className="border bg-background/40">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileText />
              </EmptyMedia>
              <EmptyTitle>No documents yet</EmptyTitle>
              <EmptyDescription>Upload one above to get started.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="space-y-2">
            {documents.map((document) => (
              <li
                key={document.id}
                className="muted-panel flex items-center gap-3 p-3 transition-colors hover:bg-muted/70"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background text-primary shadow-sm ring-1 ring-border">
                  <FileText className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{document.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {dateFormatter.format(new Date(document.uploaded_at))}
                  </p>
                </div>
                <Badge variant="outline" className="hidden sm:inline-flex">
                  {document.chunk_count} {document.chunk_count === 1 ? "chunk" : "chunks"}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${document.filename}`}
                  title="Delete document"
                  disabled={busy || deletingId === document.id}
                  onClick={() => void handleDelete(document.id)}
                >
                  {deletingId === document.id ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <Trash2 className="text-destructive" />
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
