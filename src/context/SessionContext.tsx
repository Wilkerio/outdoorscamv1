  import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import type { Point, PointStatus, LogEntry, PhotoAdjustment } from "@/lib/outdoorscan/types";
 import { GMAPS_KEY } from "@/lib/outdoorscan/streetview";
 import { fetchNearbyPois, estimateAudience, poiCounts } from "@/lib/outdoorscan/audience";
 import { supabase } from "@/integrations/supabase/client";
 import ExcelJS from "exceljs";

type Phase = "idle" | "running" | "paused" | "done";

const STORAGE_KEY = "outdoorscan:session:v1";

 interface SessionState {
  points: Point[];
  logs: LogEntry[];
  phase: Phase;
   currentIndex: number;
   log: (level: LogEntry["level"], message: string) => void;
    salvarFotoSupabase: (cod: string, url: string, applyFilter?: boolean) => Promise<string>;
    corrigirComIA: (ponto: Point) => Promise<void>;
    calcularAudiencia: (ponto: Point) => Promise<void>;
  setPoints: (p: Point[], sheetName?: string, colunasOriginais?: string[]) => void;
  exportarExcel: () => Promise<void>;
   start: () => void;
   pause: () => void;
   resume: () => void;
   reset: () => void;
   setAdjustedPhoto: (id: string, adj: PhotoAdjustment) => void;
    salvarProgresso: () => void;
    toggleExcluido: (id: string) => void;
    editarPonto: (id: string, patch: Partial<Point>) => void;
    ultimoSalvamento: number | null;
    stats: { sucesso: number; erro: number; semCobertura: number; total: number };
}

// Preset padrão do modal "Ajustar foto" (brilho/contraste/saturação).
async function aplicarFiltroPadrao(base64Jpeg: string): Promise<Blob> {
  const img = new Image();
  img.src = `data:image/jpeg;base64,${base64Jpeg}`;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Falha ao decodificar imagem"));
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.filter = "brightness(90%) contrast(136%) saturate(151%)";
  ctx.drawImage(img, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) throw new Error("Falha ao gerar imagem com filtro");
  return blob;
}

const Ctx = createContext<SessionState | null>(null);

 export function SessionProvider({ children }: { children: ReactNode }) {
   const [points, setPointsState] = useState<Point[]>([]);
  const [sheetName, setSheetName] = useState<string>("Planilha1");
  const [colunasOriginais, setColunasOriginais] = useState<string[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [ultimoSalvamento, setUltimoSalvamento] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;

  // Restaurar progresso ao montar
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved.points)) {
          // Pontos que estavam "PROCESSANDO" voltam a "AGUARDANDO"
          const restored = saved.points.map((p: Point) =>
            p.status === "PROCESSANDO" ? { ...p, status: "AGUARDANDO" as PointStatus } : p,
          );
          setPointsState(restored);
          if (saved.sheetName) setSheetName(saved.sheetName);
          if (Array.isArray(saved.colunasOriginais)) setColunasOriginais(saved.colunasOriginais);
          if (typeof saved.currentIndex === "number") setCurrentIndex(saved.currentIndex);
          if (saved.ultimoSalvamento) setUltimoSalvamento(saved.ultimoSalvamento);
        }
      }
    } catch (e) {
      console.error("Erro ao restaurar progresso:", e);
    }
    setHydrated(true);
  }, []);

  // Auto-salvar sempre que pontos/sheet/colunas mudam (após hidratação)
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (points.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      const payload = {
        points,
        sheetName,
        colunasOriginais,
        currentIndex,
        ultimoSalvamento,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.error("Erro ao salvar progresso:", e);
    }
  }, [points, sheetName, colunasOriginais, currentIndex, ultimoSalvamento, hydrated]);

  const salvarProgresso = useCallback(() => {
    try {
      const ts = Date.now();
      const payload = {
        points,
        sheetName,
        colunasOriginais,
        currentIndex,
        ultimoSalvamento: ts,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      setUltimoSalvamento(ts);
      setLogs((l) => [
        ...l,
        { id: `${ts}-save`, ts, level: "success", message: "💾 Progresso salvo no navegador." },
      ]);
    } catch (e: any) {
      setLogs((l) => [
        ...l,
        { id: `${Date.now()}-saveerr`, ts: Date.now(), level: "error", message: `Erro ao salvar: ${e.message}` },
      ]);
    }
  }, [points, sheetName, colunasOriginais, currentIndex]);

  const log = useCallback((level: LogEntry["level"], message: string) => {
    setLogs((l) => [...l, { id: `${Date.now()}-${Math.random()}`, ts: Date.now(), level, message }]);
  }, []);

    const updatePoint = useCallback((id: string, patch: Partial<Point>) => {
    setPointsState((arr) => arr.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const toggleExcluido = useCallback((id: string) => {
    setPointsState((arr) => arr.map((p) => (p.id === id ? { ...p, excluido: !p.excluido } : p)));
  }, []);

  const editarPonto = useCallback((id: string, patch: Partial<Point>) => {
    setPointsState((arr) =>
      arr.map((p) => {
        if (p.id !== id) return p;
        const next: Point = { ...p, ...patch };
        // Sincronizar originalData (usado na exportação Excel)
        const od = { ...(p.originalData ?? {}) };
        if (patch.cod !== undefined) od["Cod."] = patch.cod;
        if (patch.endereco !== undefined) od["Endereço"] = patch.endereco;
        if (patch.bairro !== undefined) od["Bairro"] = patch.bairro;
        if (patch.cidade !== undefined) {
          od["Cidade"] = patch.cidade;
          if ("Cidade " in od) od["Cidade "] = patch.cidade;
        }
        if (patch.lat !== undefined) od["Latitude"] = patch.lat;
        if (patch.lng !== undefined) od["Longitude"] = patch.lng;
        if (patch.formato !== undefined) od["Formato"] = patch.formato;
        if (patch.empresa !== undefined) od["Empresa"] = patch.empresa;
        next.originalData = od;
        // Se coordenadas mudaram, invalidar foto salva para regenerar Street View
        const latChanged = patch.lat !== undefined && patch.lat !== p.lat;
        const lngChanged = patch.lng !== undefined && patch.lng !== p.lng;
        if (latChanged || lngChanged) {
          next.foto_url = undefined;
          next.fotoSalva = false;
          next.adjustedPhoto = undefined;
          next.headingSalvo = undefined;
          next.pitchSalvo = undefined;
          next.fovSalvo = undefined;
          next.status = "AGUARDANDO";
        }
        return next;
      }),
    );
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
    const pontosAtivos = points.filter((p) => !p.excluido);
    if (!pontosAtivos.length) {
      log("warn", "Nenhum ponto ativo para exportar.");
      return;
    }
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
      { header: "POIs Próximos (300m)", key: "poi", width: 40 },
      { header: "Fluxo Estimado (pessoas/dia)", key: "audiencia", width: 24 },
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
    pontosAtivos.forEach((ponto, idx) => {
      const row = ws.addRow({
        cod: ponto.originalData?.["Cod."] ?? ponto.cod ?? "",
        endereco: ponto.originalData?.["Endereço"] ?? ponto.endereco ?? "",
        bairro: (ponto.bairro || ponto.originalData?.["Bairro"]) ?? "",
        cidade:
          ponto.originalData?.["Cidade"] ??
          ponto.originalData?.["Cidade "] ??
          ponto.cidade ??
          "",
        lat: Number.isFinite(ponto.lat)
          ? String(ponto.lat).replace(",", ".")
          : String(ponto.originalData?.["Latitude"] ?? "").replace(",", "."),
        lng: Number.isFinite(ponto.lng)
          ? String(ponto.lng).replace(",", ".")
          : String(ponto.originalData?.["Longitude"] ?? "").replace(",", "."),
        formato: ponto.originalData?.["Formato"] ?? ponto.formato ?? "",
        foto: ponto.foto_url || ponto.originalData?.["Foto"] || ponto.foto || "",
        empresa: ponto.originalData?.["Empresa"] ?? ponto.empresa ?? "",
        poi: (ponto.poi ?? []).map((p) => `${p.label} (${p.count})`).join(", "),
        audiencia: ponto.audienceEstimate ?? "",
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

      // Coluna Foto com URL direta
      const fotoCell = row.getCell("foto");
      fotoCell.value = ponto.foto_url || ponto.originalData?.["Foto"] || ponto.foto || "";
      fotoCell.font = { color: { argb: "FF0563C1" }, underline: true };

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


    const verificarOutdoor = useCallback(
      async (base64Image: string) => {
        try {
          const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_DEEPSEEK_API_KEY}`,
            },
            body: JSON.stringify({
              model: "deepseek-vl-1.3b-chat",
              max_tokens: 100,
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "image_url",
                      image_url: { url: `data:image/jpeg;base64,${base64Image}` },
                    },
                    {
                      type: "text",
                      text: `Você é um especialista em identificar outdoors e painéis publicitários em fotos de rua.

              Um OUTDOOR é uma estrutura física instalada na rua com as seguintes características:
              - Placa grande retangular suspensa em postes ou estruturas metálicas
              - Geralmente está acima do nível dos olhos ou no alto de estruturas
              - Contém imagens publicitárias, logotipos, textos ou propagandas
              - Pode ter iluminação própria
              - Tamanho grande, visível à distância
              - Exemplos: painéis de estrada, placas em postes altos, banners em estruturas metálicas

              NÃO é outdoor:
              - Placas de trânsito (pare, velocidade, direção)
              - Fachadas de lojas pequenas
              - Placas de rua com nomes
              - Sinalizações de obras

              Existe um OUTDOOR claramente visível nesta foto?
              Responda APENAS: SIM ou NAO`,
                    },
                  ],
                },
              ],
            }),
          });

          const json = await res.json();
          log("info", `DeepSeek VL: ${JSON.stringify(json).substring(0, 100)}`);
          const resposta = (json.choices?.[0]?.message?.content ?? "").toString().trim().toUpperCase() || "NAO";
          log("info", `${resposta.includes("SIM") ? "✅" : "❌"} DeepSeek: ${resposta}`);
          return { temOutdoor: resposta.includes("SIM"), qualidade: 1 };
        } catch (err: any) {
          log("error", `❌ DeepSeek erro: ${err.message}`);
          return { temOutdoor: false, qualidade: 0 };
        }
      },
      [log]
    );

    const salvarFotoSupabase = useCallback(async (cod: string, url: string, applyFilter = false) => {
     const { data, error } = await supabase.functions.invoke("google-proxy", {
       body: { url },
     });
     if (error || data.error) throw new Error(error?.message || data.error);

     // Mesmo preset padrão usado no modal "Ajustar foto" (brilho/contraste/
     // saturação), aplicado automaticamente nas fotos do processamento em lote
     // pra não depender de ajuste manual ponto a ponto.
     const blob = applyFilter
       ? await aplicarFiltroPadrao(data.image)
       : (() => {
           const byteString = atob(data.image);
           const ab = new ArrayBuffer(byteString.length);
           const ia = new Uint8Array(ab);
           for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
           return new Blob([ab], { type: "image/jpeg" });
         })();

     const fileName = `${cod}_${Date.now()}.jpg`;
     const { error: uploadError } = await supabase.storage.from("imagens-outdoors").upload(fileName, blob, {
       contentType: "image/jpeg",
       upsert: true,
     });
     if (uploadError) throw uploadError;
 
     const { data: urlData } = supabase.storage.from("imagens-outdoors").getPublicUrl(fileName);
     return urlData.publicUrl;
   }, []);
  const calcularAudiencia = useCallback(
    async (p: Point) => {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return;
      try {
        const hits = await fetchNearbyPois(p.lat, p.lng);
        updatePoint(p.id, {
          poi: poiCounts(hits),
          audienceEstimate: estimateAudience(p.lat, p.lng, hits),
          audienceCalculated: true,
        });
      } catch (err: any) {
        log("error", `❌ ${p.cod} — Erro ao calcular fluxo estimado: ${err.message}`);
      }
    },
    [updatePoint, log],
  );

  const processarPonto = useCallback(
    async (p: Point, forceProcess?: boolean) => {
      if (!forceProcess && p.fotoSalva && p.status === "SUCESSO") {
        log("info", `Pulando ${p.cod} (já processado com sucesso)`);
        return;
      }

      const { lat, lng, cod, id } = p;
      const key = GMAPS_KEY;

      updatePoint(id, { status: "PROCESSANDO" });
      log("info", `🔍 ${cod} — Iniciando busca completa...`);

      try {
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
          log("error", `❌ ${cod} — Coordenadas inválidas`);
          updatePoint(id, { status: "ERRO" });
          return;
        }

        if (!p.audienceCalculated) {
          void calcularAudiencia(p);
        }

        // Primeiro verificar se há cobertura básica (via proxy — usa conector Lovable)
        const { data: meta, error: metaErr } = await supabase.functions.invoke("google-proxy", {
          body: { metadata: { location: `${lat},${lng}` } },
        });
        if (metaErr) {
          log("error", `❌ ${cod} — Metadata falhou: ${metaErr.message}`);
          updatePoint(id, { status: "ERRO" });
          return;
        }

        if (meta.status !== "OK") {
          log("warn", `${cod} — ⚠️ Sem cobertura Street View`);
          const staticUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=18&size=640x480&markers=${lat},${lng}&key=${key}`;
          const urlPublica = await salvarFotoSupabase(cod, staticUrl);
          updatePoint(id, { status: "SEM_COBERTURA", foto_url: urlPublica, fotoSalva: true });
          return;
        }

        // Rodadas de busca — cada rodada aumenta o zoom e adiciona mais ângulos
        const rodadas = [
          { angulos: [0, 45, 90, 135, 180, 225, 270, 315], fov: 90, pitch: 0, label: "Rodada 1 — 8 ângulos amplos" },
          { angulos: [22, 67, 112, 157, 202, 247, 292, 337], fov: 72, pitch: 5, label: "Rodada 2 — 8 ângulos intermediários zoom médio" },
          { angulos: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330], fov: 55, pitch: 8, label: "Rodada 3 — 12 ângulos zoom maior" },
          { angulos: [0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300, 320, 340], fov: 40, pitch: 10, label: "Rodada 4 — 18 ângulos zoom máximo" },
        ];

        let melhorHeading: number | null = null;
        let melhorFov = 90;
        let melhorPitch = 0;

        for (const rodada of rodadas) {
          log("info", `${cod} — ${rodada.label}...`);
          let foundInRound = false;

          for (const heading of rodada.angulos) {
            const fotoUrl = `https://maps.googleapis.com/maps/api/streetview?size=640x480&location=${lat},${lng}&heading=${heading}&pitch=${rodada.pitch}&fov=${rodada.fov}&key=${key}`;
            const { data, error } = await supabase.functions.invoke("google-proxy", {
              body: { url: fotoUrl },
            });
            if (error || !data?.image) continue;

            const { temOutdoor } = await verificarOutdoor(data.image);

            if (temOutdoor) {
              melhorHeading = heading;
              melhorFov = rodada.fov;
              melhorPitch = rodada.pitch;
              foundInRound = true;
              break;
            }
            await new Promise((r) => setTimeout(r, 150));
          }

          if (foundInRound) {
            log("success", `${cod} — 🏆 Outdoor encontrado na ${rodada.label}!`);
            break;
          }
        }

        const finalHeading = melhorHeading ?? 0;
        const finalPitch = melhorHeading !== null ? melhorPitch : 0;
        const finalFov = melhorHeading !== null ? melhorFov : 90;
        const statusFinal = melhorHeading !== null ? "SUCESSO" : "SEM_COBERTURA";

        const fotoFinalUrl = `https://maps.googleapis.com/maps/api/streetview?size=640x480&location=${lat},${lng}&heading=${finalHeading}&pitch=${finalPitch}&fov=${finalFov}&key=${key}`;

        if (melhorHeading === null) {
          log("warn", `${cod} — ⚠️ Sem outdoor — salvo visão padrão`);
        } else {
          log("success", `✅ ${cod} — Salvo no ângulo ${finalHeading}° fov=${finalFov}`);
        }

        const urlPublica = await salvarFotoSupabase(cod, fotoFinalUrl, true);
        updatePoint(id, {
          status: statusFinal,
          foto_url: urlPublica,
          fotoSalva: true,
          headingSalvo: finalHeading,
          pitchSalvo: finalPitch,
          fovSalvo: finalFov,
        });
      } catch (err: any) {
        log("error", `❌ ${cod} — Erro: ${err.message}`);
        updatePoint(id, { status: "ERRO" });
      }
    },
    [updatePoint, log, salvarFotoSupabase, verificarOutdoor, calcularAudiencia]
  );

  const corrigirComIA = useCallback(
    async (p: Point) => {
      const pCopy = { ...p, fotoSalva: false };
      return processarPonto(pCopy, true);
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
    setUltimoSalvamento(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
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
        calcularAudiencia,
        exportarExcel,
        salvarProgresso,
        toggleExcluido,
        editarPonto,
        ultimoSalvamento,
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