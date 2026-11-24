import { GraduationCap } from "lucide-react";

import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/25 ring-1 ring-white/20",
        className,
      )}
    >
      <GraduationCap className="size-[55%]" strokeWidth={2.2} />
    </span>
  );
}
