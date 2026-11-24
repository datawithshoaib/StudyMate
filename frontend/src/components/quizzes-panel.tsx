"use client";

import { useEffect, useState } from "react";
import {
  CalendarDays,
  Check,
  CircleCheck,
  CircleX,
  LoaderCircle,
  RotateCcw,
  SquareCheckBig,
  TriangleAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateQuiz, getQuiz, listQuizzes, submitQuiz } from "@/lib/api";
import type { Quiz } from "@/lib/types";
import { cn } from "@/lib/utils";

export function QuizzesPanel({ workspaceId }: { workspaceId: number }) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState("Medium");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listQuizzes(workspaceId)
      .then((items) => { if (active) setQuizzes(items); })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load quizzes.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [workspaceId]);

  async function handleGenerate() {
    setBusy(true);
    setError(null);
    try {
      const created = await generateQuiz(workspaceId, count, difficulty);
      setQuiz(created);
      setAnswers({});
      setQuizzes((current) => [created, ...current]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate quiz.");
    } finally {
      setBusy(false);
    }
  }

  async function handleOpen(quizId: number) {
    setBusy(true);
    setError(null);
    try {
      const selected = await getQuiz(workspaceId, quizId);
      setQuiz(selected);
      setAnswers({});
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open quiz.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit() {
    if (!quiz) return;
    setBusy(true);
    setError(null);
    try {
      const result = await submitQuiz(workspaceId, quiz.id, answers);
      setQuiz(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit quiz.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface p-4 sm:p-6">
      <header className="mb-5 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <SquareCheckBig className="size-5" />
        </div>
        <div>
          <h2 className="font-heading text-base font-semibold tracking-tight">Practice Quizzes</h2>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Generate a multiple-choice quiz from your workspace documents.
          </p>
        </div>
      </header>

      {error ? (
        <p role="alert" className="mb-4 flex items-center gap-1.5 text-sm text-destructive">
          <TriangleAlert className="size-4" />
          {error}
        </p>
      ) : null}

      <div className="muted-panel flex flex-wrap items-end gap-4 p-4">
        <div className="grid gap-2">
          <Label htmlFor="quiz-count">Questions</Label>
          <Input
            id="quiz-count"
            aria-label="Question count"
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
            className="w-28 bg-background"
            disabled={busy}
          />
        </div>
        <div className="grid gap-2">
          <Label>Difficulty</Label>
          <Select value={difficulty} onValueChange={(value) => setDifficulty(value ?? "Medium")}>
            <SelectTrigger aria-label="Difficulty" className="w-32 bg-background">
              <SelectValue>{(value: string | null) => value ?? "Medium"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Easy">Easy</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="Hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={busy || !Number.isInteger(count) || count < 1 || count > 50}
        >
          {busy ? <LoaderCircle className="animate-spin" /> : <SquareCheckBig />}
          {quiz ? "Generate Fresh Quiz" : "Generate Quiz"}
        </Button>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading quizzes…</p>
      ) : quizzes.length > 0 ? (
        <div className="mt-5 flex flex-wrap items-center gap-2" aria-label="Previous quizzes">
          <span className="text-xs font-medium text-muted-foreground">Recent:</span>
          {quizzes.slice(0, 6).map((item) => (
            <Button
              key={item.id}
              type="button"
              variant={quiz?.id === item.id ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              disabled={busy}
              onClick={() => void handleOpen(item.id)}
            >
              <CalendarDays className="size-3.5" />
              {item.difficulty} · {item.question_count} questions
            </Button>
          ))}
        </div>
      ) : null}

      {quiz ? (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
            <div className="flex items-center gap-2">
              <h3 className="font-heading text-lg font-semibold tracking-tight">{quiz.difficulty} quiz</h3>
              <Badge variant="secondary">{quiz.question_count} questions</Badge>
            </div>
            {quiz.submitted ? (
              <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
                <CircleCheck className="size-4" />
                Score: {quiz.score} / {quiz.question_count}
              </div>
            ) : (
              <Badge variant="outline">
                {Object.keys(answers).length}/{quiz.questions.length} answered
              </Badge>
            )}
          </div>
          {quiz.questions.map((question, index) => (
            <div key={question.id} className="rounded-2xl border bg-background p-4 shadow-sm">
              <div className="mb-3 flex items-start gap-3">
                <Badge className="mt-0.5">{index + 1}</Badge>
                <h4 className="text-sm leading-relaxed font-medium">{question.question}</h4>
              </div>
              <fieldset className="space-y-2" disabled={quiz.submitted || busy}>
                <legend className="sr-only">Choose an answer for question {index + 1}</legend>
                {question.options.map((option, optionIndex) => {
                  const selected = quiz.submitted ? question.selected_option === optionIndex : answers[question.id] === optionIndex;
                  const correct = quiz.submitted && question.correct_option === optionIndex;
                  const incorrect = quiz.submitted && selected && !correct;
                  return (
                    <label
                      key={optionIndex}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                        "hover:border-primary/40 hover:bg-primary/5",
                        selected && !quiz.submitted && "border-primary bg-primary/5",
                        correct && "border-emerald-500/60 bg-emerald-500/10",
                        incorrect && "border-destructive/60 bg-destructive/10",
                      )}
                    >
                      <input
                        type="radio"
                        name={`question-${question.id}`}
                        value={optionIndex}
                        checked={selected}
                        onChange={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))}
                        className="mt-0.5 accent-primary"
                      />
                      <span className="leading-relaxed">{option}</span>
                    </label>
                  );
                })}
              </fieldset>
              {quiz.submitted ? (
                <div className="mt-3 space-y-1 border-t pt-3 text-sm">
                  <p className={cn("flex items-center gap-1.5 font-medium", question.is_correct ? "text-emerald-600" : "text-destructive")}>
                    {question.is_correct ? <CircleCheck className="size-4" /> : <CircleX className="size-4" />}
                    {question.is_correct ? "Correct" : `Correct answer: ${question.options[question.correct_option ?? 0]}`}
                  </p>
                  {question.explanation ? <p className="text-muted-foreground">{question.explanation}</p> : null}
                  {question.source_doc ? (
                    <p className="text-xs text-muted-foreground">Source: {question.source_doc}, page {question.source_page ?? 1}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
          {quiz.submitted ? (
            <Button type="button" variant="outline" onClick={() => void handleGenerate()} disabled={busy}>
              <RotateCcw />
              Generate Another Quiz
            </Button>
          ) : (
            <Button type="button" onClick={() => void handleSubmit()} disabled={busy || Object.keys(answers).length !== quiz.questions.length}>
              {busy ? <LoaderCircle className="animate-spin" /> : <Check />}
              Submit Quiz
            </Button>
          )}
        </div>
      ) : !loading && quizzes.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl border border-dashed py-12 text-center">
          <SquareCheckBig className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No quizzes yet</p>
          <p className="text-sm text-muted-foreground">Upload documents, then generate a quiz to start practicing.</p>
        </div>
      ) : null}
    </section>
  );
}
