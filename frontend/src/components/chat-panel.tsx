"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, LoaderCircle, Send, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

import { Button } from "@/components/ui/button";
import { listDocuments, listMessages, clearMessages, streamChat } from "@/lib/api";
import type { ChatMessage, Citation, StudyDocument } from "@/lib/types";

export function ChatPanel({ workspaceId }: { workspaceId: number }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [documents, setDocuments] = useState<StudyDocument[]>([]);
  const [documentId, setDocumentId] = useState("");
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
        documentId ? Number(documentId) : null,
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
    <section className="flex min-h-[34rem] flex-col overflow-hidden rounded-xl border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 className="font-semibold">Study chat</h2>
          <p className="text-sm text-muted-foreground">Answers grounded in your workspace sources</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="chat-document-scope">Document scope</label>
          <select id="chat-document-scope" value={documentId} onChange={(event) => setDocumentId(event.target.value)} className="h-9 max-w-52 rounded-md border bg-background px-3 text-sm">
            <option value="">All documents</option>
            {documents.map((document) => <option key={document.id} value={document.id}>{document.filename}</option>)}
          </select>
          <Button type="button" variant="outline" size="sm" onClick={() => void clearHistory()} disabled={!messages.length || sending} aria-label="Clear chat history">
            <Trash2 /> Clear
          </Button>
        </div>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        {!messages.length && <div className="mx-auto flex max-w-md flex-col items-center gap-2 py-16 text-center text-muted-foreground"><BookOpen className="size-8" /><p className="font-medium text-foreground">What would you like to study?</p><p className="text-sm">Ask a question about your uploaded materials. Answers include page citations when sources are available.</p></div>}
        {messages.map((message) => (
          <article key={message.id} className={`max-w-[85%] rounded-xl px-4 py-3 ${message.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"}`}>
            {message.role === "assistant" ? (
              <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-2 [&_pre]:overflow-x-auto"><ReactMarkdown components={{ a: ({ href, children, ...props }) => <a {...props} href={href} className="text-primary underline underline-offset-2" onClick={() => { if (href?.startsWith("#source-")) document.getElementById(`sources-${message.id}`)?.setAttribute("open", ""); }}>{children}</a> }}>{(message.content || (sending ? "…" : "")).replace(/\[(\d+)\](?!\()/g, `[$1](#source-${message.id}-$1)`)}</ReactMarkdown></div>
            ) : <p className="whitespace-pre-wrap text-sm">{message.content}</p>}
            {message.role === "assistant" && message.citations.length > 0 && (
              <details id={`sources-${message.id}`} className="mt-3 border-t border-border/70 pt-2 text-sm">
                <summary className="cursor-pointer font-medium text-muted-foreground">Sources ({message.citations.length})</summary>
                <ul className="mt-2 space-y-2">
                  {message.citations.map((source) => <li id={`source-${message.id}-${source.number}`} key={source.number} className="rounded-md bg-background/70 p-2"><p className="font-medium">[{source.number}] {source.filename} · page {source.page}</p><p className="mt-1 text-muted-foreground">{source.snippet}</p></li>)}
                </ul>
              </details>
            )}
          </article>
        ))}
        <div ref={scrollRef} />
      </div>

      {error && <p role="alert" className="px-5 pb-2 text-sm text-destructive">{error}</p>}
      <form onSubmit={submit} className="flex items-end gap-2 border-t p-4">
        <label className="sr-only" htmlFor="chat-message">Your question</label>
        <textarea id="chat-message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Ask a question about your materials…" rows={2} disabled={sending} className="min-h-10 flex-1 resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        <Button type="submit" disabled={sending || !draft.trim()} aria-label="Send question">{sending ? <LoaderCircle className="animate-spin" /> : <Send />} Send</Button>
      </form>
    </section>
  );
}
