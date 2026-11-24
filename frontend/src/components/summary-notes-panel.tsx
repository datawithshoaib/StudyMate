"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { FileText, LoaderCircle, NotebookPen, Sparkles, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { generateSummary, listDocuments, listSummaries } from "@/lib/api";
import type { StudyDocument, Summary } from "@/lib/types";

export function SummaryNotesPanel({ workspaceId }: { workspaceId: number }) {
  const [documents, setDocuments] = useState<StudyDocument[]>([]);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [perspectives, setPerspectives] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([listDocuments(workspaceId), listSummaries(workspaceId)])
      .then(([nextDocuments, nextSummaries]) => {
        if (!active) return;
        setDocuments(nextDocuments);
        setSummaries(nextSummaries);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load summary notes.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [workspaceId]);

  async function handleGenerate(documentId: number) {
    setGeneratingId(documentId);
    setError(null);
    try {
      const summary = await generateSummary(
        workspaceId,
        documentId,
        perspectives[documentId] ?? "Exam revision",
      );
      setSummaries((current) => [
        ...current.filter((item) => item.document_id !== documentId),
        summary,
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate summary.");
    } finally {
      setGeneratingId(null);
    }
  }

  const summaryByDocument = new Map(summaries.map((summary) => [summary.document_id, summary]));

  return (
    <section className="surface p-4 sm:p-6">
      <header className="mb-5 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <NotebookPen className="size-5" />
        </div>
        <div>
          <h2 className="font-heading text-base font-semibold tracking-tight">Summary Notes</h2>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Structured study guides from your documents. Change the perspective for a fresh version.
          </p>
        </div>
      </header>

      {error ? (
        <p role="alert" className="mb-4 flex items-center gap-1.5 text-sm text-destructive">
          <TriangleAlert className="size-4" />
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      ) : documents.length === 0 ? (
        <Empty className="border bg-background/40 py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="size-12 rounded-2xl bg-primary/10 text-primary">
              <NotebookPen />
            </EmptyMedia>
            <EmptyTitle>No documents yet</EmptyTitle>
            <EmptyDescription>Upload a document to create summary notes.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-4">
          {documents.map((document) => {
            const summary = summaryByDocument.get(document.id);
            const generating = generatingId === document.id;
            return (
              <div key={document.id} className="overflow-hidden rounded-2xl border bg-background shadow-sm">
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{document.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {summary ? `Updated ${new Date(summary.created_at).toLocaleString()}` : "No summary generated"}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-end gap-2">
                    <div className="grid flex-1 gap-1.5">
                      <Label className="text-[11px] text-muted-foreground" htmlFor={`perspective-${document.id}`}>
                        Perspective
                      </Label>
                      <Input
                        id={`perspective-${document.id}`}
                        aria-label={`Perspective for ${document.filename}`}
                        value={perspectives[document.id] ?? "Exam revision"}
                        onChange={(event) =>
                          setPerspectives((current) => ({ ...current, [document.id]: event.target.value }))
                        }
                        className="h-9 w-full sm:w-48"
                        disabled={generating}
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="h-9"
                      onClick={() => void handleGenerate(document.id)}
                      disabled={generating || !perspectives[document.id]?.trim() && perspectives[document.id] !== undefined}
                    >
                      {generating ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
                      {generating ? "Generating…" : summary ? "Regenerate" : "Generate"}
                    </Button>
                  </div>
                  {summary ? (
                    <Badge variant="secondary" className="self-start sm:ml-auto">Ready</Badge>
                  ) : null}
                </div>
                {summary ? (
                  <div className="border-t bg-muted/20 px-4 py-5 sm:px-5">
                    <article className="prose-study">
                      <ReactMarkdown
                        components={{
                          h1: ({ children }) => <h2>{children}</h2>,
                          blockquote: ({ children }) => <blockquote className="border-l-primary">{children}</blockquote>,
                        }}
                      >
                        {summary.content}
                      </ReactMarkdown>
                    </article>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
