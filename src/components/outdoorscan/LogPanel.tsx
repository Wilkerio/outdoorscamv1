import { useEffect, useRef } from "react";
import { useSession } from "@/context/SessionContext";

const LEVEL_COLOR = {
  info: "text-muted-foreground",
  warn: "text-warning",
  error: "text-destructive",
  success: "text-success",
} as const;

export function LogPanel() {
  const { logs } = useSession();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current.scrollTo({ top: ref.current.scrollHeight });
  }, [logs.length]);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="px-4 py-2 border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
        Log do sistema
      </div>
      <div ref={ref} className="h-48 overflow-y-auto p-3 font-mono text-xs space-y-1">
        {logs.length === 0 && <div className="text-muted-foreground">Aguardando início…</div>}
        {logs.map((l) => (
          <div key={l.id} className={LEVEL_COLOR[l.level]}>
            <span className="text-muted-foreground/60">
              [{new Date(l.ts).toLocaleTimeString()}]
            </span>{" "}
            {l.message}
          </div>
        ))}
      </div>
    </div>
  );
}