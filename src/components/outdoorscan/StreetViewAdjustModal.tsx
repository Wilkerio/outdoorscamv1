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
      // Estratégia de máxima qualidade:
      // 1) Baixar várias capturas 640x640 (tiles) cobrindo o mesmo enquadramento
      //    com FOVs menores → maior densidade de pixels real (não interpolada).
      // 2) Montar mosaico em alta resolução nativa.
      // 3) Aplicar sharpening (unsharp mask) + filtros do usuário.
      const aspect = offsetWidth / offsetHeight;
      const TILE = 640;

      // Grid de tiles baseado no FOV: quanto maior o FOV, mais tiles.
      // Cada tile cobre subFov = realFov / cols (horizontal).
      const cols = realFov >= 90 ? 3 : realFov >= 60 ? 3 : 2;
      const rows = cols; // mesma divisão vertical
      const subFov = realFov / cols;

      const baseHeading = realHeading;
      const basePitch = realPitch;

      // Offsets em graus a partir do centro
      const headingOffsets: number[] = [];
      const pitchOffsets: number[] = [];
      for (let c = 0; c < cols; c++) {
        // de -(cols-1)/2 a +(cols-1)/2 multiplicado por subFov
        headingOffsets.push((c - (cols - 1) / 2) * subFov);
      }
      for (let r = 0; r < rows; r++) {
        pitchOffsets.push(-((r - (rows - 1) / 2) * (subFov / aspect)));
      }

      // Baixar todos os tiles em paralelo
      const fetchTile = async (h: number, p: number): Promise<HTMLImageElement> => {
        const params = new URLSearchParams({
          size: `${TILE}x${TILE}`,
          fov: String(Math.max(10, Math.min(120, Math.round(subFov)))),
          heading: String(((h % 360) + 360) % 360),
          pitch: String(Math.max(-90, Math.min(90, p))),
          key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
        });
        if (realPanoId) params.set("pano", realPanoId);
        else params.set("location", `${realLat},${realLng}`);
        const url = `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`;
        const { data, error } = await supabase.functions.invoke("google-proxy", { body: { url } });
        if (error || !data?.image) throw new Error(error?.message || "Erro ao baixar tile");
        const im = new Image();
        im.crossOrigin = "anonymous";
        im.src = `data:image/jpeg;base64,${data.image}`;
        await new Promise((res, rej) => { im.onload = res; im.onerror = rej; });
        return im;
      };

      const tilePromises: Promise<{ img: HTMLImageElement; col: number; row: number }>[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          tilePromises.push(
            fetchTile(baseHeading + headingOffsets[c], basePitch + pitchOffsets[r]).then((img) => ({ img, col: c, row: r }))
          );
        }
      }
      const tiles = await Promise.all(tilePromises);

      // Mosaico nativo: cols*TILE x rows*TILE (ex.: 3x3 = 1920x1920)
      const mosaicW = cols * TILE;
      const mosaicH = rows * TILE;
      const mosaic = document.createElement("canvas");
      mosaic.width = mosaicW;
      mosaic.height = mosaicH;
      const mctx = mosaic.getContext("2d")!;
      for (const { img, col, row } of tiles) {
        mctx.drawImage(img, col * TILE, row * TILE, TILE, TILE);
      }

      // Recortar para o aspect ratio do viewport
      const mosaicAspect = mosaicW / mosaicH;
      let cropW = mosaicW;
      let cropH = mosaicH;
      if (aspect > mosaicAspect) {
        cropH = Math.round(mosaicW / aspect);
      } else if (aspect < mosaicAspect) {
        cropW = Math.round(mosaicH * aspect);
      }
      const cropX = Math.round((mosaicW - cropW) / 2);
      const cropY = Math.round((mosaicH - cropH) / 2);

      // Upscale final para 4K
      const MAX_4K = 3840;
      const cropAspect = cropW / cropH;
      let outW: number, outH: number;
      if (cropAspect >= 1) { outW = MAX_4K; outH = Math.round(MAX_4K / cropAspect); }
      else { outH = MAX_4K; outW = Math.round(MAX_4K * cropAspect); }

      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;
      (ctx as any).imageSmoothingQuality = "high";

      // Upscale progressivo
      let curSource: CanvasImageSource = mosaic;
      let curW = cropW, curH = cropH;
      let sx = cropX, sy = cropY;
      // Primeiro passo: aplica o crop
      {
        const tmp = document.createElement("canvas");
        tmp.width = cropW; tmp.height = cropH;
        const tctx = tmp.getContext("2d")!;
        tctx.drawImage(mosaic, sx, sy, cropW, cropH, 0, 0, cropW, cropH);
        curSource = tmp;
      }
      while (curW * 2 < outW) {
        const nextW = curW * 2, nextH = curH * 2;
        const tmp = document.createElement("canvas");
        tmp.width = nextW; tmp.height = nextH;
        const tctx = tmp.getContext("2d")!;
        tctx.imageSmoothingEnabled = true;
        (tctx as any).imageSmoothingQuality = "high";
        tctx.drawImage(curSource, 0, 0, nextW, nextH);
        curSource = tmp; curW = nextW; curH = nextH;
      }

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