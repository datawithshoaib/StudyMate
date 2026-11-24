"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, FolderOpen, RefreshCw } from "lucide-react";

import { WorkspaceSidebar } from "@/components/workspace-sidebar";
import { WorkspaceView } from "@/components/workspace-view";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandMark } from "@/components/brand-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { listWorkspaces } from "@/lib/api";
import type { Workspace } from "@/lib/types";

export default function Home() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (preferredId?: number) => {
    try {
      const items = await listWorkspaces();
      setWorkspaces(items);
      setSelectedId((current) => {
        if (preferredId && items.some((item) => item.id === preferredId)) {
          return preferredId;
        }
        if (current && items.some((item) => item.id === current)) {
          return current;
        }
        return items[0]?.id ?? null;
      });
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load workspaces.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    listWorkspaces()
      .then((items) => {
        if (!active) return;
        setWorkspaces(items);
        setSelectedId(items[0]?.id ?? null);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Could not load workspaces.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selected = workspaces.find((workspace) => workspace.id === selectedId) ?? null;

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <WorkspaceSidebar
          workspaces={workspaces}
          selectedId={selectedId}
          loading={loading}
          onSelect={setSelectedId}
          onChanged={(id) => {
            setLoading(true);
            void reload(id);
          }}
        />
      </Sidebar>
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-xl sm:px-6">
          <SidebarTrigger className="-ml-1" />
          <div className="hidden h-5 w-px bg-border sm:block" />
          <div className="flex items-center gap-2.5">
            <BrandMark className="size-8 rounded-lg sm:hidden" />
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight">StudyMate</p>
              <p className="text-[11px] text-muted-foreground">AI study workspace</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {!loading && !error ? (
              <Badge variant="secondary" className="hidden sm:inline-flex">
                {workspaces.length} {workspaces.length === 1 ? "workspace" : "workspaces"}
              </Badge>
            ) : null}
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          {error ? (
            <div className="p-4 sm:p-6">
              <Card className="mx-auto max-w-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="size-5 text-destructive" />
                    Could not load workspaces
                  </CardTitle>
                  <CardDescription>{error}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" onClick={() => void reload()}>
                    <RefreshCw />
                    Retry
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : selected ? (
            <WorkspaceView workspace={selected} />
          ) : (
            <div className="p-4 sm:p-6">
              <Empty className="mx-auto max-w-lg border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FolderOpen />
                  </EmptyMedia>
                  <EmptyTitle>No workspace selected</EmptyTitle>
                  <EmptyDescription>
                    Create a workspace from the sidebar to start studying.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
