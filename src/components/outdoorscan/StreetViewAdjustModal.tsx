import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Save, Loader2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import type { Point } from "@/lib/outdoorscan/types";
import { GMAPS_KEY, streetViewImg } from "@/lib/outdoorscan/streetview";
import { useSession } from "@/context/SessionContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function loadGoogleMapsApi(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).google?.maps?.StreetViewPanorama) {
      resolve();
      return;
    }
    if (document.getElementById('gmaps-js')) {
      const interval = setInterval(() => {
        if ((window as any).google?.maps?.StreetViewPanorama) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
      return;
    }
    const script = document.createElement('script');
    script.id = 'gmaps-js';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Falha ao carregar Maps API'));
    document.head.appendChild(script);
  });
}

function fovToZoom(fov: number): number {
  return Math.log2(180 / fov);
}

function zoomToFov(zoom: number): number {
  return Math.round(180 / Math.pow(2, zoom));
}

export function StreetViewAdjustModal({
  open,
  onOpenChange,
  point,
  onPrev,
  onNext,
  position,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  point: Point;
  onPrev?: () => void;
  onNext?: () => void;
  position?: { current: number; total: number };
}) {
  const { setAdjustedPhoto, salvarFotoSupabase, log } = useSession();
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const minimizedRef = useRef(false);
  const toastIdRef = useRef<string | number | null>(null);
  const codRef = useRef(point.cod);
  useEffect(() => { codRef.current = point.cod; }, [point.cod]);

  const updateProgress = (pct: number) => {
    setSaveProgress(pct);
    if (minimizedRef.current && toastIdRef.current != null) {
      toast.loading(`Salvando foto do item ${codRef.current}... ${pct}%`, {
        id: toastIdRef.current,
        duration: Infinity,
      });
    }
  };

  const handleMinimize = () => {
    minimizedRef.current = true;
    toastIdRef.current = toast.loading(
      `Salvando foto do item ${codRef.current}... ${saveProgress}%`,
      { duration: Infinity }
    );
    onOpenChange(false);
  };
  const [heading, setHeading] = useState(point.headingSalvo ?? point.adjustedPhoto?.heading ?? 0);
  const [pitch, setPitch] = useState(point.pitchSalvo ?? point.adjustedPhoto?.pitch ?? 0);
  const [fov, setFov] = useState(point.fovSalvo ?? point.adjustedPhoto?.fov ?? 80);

  // Filtros de imagem
  const [brilho, setBrilho] = useState(90);
  const [contraste, setContraste] = useState(136);
  const [saturacao, setSaturacao] = useState(151);
  const QUALIDADE = 10240; // 10K fixo
  const [originalBroken, setOriginalBroken] = useState(false);
  const hasOriginalPhoto = !!(point.foto && point.foto.trim() !== "" && !point.foto.toLowerCase().includes("not found") && point.foto !== "link da imagem nao localizado") && !originalBroken;
  const [showOriginal, setShowOriginal] = useState(hasOriginalPhoto);

  const containerRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<any>(null);
  const [availableYears, setAvailableYears] = useState<{ year: number; panoId: string; date: string }[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setHeading(point.headingSalvo ?? point.adjustedPhoto?.heading ?? 0);
      setPitch(point.pitchSalvo ?? point.adjustedPhoto?.pitch ?? 0);
      setFov(point.fovSalvo ?? point.adjustedPhoto?.fov ?? 80);
    }
  }, [open, point.id, point.headingSalvo, point.pitchSalvo, point.fovSalvo]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const init = () => {
      if (cancelled || !containerRef.current) return;
      const { offsetWidth, offsetHeight } = containerRef.current;
      if (offsetWidth === 0 || offsetHeight === 0) {
        requestAnimationFrame(init);
        return;
      }
      loadGoogleMapsApi(import.meta.env.VITE_GOOGLE_MAPS_API_KEY)
        .then(() => {
          if (cancelled || !containerRef.current) return;
          const pano = new (window as any).google.maps.StreetViewPanorama(
            containerRef.current,
            {
              position: { lat: point.lat, lng: point.lng },
              pov: { heading, pitch },
              zoom: fovToZoom(fov),
              addressControl: false,
              showRoadLabels: false,
              fullscreenControl: false,
              imageDateControl: true,
              motionTracking: false,
              motionTrackingControl: false,
            }
          );
          panoramaRef.current = pano;

          // Buscar panoramas históricos disponíveis no local
          const svService = new (window as any).google.maps.StreetViewService();
          const loadHistory = (panoId: string) => {
            svService.getPanorama({ pano: panoId }, (data: any, status: any) => {
              if (cancelled) return;
              console.log("[StreetView] status:", status, "time:", data?.time, "data:", data);
              const timeArr = data?.time ?? data?.tiles?.time ?? [];
              if (status === "OK" && timeArr.length) {
                // Cada entry pode ter formato variado. Vasculhamos por Date e por panoId.
                const extract = (t: any): { year: number; panoId: string; date: string } | null => {
                  let d: Date | undefined;
                  let pid: string | undefined;
                  const visit = (v: any) => {
                    if (!v) return;
                    if (v instanceof Date) { if (!d) d = v; return; }
                    if (typeof v === "string") {
                      if (!pid && /^[A-Za-z0-9_-]{20,}$/.test(v)) pid = v;
                      const parsed = new Date(v);
                      if (!d && !isNaN(parsed.getTime()) && parsed.getFullYear() > 2000) d = parsed;
                      return;
                    }
                    if (typeof v === "object") {
                      for (const k of Object.keys(v)) visit(v[k]);
                    }
                  };
                  visit(t);
                  if (!d) return null;
                  const dt: Date = d;
                  return {
                    year: dt.getFullYear(),
                    panoId: pid || "",
                    date: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`,
                  };
                };
                const years = timeArr
                  .map(extract)
                  .filter((y: any): y is { year: number; panoId: string; date: string } => !!y && !isNaN(y.year))
                  .sort((a: any, b: any) => b.year - a.year);
                const seen = new Set<number>();
                const unique = years.filter((y: any) => {
                  if (seen.has(y.year)) return false;
                  seen.add(y.year);
                  return true;
                });
                console.log("[StreetView] anos encontrados:", unique);
                setAvailableYears(unique);
                const current = pano.getPano?.();
                const found = unique.find((y: any) => y.panoId === current);
                setSelectedYear(found ? found.year : (unique[0]?.year ?? null));
              } else {
                console.warn("[StreetView] Nenhum histórico de anos disponível neste ponto.");
              }
            });
          };

          // Buscar histórico imediatamente pela localização (não esperar pano_changed)
          svService.getPanorama(
            { location: { lat: point.lat, lng: point.lng }, radius: 50 },
            (data: any, status: any) => {
              if (cancelled) return;
              const pid = data?.location?.pano;
              if (status === "OK" && pid) {
                loadHistory(pid);
              } else {
                console.warn("[StreetView] getPanorama por location falhou:", status);
              }
            }
          );

          // Também atualizar quando o usuário navegar para outro pano
          (window as any).google.maps.event.addListener(pano, "pano_changed", () => {
            const pid = pano.getPano?.();
            if (pid) loadHistory(pid);
          });
        })
        .catch(console.error);
    };

    requestAnimationFrame(init);

    return () => {
      cancelled = true;
      panoramaRef.current = null;
      setAvailableYears([]);
      setSelectedYear(null);
    };
  }, [open]);

  const handleYearChange = (year: number) => {
    const entry = availableYears.find((y) => y.year === year);
    const pano = panoramaRef.current;
    if (!entry || !pano) return;
    setSelectedYear(year);
    const currentPov = pano.getPov?.() ?? { heading, pitch };
    const currentZoom = pano.getZoom?.() ?? fovToZoom(fov);
    pano.setPano(entry.panoId);
    // Restaurar POV/zoom após troca de pano
    setTimeout(() => {
      pano.setPov(currentPov);
      pano.setZoom(currentZoom);
    }, 100);
    log("info", `${point.cod} — Street View ${entry.date}`);
  };

  const save = async () => {
    try {
      setSaving(true);
      updateProgress(5);
      const pano = panoramaRef.current;
      const pov = pano?.getPov();
      const zoom = pano?.getZoom() ?? fovToZoom(fov);
      const realHeading = pov?.heading ?? heading;
      const realPitch = pov?.pitch ?? pitch;
      const realFov = zoomToFov(zoom);

      // Pegar posição/panoId reais do panorama (Google "snapa" para a foto mais próxima)
      const realPos = pano?.getPosition?.();
      const realLat = realPos?.lat?.() ?? point.lat;
      const realLng = realPos?.lng?.() ?? point.lng;
      const realPanoId: string | undefined = pano?.getPano?.() || undefined;

      log("info", `${point.cod} — Salvando foto com filtros: B:${brilho}% C:${contraste}% S:${saturacao}%`);

      const { offsetWidth, offsetHeight } = containerRef.current!;
      // ============================================================
      // Qualidade máxima real: baixar os tiles NATIVOS do panorama do
      // Google (panorama equirectangular completo em alta resolução)
      // e reprojetar para a vista de perspectiva com o heading/pitch/fov
      // selecionados. Bem superior à Static API (limitada a 1280px).
      // ============================================================
      const aspect = offsetWidth / offsetHeight;
      if (!realPanoId) throw new Error("Sem panoId disponível para captura de alta qualidade");

      // 1) Buscar metadados do panorama (originHeading/Pitch, tileSize)
      log("info", `${point.cod} — Baixando panorama nativo...`);
      updateProgress(15);
      const svService = new (window as any).google.maps.StreetViewService();
      const meta: any = await new Promise((resolve, reject) => {
        svService.getPanorama({ pano: realPanoId }, (data: any, status: any) => {
          if (status === "OK") resolve(data);
          else reject(new Error("Falha ao obter metadados do panorama: " + status));
        });
      });
      const tileSize = Number(meta?.tiles?.tileSize?.width ?? 512);
      const originHeadingDeg = Number(meta?.tiles?.originHeading ?? 0) || 0;
      // O preview do Google já entrega o pitch em coordenada visual real.
      // Aplicar originPitch aqui desloca a captura verticalmente, fazendo a foto
      // salva sair mais para cima/baixo do que a área ajustada pelo usuário.
      const originPitchDeg = 0;

      // 2) Definir saída 4K e baixar somente os tiles necessários, em zoom 5
      // quando disponível. Zoom 5 tem o dobro da resolução do zoom 4 anterior,
      // mantendo o ângulo correto sem precisar montar o panorama inteiro na memória.
      // Saída em resolução máxima (10K) para qualidade premium
      const MAX_OUT = QUALIDADE;
      const targetOutW = aspect >= 1 ? MAX_OUT : Math.round(MAX_OUT * aspect);
      const targetOutH = aspect >= 1 ? Math.round(MAX_OUT / aspect) : MAX_OUT;

      const fovRad = (realFov * Math.PI) / 180;
      const verticalFovDeg = (2 * Math.atan(Math.tan(fovRad / 2) * (targetOutH / targetOutW)) * 180) / Math.PI;
      const normalizeDeg = (value: number) => ((value % 360) + 360) % 360;
      const mod = (value: number, size: number) => ((value % size) + size) % size;

      const buildTileSampler = async (zoom: number) => {
        const cols = 1 << zoom;
        const rows = 1 << (zoom - 1);
        const panoW = cols * tileSize;
        const panoH = rows * tileSize;
        const tileData = new Map<string, ImageData>();
        const xs = new Set<number>();
        const ys = new Set<number>();
        const tileStepDeg = 360 / cols;
        const hMargin = Math.max(18, tileStepDeg * 2);
        const vMargin = 16;

        const addX = (headingDeg: number) => {
          const tx = Math.floor((normalizeDeg(headingDeg) / 360) * cols);
          xs.add(mod(tx - 1, cols));
          xs.add(mod(tx, cols));
          xs.add(mod(tx + 1, cols));
        };

        // Nos tiles nativos, originHeading/centerHeading representa a direção
        // do CENTRO horizontal do panorama. Por isso o heading precisa cair em
        // x = 50% quando é igual ao originHeading, não em x = 0%.
        const headingInPano = realHeading - originHeadingDeg + 180;
        const startH = headingInPano - realFov / 2 - hMargin;
        const endH = headingInPano + realFov / 2 + hMargin;
        for (let h = startH; h <= endH; h += tileStepDeg / 2) addX(h);
        addX(endH);

        const pitchInPano = realPitch - originPitchDeg;
        const minPitch = Math.max(-89.9, pitchInPano - verticalFovDeg / 2 - vMargin);
        const maxPitch = Math.min(89.9, pitchInPano + verticalFovDeg / 2 + vMargin);
        const yFromPitch = (pitchDeg: number) => panoH / 2 - (pitchDeg / 180) * panoH;
        const yStart = Math.max(0, Math.floor(yFromPitch(maxPitch) / tileSize) - 1);
        const yEnd = Math.min(rows - 1, Math.floor(yFromPitch(minPitch) / tileSize) + 1);
        for (let ty = yStart; ty <= yEnd; ty++) ys.add(ty);

        const scratch = document.createElement("canvas");
        scratch.width = tileSize;
        scratch.height = tileSize;
        const scratchCtx = scratch.getContext("2d", { willReadFrequently: true })!;
        const tasks: Promise<void>[] = [];

        xs.forEach((tx) => ys.forEach((ty) => {
          const tileUrl =
            `https://streetviewpixels-pa.googleapis.com/v1/tile?cb_client=maps_sv.tactile` +
            `&panoid=${encodeURIComponent(realPanoId)}&x=${tx}&y=${ty}&zoom=${zoom}&nbt=1&fover=2`;
          tasks.push((async () => {
            try {
              const { data, error } = await supabase.functions.invoke("google-proxy", { body: { url: tileUrl } });
              if (error || !data?.image) return;
              const img = new Image();
              img.crossOrigin = "anonymous";
              img.src = `data:image/jpeg;base64,${data.image}`;
              await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
              scratchCtx.clearRect(0, 0, tileSize, tileSize);
              scratchCtx.drawImage(img, 0, 0, tileSize, tileSize);
              tileData.set(`${tx},${ty}`, scratchCtx.getImageData(0, 0, tileSize, tileSize));
            } catch {}
          })());
        }));

        await Promise.all(tasks);
        const total = xs.size * ys.size;
        log("info", `${point.cod} — Tiles zoom ${zoom}: ${tileData.size}/${total} (panorama ${panoW}x${panoH})`);

        const readIndex = (px: number, py: number) => {
          const safeX = mod(Math.floor(px), panoW);
          const safeY = Math.max(0, Math.min(panoH - 1, Math.floor(py)));
          const tx = Math.floor(safeX / tileSize);
          const ty = Math.floor(safeY / tileSize);
          const data = tileData.get(`${tx},${ty}`)?.data;
          if (!data) return null;
          const lx = safeX - tx * tileSize;
          const ly = safeY - ty * tileSize;
          return { data, idx: (ly * tileSize + lx) * 4 };
        };

        return {
          zoom,
          panoW,
          panoH,
          complete: tileData.size === total,
          sample(panoX: number, panoY: number) {
            const x0 = Math.floor(panoX);
            const y0 = Math.floor(panoY);
            const x1 = x0 + 1;
            const y1 = Math.min(y0 + 1, panoH - 1);
            const fx = panoX - x0;
            const fy = panoY - y0;
            const p00 = readIndex(x0, y0);
            const p10 = readIndex(x1, y0);
            const p01 = readIndex(x0, y1);
            const p11 = readIndex(x1, y1);
            if (!p00 || !p10 || !p01 || !p11) return [0, 0, 0] as const;
            const r0 = p00.data[p00.idx] + (p10.data[p10.idx] - p00.data[p00.idx]) * fx;
            const r1 = p01.data[p01.idx] + (p11.data[p11.idx] - p01.data[p01.idx]) * fx;
            const g0 = p00.data[p00.idx + 1] + (p10.data[p10.idx + 1] - p00.data[p00.idx + 1]) * fx;
            const g1 = p01.data[p01.idx + 1] + (p11.data[p11.idx + 1] - p01.data[p01.idx + 1]) * fx;
            const b0 = p00.data[p00.idx + 2] + (p10.data[p10.idx + 2] - p00.data[p00.idx + 2]) * fx;
            const b1 = p01.data[p01.idx + 2] + (p11.data[p11.idx + 2] - p01.data[p01.idx + 2]) * fx;
            return [r0 + (r1 - r0) * fy, g0 + (g1 - g0) * fy, b0 + (b1 - b0) * fy] as const;
          }
        };
      };

      // Tenta o maior zoom disponível primeiro (qualidade máxima)
      let sampler = await buildTileSampler(5);
      updateProgress(45);
      if (!sampler.complete) {
        log("info", `${point.cod} — Zoom 5 incompleto, tentando zoom 4.`);
        sampler = await buildTileSampler(4);
        updateProgress(50);
      }
      if (!sampler.complete) throw new Error("Falha ao baixar tiles suficientes para alta qualidade");

      // Não aumentar a imagem acima do detalhe real dos tiles nativos.
      // Upscale artificial (ex: 10K quando o pano só tem ~3.5K naquele FOV)
      // deixa a foto grande, mas visualmente embaçada.
      const nativeMaxW = Math.floor((sampler.panoW * realFov) / 360);
      const realMaxOut = Math.max(2048, Math.min(MAX_OUT, Math.floor(nativeMaxW * 1.08)));
      const outW = aspect >= 1 ? realMaxOut : Math.round(realMaxOut * aspect);
      const outH = aspect >= 1 ? Math.round(realMaxOut / aspect) : realMaxOut;
      if (realMaxOut < MAX_OUT) {
        log("info", `${point.cod} — Limitado para ${outW}x${outH}px reais para evitar imagem embaçada.`);
      }

      // 3) Reprojeção equirectangular → perspectiva

      const persp = document.createElement("canvas");
      persp.width = outW;
      persp.height = outH;
      const perspCtx = persp.getContext("2d")!;

      const outImg = perspCtx.createImageData(outW, outH);
      const outData = outImg.data;

      const f = (outW / 2) / Math.tan(fovRad / 2);
      const headingRad = (realHeading * Math.PI) / 180;
      const pitchRad = (realPitch * Math.PI) / 180;
      const cosH = Math.cos(headingRad), sinH = Math.sin(headingRad);
      const cosP = Math.cos(pitchRad), sinP = Math.sin(pitchRad);
      const cx = outW / 2, cy = outH / 2;
      const TWO_PI = Math.PI * 2;

      for (let y = 0; y < outH; y++) {
        const py = y - cy;
        for (let x = 0; x < outW; x++) {
          const px = x - cx;
          const n = Math.sqrt(px * px + py * py + f * f);
          const dx = px / n, dy = py / n, dz = f / n;
          // pitch (X axis)
          const dy2 = dy * cosP - dz * sinP;
          const dz2 = dy * sinP + dz * cosP;
          // heading (Y axis)
          const dx3 = dx * cosH + dz2 * sinH;
          const dz3 = -dx * sinH + dz2 * cosH;
          const dy3 = dy2;

          const worldHeading = Math.atan2(dx3, dz3);
          const worldPitch = Math.asin(-dy3);

          // Nos tiles do Street View, originHeading/centerHeading fica no
          // CENTRO horizontal do panorama. O +PI coloca esse ângulo em u=0.5,
          // fazendo a imagem salva bater com o ângulo visto no ajuste.
          const headingInPano = worldHeading - (originHeadingDeg * Math.PI) / 180 + Math.PI;
          const pitchInPano = worldPitch - (originPitchDeg * Math.PI) / 180;
          let u = headingInPano / TWO_PI;
          u = u - Math.floor(u);
          let panoX = u * sampler.panoW;
          let panoY = sampler.panoH / 2 - (pitchInPano / Math.PI) * sampler.panoH;
          if (panoY < 0) panoY = 0;
          else if (panoY > sampler.panoH - 1) panoY = sampler.panoH - 1.0001;

          const [r, g, b] = sampler.sample(panoX, panoY);
          const oi = (y * outW + x) * 4;
          outData[oi] = r;
          outData[oi + 1] = g;
          outData[oi + 2] = b;
          outData[oi + 3] = 255;
        }
      }
      perspCtx.putImageData(outImg, 0, 0);
      updateProgress(70);

      // 4) Canvas final com filtros aplicados
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;
      const curSource: CanvasImageSource = persp;

      // Render base (preserva ajustes manuais do usuário, sem multiplicar)
      ctx.filter = `brightness(${brilho}%) contrast(${contraste}%) saturate(${saturacao}%)`;
      ctx.drawImage(curSource, 0, 0, outW, outH);
      ctx.filter = "none";

      // ===== Tratamento automático de qualidade (aplicado a TODA imagem salva) =====
      // 1) Curva de brilho/contraste preservando highlights (evita estouro)
      // 2) Saturação sutil
      // 3) Unsharp mask para nitidez natural (ruas, placas, calçadas)
      try {
        const imgData = ctx.getImageData(0, 0, outW, outH);
        const src = imgData.data;
        const w = outW, h = outH;

        // --- LUT tonal: clareamento mais visível em sombras/mid-tones + proteção de highlights ---
        const lut = new Uint8ClampedArray(256);
        const brightLift = 22;     // brilho profissional sem estourar céu/áreas claras
        const contrastAmt = 0.14;  // contraste extra com S-curve suave
        const shadowGamma = 0.86;  // <1 clareia sombras e tons médios
        for (let i = 0; i < 256; i++) {
          let v = i / 255;
          // gamma para clarear sombras sem queimar luzes
          v = Math.pow(v, shadowGamma);
          // brilho aditivo concentrado em sombras/médios e reduzido nos highlights
          v = v + (brightLift / 255) * Math.pow(1 - v, 1.45);
          // s-curve suave (contraste)
          v = v + contrastAmt * (v - 0.5) * (1 - Math.abs(2 * v - 1));
          // clamp suave
          if (v < 0) v = 0; else if (v > 1) v = 1;
          lut[i] = Math.round(v * 255);
        }

        // --- Saturação leve em espaço HSL aproximado (boost cromático) ---
        const satBoost = 1.12;
        const toned = new Uint8ClampedArray(src.length);
        for (let i = 0; i < src.length; i += 4) {
          let r = lut[src[i]];
          let g = lut[src[i + 1]];
          let b = lut[src[i + 2]];
          // luminância perceptual
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          r = lum + (r - lum) * satBoost;
          g = lum + (g - lum) * satBoost;
          b = lum + (b - lum) * satBoost;
          toned[i] = r < 0 ? 0 : r > 255 ? 255 : r;
          toned[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
          toned[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
          toned[i + 3] = src[i + 3];
        }

        // --- Unsharp mask: blur 3x3 -> high-pass -> soma com amount ---
        // Mais natural que o kernel sharpen direto.
        const blurred = new Uint8ClampedArray(toned.length);
        // box blur 3x3 separável simples
        const tmp = new Uint8ClampedArray(toned.length);
        // horizontal
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const oi = (y * w + x) * 4;
            for (let c = 0; c < 3; c++) {
              const a = toned[(y * w + Math.max(0, x - 1)) * 4 + c];
              const b2 = toned[(y * w + x) * 4 + c];
              const cc = toned[(y * w + Math.min(w - 1, x + 1)) * 4 + c];
              tmp[oi + c] = (a + b2 + cc) / 3;
            }
          }
        }
        // vertical
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const oi = (y * w + x) * 4;
            for (let c = 0; c < 3; c++) {
              const a = tmp[(Math.max(0, y - 1) * w + x) * 4 + c];
              const b2 = tmp[(y * w + x) * 4 + c];
              const cc = tmp[(Math.min(h - 1, y + 1) * w + x) * 4 + c];
              blurred[oi + c] = (a + b2 + cc) / 3;
            }
          }
        }

        const amount = 0.46;     // nitidez mais definida, ainda natural
        const threshold = 3;     // preserva detalhes finos sem puxar ruído demais
        const out = new Uint8ClampedArray(toned.length);
        for (let i = 0; i < toned.length; i += 4) {
          for (let c = 0; c < 3; c++) {
            const orig = toned[i + c];
            const blur = blurred[i + c];
            const diff = orig - blur;
            const v = Math.abs(diff) > threshold ? orig + diff * amount : orig;
            out[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
          }
          out[i + 3] = toned[i + 3];
        }

        ctx.putImageData(new ImageData(out, w, h), 0, 0);
      } catch (e) {
        console.warn("Tratamento automático pulado:", e);
      }

      updateProgress(85);
      // Exportar como JPEG de alta qualidade — arquivo ~10x menor que PNG,
      // upload muito mais rápido e sem perda visível de qualidade.
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92)
      );

      if (!blob) throw new Error("Erro ao gerar blob da imagem");

      updateProgress(92);
      // Upload para Supabase
      const fileName = `${point.cod}_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from("imagens-outdoors").upload(fileName, blob, {
        contentType: "image/jpeg",
        upsert: true,
        cacheControl: "3600",
      });

      if (uploadError) throw uploadError;
      updateProgress(100);

      const { data: urlData } = supabase.storage.from("imagens-outdoors").getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;

      setAdjustedPhoto(point.id, {
        heading: realHeading,
        pitch: realPitch,
        fov: realFov,
        url: publicUrl
      });

      log("success", `✅ ${point.cod} — Foto salva com filtros aplicados!`);
      if (minimizedRef.current && toastIdRef.current != null) {
        toast.success(`✅ Foto do item ${codRef.current} salva!`, {
          id: toastIdRef.current,
          duration: 4000,
        });
      } else {
        onOpenChange(false);
      }
    } catch (err: any) {
      console.error(err);
      log("error", `❌ Erro ao salvar foto: ${err.message}`);
      if (minimizedRef.current && toastIdRef.current != null) {
        toast.error(`❌ Erro ao salvar ${codRef.current}: ${err.message}`, {
          id: toastIdRef.current,
          duration: 6000,
        });
      }
    } finally {
      setSaving(false);
      updateProgress(0);
      minimizedRef.current = false;
      toastIdRef.current = null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-[97vw] max-h-[97vh] overflow-y-auto p-4 sm:p-6">
        {saving && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-sm rounded-lg">
            <div className="w-[85%] max-w-md bg-card border border-border rounded-xl p-6 shadow-2xl">
              <div className="flex items-center gap-2 mb-3">
                <RefreshCw className="size-4 animate-spin text-primary" />
                <span className="font-semibold text-sm">
                  Salvando foto do item {point.cod}
                </span>
              </div>
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${saveProgress}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-muted-foreground text-right tabular-nums">
                {saveProgress}%
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-4"
                onClick={handleMinimize}
              >
                Deixar em segundo plano
              </Button>
            </div>
          </div>
        )}
        <DialogHeader>
          <DialogTitle>
            Ajustar foto — <span className="font-mono text-sm text-muted-foreground">{point.cod}</span>
            {position && (
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                ({position.current}/{position.total})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="relative w-full aspect-video max-h-[55vh] sm:max-h-[72vh] rounded-lg overflow-hidden border border-border bg-muted group">
          {/* Foto Original */}
          <div className={`absolute inset-0 transition-transform duration-500 ease-in-out ${showOriginal ? 'translate-x-0' : '-translate-x-full'}`}>
            {hasOriginalPhoto ? (

              <img 
                src={point.foto} 
                alt="Foto original" 
                className="w-full h-full object-cover"
                onError={() => {
                  setOriginalBroken(true);
                  setShowOriginal(false);
                }}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  if (img.naturalWidth > 0 && img.naturalWidth <= 400 && img.naturalHeight <= 400) {
                    setOriginalBroken(true);
                    setShowOriginal(false);
                  }
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">Sem foto na planilha</div>
            )}
            <div className="absolute top-4 left-4 bg-black/60 text-white px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm">
              FOTO ORIGINAL
            </div>
          </div>

          {/* Nova Foto (Street View) */}
          <div className={`absolute inset-0 transition-transform duration-500 ease-in-out ${showOriginal ? 'translate-x-full' : 'translate-x-0'}`}>
            <div 
              ref={containerRef} 
              className="w-full h-full" 
              style={{ 
                filter: `brightness(${brilho}%) contrast(${contraste}%) saturate(${saturacao}%)`
              }} 
            />
            <div className="absolute top-4 right-4 bg-primary/90 text-primary-foreground px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm">
              NOVA FOTO (STREET VIEW)
            </div>
          </div>

          {/* Setas de Navegação */}
          {hasOriginalPhoto && (

            <>
              <button 
                onClick={() => setShowOriginal(true)}
                className={`absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-opacity ${showOriginal ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
              >
                <ChevronLeft className="size-8" />
              </button>
              <button 
                onClick={() => setShowOriginal(false)}
                className={`absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-opacity ${!showOriginal ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
              >
                <ChevronRight className="size-8" />
              </button>
            </>
          )}

          {/* Indicadores (Dots) */}
          {hasOriginalPhoto && (

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              <button 
                onClick={() => setShowOriginal(true)}
                className={`size-2 rounded-full transition-all ${showOriginal ? 'bg-white w-4' : 'bg-white/50'}`} 
              />
              <button 
                onClick={() => setShowOriginal(false)}
                className={`size-2 rounded-full transition-all ${!showOriginal ? 'bg-white w-4' : 'bg-white/50'}`} 
              />
            </div>
          )}
        </div>

        {availableYears.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto py-2 px-1 -mx-1">
            <span className="text-xs text-muted-foreground font-medium shrink-0">📅 Ano:</span>
            {availableYears.map((y) => (
              <Button
                key={y.panoId}
                variant={selectedYear === y.year ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-3 shrink-0"
                onClick={() => handleYearChange(y.year)}
                title={y.date}
              >
                {y.year}
              </Button>
            ))}
          </div>
        )}

        {!showOriginal && (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                🎨 Edição de Imagem
              </h4>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-[10px] px-2"
                onClick={() => {
                  setBrilho(90);
                  setContraste(136);
                  setSaturacao(151);
                }}
              >
                <RefreshCw className="size-3 mr-1" />
                Resetar
              </Button>
            </div>
            
            <SliderRow
              label="☀️ Brilho"
              value={brilho}
              min={50}
              max={150}
              onChange={setBrilho}
              suffix="%"
            />
            <SliderRow
              label="🌓 Contraste"
              value={contraste}
              min={50}
              max={150}
              onChange={setContraste}
              suffix="%"
            />
            <SliderRow
              label="🌈 Saturação"
              value={saturacao}
              min={0}
              max={200}
              onChange={setSaturacao}
              suffix="%"
            />
          </div>
        )}

        <DialogFooter className="flex flex-col sm:flex-row gap-2 flex-wrap">
          {onPrev && (
            <Button variant="outline" size="sm" onClick={onPrev} className="gap-1">
              <ChevronLeft className="size-4" /> Anterior
            </Button>
          )}
          {onNext && (
            <Button variant="outline" size="sm" onClick={onNext} className="gap-1">
              Próximo <ChevronRight className="size-4" />
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {hasOriginalPhoto && (
            <Button 
              variant="outline" 
              onClick={() => {
                setAdjustedPhoto(point.id, {
                  heading: point.headingSalvo ?? point.adjustedPhoto?.heading ?? 0,
                  pitch: point.pitchSalvo ?? point.adjustedPhoto?.pitch ?? 0,
                  fov: point.fovSalvo ?? point.adjustedPhoto?.fov ?? 80,
                  url: point.foto
                });
                log("success", `✅ ${point.cod} — Foto original da planilha mantida.`);
                onOpenChange(false);
              }}
              className="gap-2"
            >
              Manter Foto Original
            </Button>
          )}
          <Button onClick={save} disabled={saving} className="bg-primary gap-2">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Usar Nova Foto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  suffix?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-medium">
          {value}
          {suffix}
        </span>
      </div>
      <Slider value={[value]} min={min} max={max} step={1} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}