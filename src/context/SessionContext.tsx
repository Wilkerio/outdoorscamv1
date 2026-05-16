 import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import type { Point, PointStatus, LogEntry, PhotoAdjustment } from "@/lib/outdoorscan/types";
 import { GMAPS_KEY } from "@/lib/outdoorscan/streetview";
 import { supabase } from "@/integrations/supabase/client";
 import ExcelJS from "exceljs";

type Phase = "idle" | "running" | "paused" | "done";

 interface SessionState {
  points: Point[];
  logs: LogEntry[];
  phase: Phase;
   currentIndex: number;
   log: (level: LogEntry["level"], message: string) => void;
    salvarFotoSupabase: (cod: string, url: string) => Promise<string>;
    corrigirComIA: (ponto: Point) => Promise<void>;
  setPoints: (p: Point[], sheetName?: string, colunasOriginais?: string[]) => void;
  exportarExcel: () => Promise<void>;
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
  const [sheetName, setSheetName] = useState<string>("Planilha1");
  const [colunasOriginais, setColunasOriginais] = useState<string[]>([]);
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

   const setPoints = useCallback((p: Point[], name?: string, cols?: string[]) => {
     setPointsState(p);
     if (name) setSheetName(name);
     if (cols) setColunasOriginais(cols);
     setPhase("idle");
     setCurrentIndex(0);
   }, []);

  const exportarExcel = useCallback(async () => {
    if (typeof window === "undefined" || !points.length) return;
    const nome = window.prompt("Nome do arquivo:") || "OutdoorScan_resultado";
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(sheetName || "Book");

    // Definir colunas com larguras adequadas
    ws.columns = [
      { header: "Cod.", key: "cod", width: 12 },
      { header: "Endereço", key: "endereco", width: 40 },
      { header: "Bairro", key: "bairro", width: 18 },
      { header: "Cidade", key: "cidade", width: 15 },
      { header: "Latitude", key: "lat", width: 15 },
      { header: "Longitude", key: "lng", width: 15 },
      { header: "Formato", key: "formato", width: 12 },
      { header: "Foto", key: "foto", width: 50 },
      { header: "Empresa", key: "empresa", width: 20 },
    ];

    // Estilizar cabeçalho
    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1E3A5F" },
      };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
    });
    headerRow.height = 25;

    // Adicionar dados
    points.forEach((ponto, idx) => {
      const row = ws.addRow({
        cod: ponto.originalData?.["Cod."] ?? ponto.cod ?? "",
        endereco: ponto.originalData?.["Endereço"] ?? ponto.endereco ?? "",
        bairro: ponto.originalData?.["Bairro"] ?? ponto.bairro ?? "",
        cidade:
          ponto.originalData?.["Cidade"] ??
          ponto.originalData?.["Cidade "] ??
          ponto.cidade ??
          "",
        lat: ponto.originalData?.["Latitude"] ?? ponto.lat ?? "",
        lng: ponto.originalData?.["Longitude"] ?? ponto.lng ?? "",
        formato: ponto.originalData?.["Formato"] ?? ponto.formato ?? "",
        foto: ponto.foto_url || "",
        empresa: ponto.originalData?.["Empresa"] ?? ponto.empresa ?? "",
      });

      // Cor alternada nas linhas
      const bgColor = idx % 2 === 0 ? "FFF5F8FF" : "FFFFFFFF";
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: bgColor },
        };
        cell.alignment = { vertical: "middle", wrapText: false };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE0E0E0" } },
          bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
          left: { style: "thin", color: { argb: "FFE0E0E0" } },
          right: { style: "thin", color: { argb: "FFE0E0E0" } },
        };
      });

      // Coluna Foto como hyperlink azul
      if (ponto.foto_url) {
        const fotoCell = row.getCell("foto");
        fotoCell.value = { text: "Ver Foto", hyperlink: ponto.foto_url };
        fotoCell.font = { color: { argb: "FF0563C1" }, underline: true };
      }

      row.height = 20;
    });

    // Congelar linha do cabeçalho
    ws.views = [{ state: "frozen", ySplit: 1 }];

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nome}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }, [points, sheetName]);


    const verificarOutdoorDeepSeek = useCallback(async (base64Image: string) => {
      try {
        const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
        if (!apiKey || apiKey === "YOUR_KEY_HERE") {
          throw new Error("Chave DeepSeek não configurada.");
        }

        const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'deepseek-vl2',
            max_tokens: 10,
            messages: [{
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
                { type: 'text', text: 'Esta foto de rua contém um outdoor, painel publicitário ou anúncio visível? Responda apenas: SIM ou NAO' }
              ]
            }]
          })
        }).then(r => r.json());

        return res.choices?.[0]?.message?.content?.toUpperCase().includes('SIM');
      } catch (err) {
        console.error("Erro DeepSeek:", err);
        return false;
      }
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
      if (p.fotoSalva && p.status === "SUCESSO") {
        log("info", `Pulando ${p.cod} (já processado com sucesso)`);
        return;
      }

      const { lat, lng, cod, id } = p;
      const key = GMAPS_KEY;

      try {
        updatePoint(id, { status: "PROCESSANDO" });
        log("info", `🔍 ${cod} — Buscando melhor ângulo com IA...`);

        if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
          log("error", `❌ ${cod} — Coordenadas inválidas`);
          updatePoint(id, { status: "ERRO" });
          return;
        }

        // Primeiro verificar se há cobertura básica
        const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&key=${key}`;
        const metaRes = await fetch(metaUrl);
        const meta = await metaRes.json();

        if (meta.status !== "OK") {
          log("warn", `${cod} — Sem cobertura Street View, usando Static Map fallback`);
          const fotoUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=18&size=640x480&markers=${lat},${lng}&key=${key}`;
          const urlPublica = await salvarFotoSupabase(cod, fotoUrl);
          updatePoint(id, {
            status: "SEM_COBERTURA",
            foto_url: urlPublica,
            fotoSalva: true,
            headingSalvo: 0,
            pitchSalvo: 0,
            fovSalvo: 80,
          });
          return;
        }

        // Fluxo com IA: testar 8 ângulos
        const angulos = [0, 45, 90, 135, 180, 225, 270, 315];
        let melhorUrl = "";
        let melhorHeading = 0;

        for (const heading of angulos) {
          const fotoUrl = `https://maps.googleapis.com/maps/api/streetview?size=640x480&location=${lat},${lng}&heading=${heading}&pitch=0&fov=80&key=${key}`;
          
          const { data, error } = await supabase.functions.invoke("google-proxy", {
            body: { url: fotoUrl },
          });

          if (error || !data?.image) {
            log("warn", `${cod} — Erro ao carregar ângulo ${heading}°`);
            continue;
          }

          const temOutdoor = await verificarOutdoorDeepSeek(data.image);
          log("info", `${cod} — ${heading}°: ${temOutdoor ? "✅ Outdoor!" : "❌"}`);

          if (temOutdoor) {
            melhorUrl = fotoUrl;
            melhorHeading = heading;
            break;
          }
          if (!melhorUrl) {
            melhorUrl = fotoUrl;
            melhorHeading = heading;
          }
        }

        const urlPublica = await salvarFotoSupabase(cod, melhorUrl);
        updatePoint(id, {
          status: "SUCESSO",
          foto_url: urlPublica,
          fotoSalva: true,
          headingSalvo: melhorHeading,
          pitchSalvo: 0,
          fovSalvo: 80,
        });
        log("success", `✅ ${cod} — Salvo no ângulo ${melhorHeading}°`);
      } catch (err: any) {
        updatePoint(id, { status: "ERRO" });
        log("error", `❌ ${cod} — Erro: ${err.message}`);
      }
    },
    [updatePoint, log, salvarFotoSupabase, verificarOutdoorDeepSeek]
  );

  const corrigirComIA = useCallback(
    async (p: Point) => {
      const pCopy = { ...p, fotoSalva: false };
      return processarPonto(pCopy);
    },
    [processarPonto]
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
    log("info", "Processamento iniciado ✅");
    void runFrom(0);
  }, [points.length, runFrom, log]);

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
        updatePoint(id, {
          adjustedPhoto: adj,
          foto_url: adj.url,
          fotoSalva: true,
          headingSalvo: adj.heading,
          pitchSalvo: adj.pitch,
          fovSalvo: adj.fov,
        });
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
        corrigirComIA,
        exportarExcel,
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