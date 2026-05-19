import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";
import type { Point } from "@/lib/outdoorscan/types";
import { GMAPS_KEY, streetViewImg } from "@/lib/outdoorscan/streetview";
import { useSession } from "@/context/SessionContext";

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
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  point: Point;
}) {
  const { setAdjustedPhoto, salvarFotoSupabase, log } = useSession();
  const [saving, setSaving] = useState(false);
  const [heading, setHeading] = useState(point.headingSalvo ?? point.adjustedPhoto?.heading ?? 0);
  const [pitch, setPitch] = useState(point.pitchSalvo ?? point.adjustedPhoto?.pitch ?? 0);
  const [fov, setFov] = useState(point.fovSalvo ?? point.adjustedPhoto?.fov ?? 80);

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

      log("info", `${point.cod} — Salvando: heading=${realHeading}° pitch=${realPitch}° fov=${realFov}°`);
      const url = streetViewImg(point.lat, point.lng, {
        heading: realHeading,
        pitch: realPitch,
        fov: realFov,
        size: "640x480"
      });
      const publicUrl = await salvarFotoSupabase(point.cod, url);
      setAdjustedPhoto(point.id, {
        heading: realHeading,
        pitch: realPitch,
        fov: realFov,
        url: publicUrl
      });
      log("success", `✅ ${point.cod} — Foto salva no ângulo exato!`);
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
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Ajustar foto — <span className="font-mono text-sm text-muted-foreground">{point.cod}</span>
          </DialogTitle>
        </DialogHeader>

        <div ref={containerRef} className="w-full rounded-lg overflow-hidden border border-border bg-muted" style={{ height: '380px' }} />

        <div className="grid grid-cols-1 gap-4 py-2">
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
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Salvar
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