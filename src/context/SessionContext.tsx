import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import type { Point, PointStatus, LogEntry, PhotoAdjustment } from "@/lib/outdoorscan/types";
import { streetViewMetadata } from "@/lib/outdoorscan/streetview";

type Phase = "idle" | "running" | "paused" | "done";

interface SessionState {
  points: Point[];
  logs: LogEntry[];
  phase: Phase;
  currentIndex: number;
  setPoints: (p: Point[]) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  setAdjustedPhoto: (id: string, adj: PhotoAdjustment) => void;
  stats: { sucesso: number; erro: number; semCobertura: number; total: number };
}

const Ctx = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [points, setPointsState] = useState<Point[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [currentIndex, setCurrentIndex] = useState(0);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;

  const log = useCallback((level: LogEntry["level"], message: string) => {
    setLogs((l) => [...l, { id: `${Date.now()}-${Math.random()}`, ts: Date.now(), level, message }]);
  }, []);

  const updatePoint = useCallback((id: string, patch: Partial<Point>) => {
    setPointsState((arr) => arr.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const setPoints = useCallback((p: Point[]) => {
    setPointsState(p);
    setLogs([{ id: `${Date.now()}`, ts: Date.now(), level: "info", message: `${p.length} ponto(s) carregado(s) da planilha.` }]);
    setPhase("idle");
    setCurrentIndex(0);
  }, []);

  const checkPoint = useCallback(async (point: Point): Promise<PointStatus> => {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return "ERRO";
    try {
      const res = await fetch(streetViewMetadata(point.lat, point.lng));
      const data = await res.json();
      if (data.status === "OK") return "SUCESSO";
      if (data.status === "ZERO_RESULTS" || data.status === "NOT_FOUND") return "SEM_COBERTURA";
      return "ERRO";
    } catch {
      return "ERRO";
    }
  }, []);

  const runFrom = useCallback(
    async (startIdx: number) => {
      setPhase("running");
      phaseRef.current = "running";
      const snapshot = points;
      for (let i = startIdx; i < snapshot.length; i++) {
        // wait while paused
        while (phaseRef.current === "paused") {
          await new Promise((r) => setTimeout(r, 200));
        }
        if (phaseRef.current === "idle") return;
        setCurrentIndex(i);
        const p = snapshot[i];
        updatePoint(p.id, { status: "PROCESSANDO" });
        log("info", `Processando ${p.cod} — ${p.endereco}`);
        const status = await checkPoint(p);
        updatePoint(p.id, { status });
        if (status === "SUCESSO") log("success", `✓ ${p.cod} — cobertura encontrada`);
        else if (status === "SEM_COBERTURA") log("warn", `⚠ ${p.cod} — sem cobertura Street View`);
        else log("error", `✗ ${p.cod} — erro ao verificar`);
        await new Promise((r) => setTimeout(r, 250));
      }
      setPhase("done");
      log("info", "Processamento concluído.");
    },
    [points, updatePoint, log, checkPoint],
  );

  const start = useCallback(() => {
    if (!points.length) return;
    void runFrom(0);
  }, [points.length, runFrom]);

  const pause = useCallback(() => {
    setPhase("paused");
    log("info", "Processamento pausado.");
  }, [log]);

  const resume = useCallback(() => {
    if (phaseRef.current === "paused") {
      setPhase("running");
      log("info", "Processamento retomado.");
    }
  }, [log]);

  const reset = useCallback(() => {
    setPhase("idle");
    setPointsState([]);
    setLogs([]);
    setCurrentIndex(0);
  }, []);

  const setAdjustedPhoto = useCallback(
    (id: string, adj: PhotoAdjustment) => {
      updatePoint(id, { adjustedPhoto: adj });
      log("success", `Foto ajustada salva para ponto ${id}`);
    },
    [updatePoint, log],
  );

  const total = points.length;
  const sucesso = points.filter((p) => p.status === "SUCESSO").length;
  const erro = points.filter((p) => p.status === "ERRO").length;
  const semCobertura = points.filter((p) => p.status === "SEM_COBERTURA").length;

  return (
    <Ctx.Provider
      value={{
        points,
        logs,
        phase,
        currentIndex,
        setPoints,
        start,
        pause,
        resume,
        reset,
        setAdjustedPhoto,
        stats: { sucesso, erro, semCobertura, total },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession must be inside SessionProvider");
  return v;
}