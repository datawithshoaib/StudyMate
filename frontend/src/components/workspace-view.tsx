"use client";

import {
  FileText,
  MessageCircle,
  NotebookPen,
  Shapes,
  SquareCheckBig,
  Sparkles,
} from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentsPanel } from "@/components/documents-panel";
import { ChatPanel } from "@/components/chat-panel";
import { SummaryNotesPanel } from "@/components/summary-notes-panel";
import { FlashcardsPanel } from "@/components/flashcards-panel";
import { QuizzesPanel } from "@/components/quizzes-panel";
import type { Workspace } from "@/lib/types";

const sections = [
  {
    value: "chat",
    label: "Chat",
    icon: MessageCircle,
  },
  {
    value: "documents",
    label: "Documents",
    icon: FileText,
  },
  {
    value: "flashcards",
    label: "Flashcards",
    icon: Shapes,
  },
  {
    value: "quizzes",
    label: "Quizzes",
    icon: SquareCheckBig,
  },
  {
    value: "summaries",
    label: "Summary Notes",
    icon: NotebookPen,
  },
];

export function WorkspaceView({ workspace }: { workspace: Workspace }) {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="relative overflow-hidden rounded-2xl border bg-card px-5 py-6 shadow-sm sm:px-7 sm:py-7">
        <div className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-primary uppercase">
              <Sparkles className="size-3.5" />
              Study workspace
            </div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              {workspace.name}
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              Chat with your documents, then turn what you learn into flashcards, quizzes, and notes.
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="chat" className="gap-5">
        <TabsList className="h-11 w-fit max-w-full flex-wrap gap-1 overflow-x-auto rounded-xl p-1 sm:flex-nowrap">
          {sections.map((section) => (
            <TabsTrigger
              key={section.value}
              value={section.value}
              className="h-9 gap-2 rounded-lg px-3 text-sm data-active:shadow-sm"
            >
              <section.icon className="size-4" />
              {section.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {sections.map((section) => (
          <TabsContent key={section.value} value={section.value}>
            {section.value === "chat" ? (
              <ChatPanel key={workspace.id} workspaceId={workspace.id} />
            ) : section.value === "documents" ? (
              <DocumentsPanel key={workspace.id} workspaceId={workspace.id} />
            ) : section.value === "summaries" ? (
              <SummaryNotesPanel key={workspace.id} workspaceId={workspace.id} />
            ) : section.value === "flashcards" ? (
              <FlashcardsPanel key={workspace.id} workspaceId={workspace.id} />
            ) : (
              <QuizzesPanel key={workspace.id} workspaceId={workspace.id} />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
