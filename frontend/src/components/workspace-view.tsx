"use client";

import {
  FileText,
  MessageCircle,
  NotebookPen,
  Shapes,
  SquareCheckBig,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentsPanel } from "@/components/documents-panel";
import type { Workspace } from "@/lib/types";

const sections = [
  {
    value: "chat",
    label: "Chat",
    icon: MessageCircle,
    description: "Ask questions grounded in your documents.",
  },
  {
    value: "documents",
    label: "Documents",
    icon: FileText,
    description: "Upload and manage your study materials.",
  },
  {
    value: "flashcards",
    label: "Flashcards",
    icon: Shapes,
    description: "Review key ideas with flip-and-rate cards.",
  },
  {
    value: "quizzes",
    label: "Quizzes",
    icon: SquareCheckBig,
    description: "Test yourself with multiple-choice practice.",
  },
  {
    value: "summaries",
    label: "Summary Notes",
    icon: NotebookPen,
    description: "Scan structured notes for each document.",
  },
];

export function WorkspaceView({ workspace }: { workspace: Workspace }) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{workspace.name}</h1>
        <p className="text-sm text-muted-foreground">Study workspace</p>
      </div>

      <Tabs defaultValue="chat">
        <TabsList>
          {sections.map((section) => (
            <TabsTrigger key={section.value} value={section.value}>
              <section.icon />
              {section.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {sections.map((section) => (
          <TabsContent key={section.value} value={section.value}>
            {section.value === "documents" ? (
              <DocumentsPanel key={workspace.id} workspaceId={workspace.id} />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>{section.label}</CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  This section is coming soon.
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
