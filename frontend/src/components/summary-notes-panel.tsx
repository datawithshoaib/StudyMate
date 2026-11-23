"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { FileText, LoaderCircle, NotebookPen } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
    <Card>
      <CardHeader>
        <CardTitle>Summary Notes</CardTitle>
        <CardDescription>
          Generate structured study guides from your workspace documents. Change the perspective
          before generating again to get a fresh version.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
            <NotebookPen className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No documents yet</p>
            <p className="text-sm text-muted-foreground">Upload a document to create summary notes.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {documents.map((document) => {
              const summary = summaryByDocument.get(document.id);
              const generating = generatingId === document.id;
              return (
                <Card key={document.id} className="shadow-none">
                  <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <FileText className="size-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">{document.filename}</CardTitle>
                        <CardDescription>
                          {summary ? `Updated ${new Date(summary.created_at).toLocaleString()}` : "No summary generated"}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                      <Input
                        aria-label={`Perspective for ${document.filename}`}
                        value={perspectives[document.id] ?? "Exam revision"}
                        onChange={(event) =>
                          setPerspectives((current) => ({ ...current, [document.id]: event.target.value }))
                        }
                        className="sm:w-44"
                        disabled={generating}
                      />
                      <Button
                        type="button"
                        onClick={() => void handleGenerate(document.id)}
                        disabled={generating || !perspectives[document.id]?.trim() && perspectives[document.id] !== undefined}
                      >
                        {generating ? <LoaderCircle className="animate-spin" /> : null}
                        {generating ? "Generating…" : summary ? "Regenerate Summary" : "Generate Summary"}
                      </Button>
                    </div>
                  </CardHeader>
                  {summary ? (
                    <CardContent className="border-t pt-5">
                      <article className="space-y-4 text-sm leading-7">
                        <ReactMarkdown
                          components={{
                            h1: ({ children }) => <h2 className="text-xl font-semibold tracking-tight">{children}</h2>,
                            h2: ({ children }) => <h2 className="pt-2 text-lg font-semibold tracking-tight">{children}</h2>,
                            h3: ({ children }) => <h3 className="pt-1 text-base font-semibold">{children}</h3>,
                            p: ({ children }) => <p className="text-muted-foreground">{children}</p>,
                            ul: ({ children }) => <ul className="list-disc space-y-1 pl-6 marker:text-primary">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal space-y-1 pl-6 marker:text-primary">{children}</ol>,
                            li: ({ children }) => <li className="text-muted-foreground">{children}</li>,
                            strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                            code: ({ children }) => <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{children}</code>,
                            blockquote: ({ children }) => <blockquote className="border-l-2 pl-4 italic text-muted-foreground">{children}</blockquote>,
                          }}
                        >
                          {summary.content}
                        </ReactMarkdown>
                      </article>
                    </CardContent>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
