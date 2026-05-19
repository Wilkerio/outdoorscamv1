import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";
import type { Point } from "@/lib/outdoorscan/types";
import { GMAPS_KEY, streetViewImg } from "@/lib/outdoorscan/streetview";
import { useSession } from "@/context/SessionContext";

declare global {
  interface Window {
    google: any;
  }
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
  const panoramaRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const iniciar = () => {
      if (!window.google?.maps || !containerRef.current) return;
      
      panoramaRef.current = new window.google.maps.StreetViewPanorama(
        containerRef.current,
        {
          position: { lat: point.lat, lng: point.lng },
          pov: { 
            heading: point.headingSalvo ?? point.adjustedPhoto?.heading ?? 0, 
            pitch: point.pitchSalvo ?? point.adjustedPhoto?.pitch ?? 0 
          },
          zoom: point.fovSalvo ? Math.round(Math.log2(90 / point.fovSalvo)) : 1,
          addressControl: false,
          showRoadLabels: false,
        }
      );
    };

    if (window.google?.maps) {
      iniciar();
    } else {
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}`;
      s.onload = iniciar;
      document.head.appendChild(s);
    }
  }, [open, point.lat, point.lng, point.headingSalvo, point.pitchSalvo, point.fovSalvo, point.adjustedPhoto]);

  const save = async () => {
    if (!panoramaRef.current) return;
    
    try {
      setSaving(true);
      const pov = panoramaRef.current.getPov();
      const zoom = panoramaRef.current.getZoom() || 1;
      const heading = Math.round(pov?.heading || 0);
      const pitch = Math.round(pov?.pitch || 0);
      const fov = Math.round(90 / Math.pow(2, zoom));

      log("info", `${point.cod} — Salvando: heading=${heading}° pitch=${pitch}° fov=${fov}°`);

      const url = streetViewImg(point.lat, point.lng, { heading, pitch, fov, size: "640x480" });
      const publicUrl = await salvarFotoSupabase(point.cod, url);
      
      setAdjustedPhoto(point.id, { heading, pitch, fov, url: publicUrl });
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

        <div 
          ref={containerRef}
          className="aspect-video w-full rounded-lg overflow-hidden border border-border bg-muted"
          style={{ height: '420px' }}
        />

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