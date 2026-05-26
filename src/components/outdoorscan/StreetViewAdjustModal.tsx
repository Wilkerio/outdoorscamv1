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
            }
          );
          panoramaRef.current = pano;
        })
        .catch(console.error);
    };

    requestAnimationFrame(init);

    return () => {
      cancelled = true;
      panoramaRef.current = null;
    };
  }, [open]);

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
      const MAX_DIM = 640;
      let targetW = offsetWidth;
      let targetH = offsetHeight;
      
      if (targetW > MAX_DIM || targetH > MAX_DIM) {
        const ratio = targetW / targetH;
        if (targetW > targetH) {
          targetW = MAX_DIM;
          targetH = Math.round(MAX_DIM / ratio);
        } else {
          targetH = MAX_DIM;
          targetW = Math.round(MAX_DIM * ratio);
        }
      }

      // Construir URL usando panoId quando disponível, garantindo que a imagem
      // salva seja exatamente a que o usuário está vendo no panorama.
      const params = new URLSearchParams({
        size: `${targetW}x${targetH}`,
        fov: String(Math.round(realFov)),
        heading: String(Math.round(realHeading)),
        pitch: String(Math.round(realPitch)),
        key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
      });
      if (realPanoId) {
        params.set("pano", realPanoId);
      } else {
        params.set("location", `${realLat},${realLng}`);
      }
      const url = `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`;

      // Baixar imagem via proxy
      const { data, error: proxyError } = await supabase.functions.invoke("google-proxy", {
        body: { url },
      });

      if (proxyError || !data?.image) {
        throw new Error(proxyError?.message || "Erro ao baixar imagem");
      }

      // Aplicar filtros via Canvas
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = `data:image/jpeg;base64,${data.image}`;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Não foi possível criar contexto do canvas");

      // Aplicar os mesmos filtros do CSS no Canvas
      ctx.filter = `brightness(${brilho}%) contrast(${contraste}%) saturate(${saturacao}%)`;
      ctx.drawImage(img, 0, 0, targetW, targetH);

      // Converter para blob
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9)
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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

        <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border bg-muted group">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
          <div className="space-y-4">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              🧭 Ângulo e Zoom
            </h4>
            <SliderRow
              label="↔️ Direção"
              value={heading}
              min={0}
              max={360}
              onChange={(v) => {
                setHeading(v);
                panoramaRef.current?.setPov({ heading: v, pitch });
              }}
              suffix="°"
            />
            <SliderRow
              label="↕️ Inclinação"
              value={pitch}
              min={-45}
              max={45}
              onChange={(v) => {
                setPitch(v);
                panoramaRef.current?.setPov({ heading, pitch: v });
              }}
              suffix="°"
            />
            <SliderRow
              label="🔍 Zoom (menor = mais zoom)"
              value={fov}
              min={10}
              max={100}
              onChange={(v) => {
                setFov(v);
                panoramaRef.current?.setZoom(fovToZoom(v));
              }}
              suffix="°"
            />
          </div>

          <div className="space-y-4">
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
        </div>

          <div className="flex gap-2 mt-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setFov(f => {
                  const newF = Math.max(10, f - 10);
                  panoramaRef.current?.setZoom(fovToZoom(newF));
                  return newF;
                });
              }}
            >
              🔍 + Zoom
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setFov(f => {
                  const newF = Math.min(100, f + 10);
                  panoramaRef.current?.setZoom(fovToZoom(newF));
                  return newF;
                });
              }}
            >
            🔍 - Zoom
          </Button>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
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