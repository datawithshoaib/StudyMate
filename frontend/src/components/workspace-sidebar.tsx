"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import {
  BookOpen,
  FolderOpen,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandMark } from "@/components/brand-mark";
import { createWorkspace, deleteWorkspace, renameWorkspace } from "@/lib/api";
import type { Workspace } from "@/lib/types";

type WorkspaceSidebarProps = {
  workspaces: Workspace[];
  selectedId: number | null;
  loading: boolean;
  onSelect: (id: number) => void;
  onChanged: (selectedId?: number) => void;
};

export function WorkspaceSidebar({
  workspaces,
  selectedId,
  loading,
  onSelect,
  onChanged,
}: WorkspaceSidebarProps) {
  const [mode, setMode] = useState<"create" | "rename" | null>(null);
  const [target, setTarget] = useState<Workspace | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Workspace | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function openCreate() {
    setMode("create");
    setTarget(null);
    setName("");
    setError(null);
  }

  function openRename(workspace: Workspace) {
    setMode("rename");
    setTarget(workspace);
    setName(workspace.name);
    setError(null);
  }

  function closeDialog() {
    if (busy) return;
    setMode(null);
    setTarget(null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a workspace name.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (mode === "create") {
        const created = await createWorkspace(trimmed);
        setMode(null);
        onChanged(created.id);
      } else if (mode === "rename" && target) {
        await renameWorkspace(target.id, trimmed);
        setMode(null);
        onChanged(target.id);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save workspace.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await deleteWorkspace(deleteTarget.id);
      setDeleteTarget(null);
      onChanged();
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : "Could not delete workspace.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SidebarHeader className="gap-3 px-4 py-4">
        <div className="flex items-center gap-3">
          <BrandMark className="size-9" />
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="font-heading text-base font-semibold tracking-tight">
              StudyMate
            </span>
            <span className="text-[11px] text-sidebar-foreground/60">
              Learn smarter, together
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2 text-[11px] font-semibold tracking-widest uppercase">
            Workspaces
            {!loading ? (
              <Badge variant="secondary" className="h-4 border-0 px-1.5 text-[10px]">
                {workspaces.length}
              </Badge>
            ) : null}
          </SidebarGroupLabel>
          <SidebarGroupAction aria-label="Create workspace" onClick={openCreate}>
            <Plus />
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              {loading ? (
                <div className="space-y-2 px-2 py-1">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-4/5" />
                </div>
              ) : workspaces.length === 0 ? (
                <div className="mx-1 flex flex-col items-center gap-2 rounded-xl border border-dashed px-3 py-6 text-center">
                  <FolderOpen className="size-5 text-muted-foreground" />
                  <p className="text-xs text-sidebar-foreground/60">
                    No workspaces yet. Create one to get started.
                  </p>
                </div>
              ) : (
                workspaces.map((workspace) => (
                  <SidebarMenuItem key={workspace.id}>
                    <SidebarMenuButton
                      isActive={workspace.id === selectedId}
                      onClick={() => onSelect(workspace.id)}
                      tooltip={workspace.name}
                    >
                      <BookOpen />
                      <span className="truncate">{workspace.name}</span>
                    </SidebarMenuButton>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <SidebarMenuAction
                            showOnHover
                            aria-label={`Options for ${workspace.name}`}
                          />
                        }
                      >
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => openRename(workspace)}>
                          <Pencil />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => {
                            setDeleteError(null);
                            setDeleteTarget(workspace);
                          }}
                        >
                          <Trash2 />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <Dialog
        open={mode !== null}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {mode === "create" ? "New workspace" : "Rename workspace"}
              </DialogTitle>
              <DialogDescription>
                {mode === "create"
                  ? "Create a named space for a subject or course."
                  : "Give this workspace a new name."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-4">
              <Label htmlFor="workspace-name">Name</Label>
              <Input
                id="workspace-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. CS101"
                autoFocus
              />
              {error ? (
                <p role="alert" className="flex items-center gap-1.5 text-sm text-destructive">
                  <TriangleAlert className="size-3.5" />
                  {error}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !name.trim()}>
                {busy ? <LoaderCircle className="animate-spin" /> : null}
                {mode === "create" ? "Create" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              {`“${deleteTarget?.name ?? ""}” and all of its documents, chat, flashcards, quizzes, and summaries will be removed.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
