"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  BookOpen,
  LoaderCircle,
  MessageCircle,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { listDocuments, listMessages, clearMessages, streamChat } from "@/lib/api";
import type { ChatMessage, Citation, StudyDocument } from "@/lib/types";

const suggestions = [
  "Summarize the key concepts",
  "What should I focus on for the exam?",
  "Explain this in simple terms",
];

export function ChatPanel({ workspaceId }: { workspaceId: number }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [documents, setDocuments] = useState<StudyDocument[]>([]);
  const [documentId, setDocumentId] = useState("all");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const [history, availableDocuments] = await Promise.all([
        listMessages(workspaceId),
        listDocuments(workspaceId),
      ]);
      setMessages(history);
      setDocuments(availableDocuments);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this chat.");
    }
  }, [workspaceId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = draft.trim();
    if (!question || sending) return;
    setError("");
    setDraft("");
    setSending(true);
    const temporaryId = -Date.now();
    const userMessage: ChatMessage = {
      id: temporaryId - 1, workspace_id: workspaceId, role: "user", content: question, citations: [], created_at: new Date().toISOString(),
    };
    const assistantMessage: ChatMessage = {
      id: temporaryId, workspace_id: workspaceId, role: "assistant", content: "", citations: [], created_at: new Date().toISOString(),
    };
    setMessages((current) => [...current, userMessage, assistantMessage]);
    try {
      await streamChat(
        workspaceId,
        question,
        documentId !== "all" ? Number(documentId) : null,
        (token) => setMessages((current) => current.map((item) => item.id === temporaryId ? { ...item, content: item.content + token } : item)),
        (citation: Citation) => setMessages((current) => current.map((item) => item.id === temporaryId && !item.citations.some((source) => source.number === citation.number) ? { ...item, citations: [...item.citations, citation] } : item)),
      );
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The answer could not be completed.");
      await refresh();
    } finally {
      setSending(false);
    }
  }

  async function clearHistory() {
    await clearMessages(workspaceId);
    setMessages([]);
    setError("");
  }

  return (
    <section className="surface flex min-h-[36rem] flex-col overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MessageCircle className="size-5" />
          </div>
          <div>
            <h2 className="font-heading text-base font-semibold tracking-tight">Study chat</h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Answers grounded in your workspace sources
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={documentId} onValueChange={(value) => setDocumentId(value ?? "all")}>
            <SelectTrigger aria-label="Document scope" className="w-44 sm:w-52">
              <BookOpen className="size-4 text-muted-foreground" />
              <SelectValue>
                {(value: string | null) =>
                  !value || value === "all"
                    ? "All documents"
                    : (documents.find((item) => String(item.id) === value)?.filename ?? "All documents")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All documents</SelectItem>
              {documents.map((document) => (
                <SelectItem key={document.id} value={String(document.id)}>
                  {document.filename}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => void clearHistory()}
            disabled={!messages.length || sending}
            aria-label="Clear chat history"
            title="Clear chat history"
          >
            <Trash2 />
          </Button>
        </div>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-6 sm:px-6">
        {!messages.length ? (
          <Empty className="border-0 py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="size-12 rounded-2xl bg-primary/10 text-primary">
                <Sparkles />
              </EmptyMedia>
              <EmptyTitle>What would you like to study?</EmptyTitle>
              <EmptyDescription>
                Ask a question about your uploaded materials. Answers include citations when sources are available.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="mt-2 flex-wrap items-center justify-center gap-2">
              {suggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-full"
                  onClick={() => setDraft(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </EmptyContent>
          </Empty>
        ) : null}
        {messages.map((message) => (
          <article
            key={message.id}
            className={`flex max-w-[88%] flex-col gap-1.5 ${message.role === "user" ? "ml-auto items-end" : "mr-auto items-start"}`}
          >
            <span className="px-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {message.role === "user" ? "You" : "StudyMate"}
            </span>
            <div
              className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${message.role === "user" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border bg-muted/50"}`}
            >
              {message.role === "assistant" ? (
                <div className="prose-study [&_p]:my-2 [&_pre]:overflow-x-auto">
                  <ReactMarkdown components={{ a: ({ href, children, ...props }) => <a {...props} href={href} className="text-primary underline underline-offset-2" onClick={() => { if (href?.startsWith("#source-")) document.getElementById(`sources-${message.id}`)?.setAttribute("open", ""); }}>{children}</a> }}>
                    {(message.content || (sending ? "…" : "")).replace(/\[(\d+)\](?!\()/g, `[$1](#source-${message.id}-$1)`)}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{message.content}</p>
              )}
              {message.role === "assistant" && message.citations.length > 0 ? (
                <details id={`sources-${message.id}`} className="mt-3 border-t border-border/70 pt-2 text-sm">
                  <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-muted-foreground transition-colors hover:text-foreground">
                    <BookOpen className="size-3.5" />
                    Sources
                    <Badge variant="secondary" className="h-4 border-0 px-1.5 text-[10px]">
                      {message.citations.length}
                    </Badge>
                  </summary>
                  <ul className="mt-3 space-y-2">
                    {message.citations.map((source) => (
                      <li id={`source-${message.id}-${source.number}`} key={source.number} className="rounded-xl border bg-background/70 p-3">
                        <p className="text-xs font-medium">
                          [{source.number}] {source.filename} · page {source.page}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{source.snippet}</p>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          </article>
        ))}
        <div ref={scrollRef} />
      </div>

      {error ? (
        <p role="alert" className="mx-4 flex items-center gap-1.5 text-sm text-destructive sm:mx-6">
          <TriangleAlert className="size-4" />
          {error}
        </p>
      ) : null}
      <form onSubmit={submit} className="border-t bg-muted/20 p-4">
        <div className="flex items-end gap-2">
          <label className="sr-only" htmlFor="chat-message">Your question</label>
          <Textarea
            id="chat-message"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Ask anything about your materials…"
            rows={2}
            disabled={sending}
            className="min-h-11 flex-1 resize-none rounded-xl bg-background shadow-sm"
          />
          <Button type="submit" size="icon-lg" disabled={sending || !draft.trim()} aria-label="Send question" title="Send question">
            {sending ? <LoaderCircle className="animate-spin" /> : <ArrowUp />}
          </Button>
        </div>
        <p className="mt-2 px-1 text-[11px] text-muted-foreground">
          Enter to send · Shift + Enter for a new line
        </p>
      </form>
    </section>
  );
}
