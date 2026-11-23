"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, RotateCcw, SquareCheckBig } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { generateQuiz, getQuiz, listQuizzes, submitQuiz } from "@/lib/api";
import type { Quiz } from "@/lib/types";

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
    <Card>
      <CardHeader>
        <CardTitle>Practice Quizzes</CardTitle>
        <CardDescription>Generate a multiple-choice quiz from your workspace documents, then review your results.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
          <label className="grid gap-2 text-sm font-medium">
            Questions
            <Input aria-label="Question count" type="number" min={1} max={50} value={count}
              onChange={(event) => setCount(Number(event.target.value))} className="w-28" disabled={busy} />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Difficulty
            <select aria-label="Difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm" disabled={busy}>
              <option>Easy</option><option>Medium</option><option>Hard</option>
            </select>
          </label>
          <Button type="button" onClick={() => void handleGenerate()} disabled={busy || !Number.isInteger(count) || count < 1 || count > 50}>
            {busy ? <LoaderCircle className="animate-spin" /> : <SquareCheckBig />}
            {quiz ? "Generate Fresh Quiz" : "Generate Quiz"}
          </Button>
        </div>

        {loading ? <p className="text-sm text-muted-foreground">Loading quizzes…</p> : quizzes.length > 0 ? (
          <div className="flex flex-wrap gap-2" aria-label="Previous quizzes">
            {quizzes.map((item) => (
              <Button key={item.id} type="button" variant={quiz?.id === item.id ? "default" : "outline"}
                size="sm" disabled={busy} onClick={() => void handleOpen(item.id)}>
                {item.difficulty} · {item.question_count} questions · {new Date(item.created_at).toLocaleDateString()}
              </Button>
            ))}
          </div>
        ) : null}

        {quiz ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">{quiz.difficulty} quiz</h3>
              {quiz.submitted ? <p className="font-semibold text-primary">Score: {quiz.score} / {quiz.question_count}</p> : null}
            </div>
            {quiz.questions.map((question, index) => (
              <Card key={question.id} className="shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">{index + 1}. {question.question}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <fieldset className="space-y-2" disabled={quiz.submitted || busy}>
                    <legend className="sr-only">Choose an answer for question {index + 1}</legend>
                    {question.options.map((option, optionIndex) => {
                      const selected = quiz.submitted ? question.selected_option === optionIndex : answers[question.id] === optionIndex;
                      const correct = quiz.submitted && question.correct_option === optionIndex;
                      return (
                        <label key={optionIndex} className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm ${correct ? "border-green-600 bg-green-950/20" : ""} ${quiz.submitted && selected && !correct ? "border-destructive bg-destructive/10" : ""}`}>
                          <input type="radio" name={`question-${question.id}`} value={optionIndex} checked={selected}
                            onChange={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))}
                            className="mt-0.5 accent-primary" />
                          <span>{option}</span>
                        </label>
                      );
                    })}
                  </fieldset>
                  {quiz.submitted ? (
                    <div className="space-y-1 border-t pt-3 text-sm">
                      <p className={question.is_correct ? "font-medium text-green-600" : "font-medium text-destructive"}>
                        {question.is_correct ? "Correct" : `Correct answer: ${question.options[question.correct_option ?? 0]}`}
                      </p>
                      {question.explanation ? <p className="text-muted-foreground">{question.explanation}</p> : null}
                      {question.source_doc ? <p className="text-muted-foreground">Source: {question.source_doc}, page {question.source_page ?? 1}</p> : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
            {quiz.submitted ? (
              <Button type="button" variant="outline" onClick={() => void handleGenerate()} disabled={busy}>
                <RotateCcw /> Generate Another Quiz
              </Button>
            ) : (
              <Button type="button" onClick={() => void handleSubmit()} disabled={busy || Object.keys(answers).length !== quiz.questions.length}>
                {busy ? <LoaderCircle className="animate-spin" /> : null} Submit Quiz
              </Button>
            )}
          </div>
        ) : !loading && quizzes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
            <SquareCheckBig className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No quizzes yet</p>
            <p className="text-sm text-muted-foreground">Upload documents, then generate a quiz to start practicing.</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
