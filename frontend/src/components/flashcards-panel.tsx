"use client";

import { useEffect, useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";

import { generateFlashcards, listFlashcards, reviewFlashcard } from "@/lib/api";
import type { Flashcard } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div><CardTitle>Flashcards</CardTitle><CardDescription>Flip each card, then rate how well you recalled it.</CardDescription></div>
        <Button onClick={generate} disabled={busy || loading}><RotateCcw />{cards.length ? "Regenerate" : "Generate Flashcards"}</Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {loading ? <p className="text-sm text-muted-foreground">Loading flashcards…</p> : current ? (
          <>
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground"><span>Reviewed {reviewed} of {cards.length}</span><span>{index + 1} / {cards.length}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={cards.length} aria-valuenow={reviewed} aria-label="Cards reviewed">
                <div className="h-full bg-primary transition-all" style={{ width: `${cards.length ? (reviewed / cards.length) * 100 : 0}%` }} />
              </div>
            </div>
            <button type="button" onClick={() => setFlipped((value) => !value)} aria-label={flipped ? "Show question" : "Reveal answer"}
              className="group w-full [perspective:1000px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
              <div className={`relative min-h-64 w-full rounded-xl transition-transform duration-500 [transform-style:preserve-3d] ${flipped ? "[transform:rotateY(180deg)]" : ""}`}>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-xl border bg-card p-8 text-center [backface-visibility:hidden]">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Question</span>
                  <span className="text-xl font-semibold">{current.question}</span>
                  <span className="text-xs text-muted-foreground">Click to reveal answer</span>
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-xl border border-amber-500/40 bg-amber-500/5 p-8 text-center [transform:rotateY(180deg)] [backface-visibility:hidden]">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Answer</span>
                  <span className="text-lg">{current.answer}</span>
                  {current.source_doc && <span className="text-xs text-muted-foreground">Source: {current.source_doc}{current.source_page ? ` · page ${current.source_page}` : ""}</span>}
                </div>
              </div>
            </button>
            {flipped && <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={() => rate("missed_it")} disabled={busy}><X />Missed it</Button>
              <Button onClick={() => rate("got_it")} disabled={busy}><Check />Got it</Button>
            </div>}
          </>
        ) : <div className="py-10 text-center text-sm text-muted-foreground">{cards.length ? "You reviewed every flashcard. Generate a fresh set to keep practicing." : "Generate a set from your workspace documents to start reviewing."}</div>}
      </CardContent>
    </Card>
  );
}
