import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import type { Point, PointStatus, LogEntry, PhotoAdjustment } from "@/lib/outdoorscan/types";
 import { GMAPS_KEY } from "@/lib/outdoorscan/streetview";
 import { supabase } from "@/integrations/supabase/client";

type Phase = "idle" | "running" | "paused" | "done";

interface SessionState {
  points: Point[];
  logs: LogEntry[];
  phase: Phase;
   currentIndex: number;
   log: (level: LogEntry["level"], message: string) => void;
   salvarFotoSupabase: (cod: string, url: string) => Promise<string>;
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
     setPhase("idle");
     setCurrentIndex(0);
   }, []);

   const salvarFotoSupabase = useCallback(async (cod: string, url: string) => {
     const { data, error } = await supabase.functions.invoke("google-proxy", {
       body: { url },
     });
     if (error || data.error) throw new Error(error?.message || data.error);
 
     const byteString = atob(data.image);
     const ab = new ArrayBuffer(byteString.length);
     const ia = new Uint8Array(ab);
     for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
     const blob = new Blob([ab], { type: "image/jpeg" });
 
     const fileName = `${cod}_${Date.now()}.jpg`;
     const { error: uploadError } = await supabase.storage.from("imagens-outdoors").upload(fileName, blob, {
       contentType: "image/jpeg",
       upsert: true,
     });
     if (uploadError) throw uploadError;
 
     const { data: urlData } = supabase.storage.from("imagens-outdoors").getPublicUrl(fileName);
     return urlData.publicUrl;
   }, []);
 
   const processarPonto = useCallback(
     async (p: Point) => {
       if (p.fotoSalva) {
         log("info", `Pulando ${p.cod} (foto já salva)`);
         return;
       }
 
        const { lat, lng, cod, id, rawLat, rawLng } = p;
       const key = GMAPS_KEY;
 
       try {
         updatePoint(id, { status: "PROCESSANDO" });
         log("info", `Processando ${cod}...`);
          log("info", `${cod} — Bruto: Lat ${rawLat} | Lng ${rawLng}`);
          log("info", `${cod} — Normalizado: Lat ${lat} | Lng ${lng}`);

          if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
            log("error", `❌ ${cod} — Coordenadas inválidas: ${rawLat}, ${rawLng}`);
            updatePoint(id, { status: "ERRO" });
            return;
          }

          log("info", `${cod} — URL metadata: https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&key=${key}`);
 
         const metaRes = await fetch(
           `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&key=${key}`,
         );
         const meta = await metaRes.json();
          log("info", `${cod} — Resposta metadata: ${JSON.stringify(meta)}`);
 
         let fotoUrl;
         let statusFinal: PointStatus;
 
         if (meta.status === "OK") {
           const dLng = lng - meta.location.lng;
           const dLat = lat - meta.location.lat;
           const heading = Math.round(((Math.atan2(dLng, dLat) * 180) / Math.PI + 360) % 360);
 
           fotoUrl = `https://maps.googleapis.com/maps/api/streetview?size=640x480&location=${lat},${lng}&heading=${heading}&pitch=0&fov=80&key=${key}`;
           statusFinal = "SUCESSO";
         } else {
           fotoUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=18&size=640x480&markers=${lat},${lng}&key=${key}`;
           statusFinal = "SEM_COBERTURA";
         }
 
         const urlPublica = await salvarFotoSupabase(cod, fotoUrl);
         updatePoint(id, { status: statusFinal, foto_url: urlPublica, fotoSalva: true });
         log(statusFinal === "SUCESSO" ? "success" : "warn", `✅ ${cod} — ${statusFinal}`);
       } catch (err: any) {
         updatePoint(id, { status: "ERRO" });
         log("error", `❌ ${cod} — Erro: ${err.message}`);
       }
     },
     [updatePoint, log, salvarFotoSupabase],
   );
 
   const runFrom = useCallback(
     async (startIdx: number) => {
       setPhase("running");
       phaseRef.current = "running";
       const snapshot = points;
 
       for (let i = startIdx; i < snapshot.length; i += 5) {
         const batch = snapshot.slice(i, i + 5);
 
         while ((phaseRef.current as Phase) === "paused") {
           await new Promise((r) => setTimeout(r, 200));
         }
         if ((phaseRef.current as Phase) === "idle") return;
 
         setCurrentIndex(i);
         await Promise.all(batch.map((p) => processarPonto(p)));
 
         if (i + 5 < snapshot.length) {
           await new Promise((r) => setTimeout(r, 300));
         }
       }
 
       setPhase("done");
       log("info", "Processamento concluído.");
     },
     [points, processarPonto, log],
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
       updatePoint(id, { adjustedPhoto: adj, foto_url: adj.url, fotoSalva: true });
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
        log,
        phase,
        currentIndex,
        setPoints,
        start,
        pause,
        resume,
        reset,
         setAdjustedPhoto,
         salvarFotoSupabase,
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