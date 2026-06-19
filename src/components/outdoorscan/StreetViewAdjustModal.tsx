import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Save, Loader2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import type { Point } from "@/lib/outdoorscan/types";
import { GMAPS_KEY, streetViewImg } from "@/lib/outdoorscan/streetview";
import { useSession } from "@/context/SessionContext";
import { supabase } from "@/integrations/supabase/client";

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
  const [heading, setHeading] = useState(point.headingSalvo ?? point.adjustedPhoto?.heading ?? 0);
  const [pitch, setPitch] = useState(point.pitchSalvo ?? point.adjustedPhoto?.pitch ?? 0);
  const [fov, setFov] = useState(point.fovSalvo ?? point.adjustedPhoto?.fov ?? 80);

  // Filtros de imagem
  const [brilho, setBrilho] = useState(100);
  const [contraste, setContraste] = useState(100);
  const [saturacao, setSaturacao] = useState(100);
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
      const svService = new (window as any).google.maps.StreetViewService();
      const meta: any = await new Promise((resolve, reject) => {
        svService.getPanorama({ pano: realPanoId }, (data: any, status: any) => {
          if (status === "OK") resolve(data);
          else reject(new Error("Falha ao obter metadados do panorama: " + status));
        });
      });
      const tileSize = Number(meta?.tiles?.tileSize?.width ?? 512);

      // 2) Definir saída 4K e baixar somente os tiles necessários, em zoom 5
      // quando disponível. Zoom 5 tem o dobro da resolução do zoom 4 anterior,
      // mantendo o ângulo correto sem precisar montar o panorama inteiro na memória.
      const MAX_OUT = 3840;
      const outW = aspect >= 1 ? MAX_OUT : Math.round(MAX_OUT * aspect);
      const outH = aspect >= 1 ? Math.round(MAX_OUT / aspect) : MAX_OUT;

      const fovRad = (realFov * Math.PI) / 180;
      const verticalFovDeg = (2 * Math.atan(Math.tan(fovRad / 2) * (outH / outW)) * 180) / Math.PI;
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

        const startH = realHeading - realFov / 2 - hMargin;
        const endH = realHeading + realFov / 2 + hMargin;
        for (let h = startH; h <= endH; h += tileStepDeg / 2) addX(h);
        addX(endH);

        const minPitch = Math.max(-89.9, realPitch - verticalFovDeg / 2 - vMargin);
        const maxPitch = Math.min(89.9, realPitch + verticalFovDeg / 2 + vMargin);
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

        const readPixel = (px: number, py: number, channel: number) => {
          const safeX = mod(Math.floor(px), panoW);
          const safeY = Math.max(0, Math.min(panoH - 1, Math.floor(py)));
          const tx = Math.floor(safeX / tileSize);
          const ty = Math.floor(safeY / tileSize);
          const data = tileData.get(`${tx},${ty}`)?.data;
          if (!data) return 0;
          const lx = safeX - tx * tileSize;
          const ly = safeY - ty * tileSize;
          return data[(ly * tileSize + lx) * 4 + channel];
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
            const r0 = readPixel(x0, y0, 0) + (readPixel(x1, y0, 0) - readPixel(x0, y0, 0)) * fx;
            const r1 = readPixel(x0, y1, 0) + (readPixel(x1, y1, 0) - readPixel(x0, y1, 0)) * fx;
            const g0 = readPixel(x0, y0, 1) + (readPixel(x1, y0, 1) - readPixel(x0, y0, 1)) * fx;
            const g1 = readPixel(x0, y1, 1) + (readPixel(x1, y1, 1) - readPixel(x0, y1, 1)) * fx;
            const b0 = readPixel(x0, y0, 2) + (readPixel(x1, y0, 2) - readPixel(x0, y0, 2)) * fx;
            const b1 = readPixel(x0, y1, 2) + (readPixel(x1, y1, 2) - readPixel(x0, y1, 2)) * fx;
            return [r0 + (r1 - r0) * fy, g0 + (g1 - g0) * fy, b0 + (b1 - b0) * fy] as const;
          }
        };
      };

      let sampler = await buildTileSampler(5);
      if (!sampler.complete) {
        log("info", `${point.cod} — Zoom 5 incompleto, usando zoom 4 completo como fallback.`);
        sampler = await buildTileSampler(4);
      }
      if (!sampler.complete) throw new Error("Falha ao baixar tiles suficientes para alta qualidade");

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

          // Nos tiles nativos do Street View, x=0 corresponde ao norte
          // (heading 0°) e y=H/2 corresponde ao horizonte (pitch 0°).
          // originHeading/originPitch são metadados do veículo, não offsets
          // de coordenada do panorama.
          let u = worldHeading / TWO_PI;
          u = u - Math.floor(u);
          let panoX = u * panoW;
          let panoY = panoH / 2 - (worldPitch / Math.PI) * panoH;
          if (panoY < 0) panoY = 0;
          else if (panoY > panoH - 1) panoY = panoH - 1.0001;

          const x0 = Math.floor(panoX);
          const y0 = Math.floor(panoY);
          const x1 = (x0 + 1) % panoW;
          const y1 = y0 + 1;
          const fx = panoX - x0;
          const fyy = panoY - y0;
          const i00 = (y0 * panoW + x0) * 4;
          const i10 = (y0 * panoW + x1) * 4;
          const i01 = (y1 * panoW + x0) * 4;
          const i11 = (y1 * panoW + x1) * 4;
          const oi = (y * outW + x) * 4;
          // bilinear (R,G,B)
          const r0 = equiData[i00]     + (equiData[i10]     - equiData[i00])     * fx;
          const r1 = equiData[i01]     + (equiData[i11]     - equiData[i01])     * fx;
          const g0 = equiData[i00 + 1] + (equiData[i10 + 1] - equiData[i00 + 1]) * fx;
          const g1 = equiData[i01 + 1] + (equiData[i11 + 1] - equiData[i01 + 1]) * fx;
          const b0 = equiData[i00 + 2] + (equiData[i10 + 2] - equiData[i00 + 2]) * fx;
          const b1 = equiData[i01 + 2] + (equiData[i11 + 2] - equiData[i01 + 2]) * fx;
          outData[oi]     = r0 + (r1 - r0) * fyy;
          outData[oi + 1] = g0 + (g1 - g0) * fyy;
          outData[oi + 2] = b0 + (b1 - b0) * fyy;
          outData[oi + 3] = 255;
        }
      }
      perspCtx.putImageData(outImg, 0, 0);

      // 4) Canvas final com filtros aplicados
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;
      (ctx as any).imageSmoothingQuality = "high";
      const curSource: CanvasImageSource = persp;

      const finalBrilho = Math.round(brilho * 1.05);
      const finalContraste = Math.round(contraste * 1.12);
      const finalSaturacao = Math.round(saturacao * 1.18);
      ctx.filter = `brightness(${finalBrilho}%) contrast(${finalContraste}%) saturate(${finalSaturacao}%)`;
      ctx.drawImage(curSource, 0, 0, outW, outH);
      ctx.filter = "none";

      // Sharpening (unsharp mask simplificado via convolução)
      try {
        const imgData = ctx.getImageData(0, 0, outW, outH);
        const src = imgData.data;
        const out = new Uint8ClampedArray(src);
        const w = outW, h = outH;
        // Kernel sharpen 3x3
        const k = [0, -1, 0, -1, 5, -1, 0, -1, 0];
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            for (let ch = 0; ch < 3; ch++) {
              let acc = 0, ki = 0;
              for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                  const idx = ((y + ky) * w + (x + kx)) * 4 + ch;
                  acc += src[idx] * k[ki++];
                }
              }
              const oi = (y * w + x) * 4 + ch;
              // mix 60% original + 40% sharpened para evitar artefatos
              out[oi] = Math.max(0, Math.min(255, src[oi] * 0.6 + acc * 0.4));
            }
          }
        }
        const sharpData = new ImageData(out, w, h);
        ctx.putImageData(sharpData, 0, 0);
      } catch (e) {
        console.warn("Sharpening pulado:", e);
      }

      // Exportar em altíssima qualidade
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.98)
      );

      if (!blob) throw new Error("Erro ao gerar blob da imagem");

      // Upload para Supabase
      const fileName = `${point.cod}_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from("imagens-outdoors").upload(fileName, blob, {
        contentType: "image/jpeg",
        upsert: true,
      });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("imagens-outdoors").getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;

      setAdjustedPhoto(point.id, {
        heading: realHeading,
        pitch: realPitch,
        fov: realFov,
        url: publicUrl
      });

      log("success", `✅ ${point.cod} — Foto salva com filtros aplicados!`);
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      log("error", `❌ Erro ao salvar foto: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-[97vw] max-h-[97vh] overflow-y-auto p-4 sm:p-6">
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
                  setBrilho(100);
                  setContraste(100);
                  setSaturacao(100);
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