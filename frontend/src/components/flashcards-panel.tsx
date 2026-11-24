"use client";

import { useEffect, useState } from "react";
import { Check, Layers3, LoaderCircle, RotateCcw, TriangleAlert, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { generateFlashcards, listFlashcards, reviewFlashcard } from "@/lib/api";
import type { Flashcard } from "@/lib/types";

export function FlashcardsPanel({ workspaceId }: { workspaceId: number }) {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    listFlashcards(workspaceId)
      .then((items) => { if (active) setCards(items); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load flashcards"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [workspaceId]);

  const current = cards[index];
  const reviewed = cards.filter((card) => card.last_review !== null).length;
  const progress = cards.length ? Math.round((reviewed / cards.length) * 100) : 0;

  async function generate() {
    setBusy(true); setError("");
    try { setCards(await generateFlashcards(workspaceId)); setIndex(0); setFlipped(false); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not generate flashcards"); }
    finally { setBusy(false); }
  }

  async function rate(result: "got_it" | "missed_it") {
    if (!current) return;
    setBusy(true); setError("");
    try {
      const updated = await reviewFlashcard(workspaceId, current.id, result);
      setCards((previous) => previous.map((card) => card.id === updated.id ? updated : card));
      setIndex((previous) => Math.min(previous + 1, cards.length - 1));
      setFlipped(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save your review"); }
    finally { setBusy(false); }
  }

  return (
    <section className="surface p-4 sm:p-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Layers3 className="size-5" />
          </div>
          <div>
            <h2 className="font-heading text-base font-semibold tracking-tight">Flashcards</h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Flip each card, then rate how well you recalled it.
            </p>
          </div>
        </div>
        <Button onClick={generate} disabled={busy || loading} variant={cards.length ? "outline" : "default"}>
          {busy ? <LoaderCircle className="animate-spin" /> : <RotateCcw />}
          {cards.length ? "Regenerate" : "Generate Flashcards"}
        </Button>
      </header>

      {error ? (
        <p role="alert" className="mb-4 flex items-center gap-1.5 text-sm text-destructive">
          <TriangleAlert className="size-4" />
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading flashcards…</p>
      ) : current ? (
        <div className="space-y-5">
          <div className="muted-panel flex flex-wrap items-center gap-3 p-3">
            <Badge variant="secondary">
              {index + 1} of {cards.length}
            </Badge>
            <div className="min-w-40 flex-1">
              <Progress value={progress} aria-label="Cards reviewed" />
            </div>
            <span className="text-xs text-muted-foreground">
              {reviewed}/{cards.length} reviewed
            </span>
          </div>
          <button
            type="button"
            onClick={() => setFlipped((value) => !value)}
            aria-label={flipped ? "Show question" : "Reveal answer"}
            className="group block w-full rounded-3xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [perspective:1200px]"
          >
            <div className={`relative min-h-72 w-full transition-transform duration-500 [transform-style:preserve-3d] ${flipped ? "[transform:rotateY(180deg)]" : ""}`}>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-3xl border bg-card p-8 text-center shadow-sm [backface-visibility:hidden]">
                <Badge variant="outline" className="mb-2">Question</Badge>
                <span className="font-heading text-xl font-semibold text-balance sm:text-2xl">{current.question}</span>
                <span className="text-xs text-muted-foreground">Click to reveal answer</span>
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-3xl border border-primary/30 bg-linear-to-br from-primary/10 to-accent/10 p-8 text-center shadow-sm [transform:rotateY(180deg)] [backface-visibility:hidden]">
                <Badge>Answer</Badge>
                <span className="text-lg leading-relaxed text-balance">{current.answer}</span>
                {current.source_doc ? (
                  <span className="text-xs text-muted-foreground">
                    Source: {current.source_doc}{current.source_page ? ` · page ${current.source_page}` : ""}
                  </span>
                ) : null}
              </div>
            </div>
          </button>
          {flipped ? (
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="outline" onClick={() => rate("missed_it")} disabled={busy} className="min-w-32">
                <X className="text-destructive" />
                Missed it
              </Button>
              <Button onClick={() => rate("got_it")} disabled={busy} className="min-w-32">
                <Check />
                Got it
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <Empty className="border bg-background/40 py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="size-12 rounded-2xl bg-primary/10 text-primary">
              <Layers3 />
            </EmptyMedia>
            <EmptyTitle>{cards.length ? "All caught up" : "No flashcards yet"}</EmptyTitle>
            <EmptyDescription>
              {cards.length
                ? "You reviewed every flashcard. Generate a fresh set to keep practicing."
                : "Generate a set from your workspace documents to start reviewing."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="mt-2">
            <Button onClick={generate} disabled={busy}>
              {busy ? <LoaderCircle className="animate-spin" /> : <RotateCcw />}
              Generate Flashcards
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </section>
  );
}
