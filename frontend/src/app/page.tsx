"use client";

import { useCallback, useEffect, useState } from "react";

import { WorkspaceSidebar } from "@/components/workspace-sidebar";
import { WorkspaceView } from "@/components/workspace-view";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <span className="text-sm font-medium">StudyMate</span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          {error ? (
            <div className="p-6">
              <Card>
                <CardHeader>
                  <CardTitle>Could not load workspaces</CardTitle>
                  <CardDescription>{error}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" onClick={() => void reload()}>
                    Retry
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : selected ? (
            <WorkspaceView workspace={selected} />
          ) : (
            <div className="p-6">
              <Card>
                <CardHeader>
                  <CardTitle>No workspace selected</CardTitle>
                  <CardDescription>
                    Create a workspace from the sidebar to start studying.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
