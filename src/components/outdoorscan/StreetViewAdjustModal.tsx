import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";
import type { Point } from "@/lib/outdoorscan/types";
import { streetViewImg, GMAPS_KEY } from "@/lib/outdoorscan/streetview";
import { useSession } from "@/context/SessionContext";

export function StreetViewAdjustModal({
  open,
  onOpenChange,
  point,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  point: Point;
}) {
   const { setAdjustedPhoto, salvarFotoSupabase } = useSession();
   const [saving, setSaving] = useState(false);
   const panoramaRef = useRef<any>(null);
   const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!open) return;

      const initPanorama = () => {
        if (!containerRef.current || !window.google) return;
        
        const heading = point.headingSalvo ?? point.adjustedPhoto?.heading ?? 0;
        const pitch = point.pitchSalvo ?? point.adjustedPhoto?.pitch ?? 0;
        const fov = point.fovSalvo ?? point.adjustedPhoto?.fov ?? 80;
        // Converter FOV para zoom da API JS (aproximado)
        // zoom 1 = 90 deg, zoom 2 = 45 deg, etc. A API JS usa zoom 1 como padrão (~90-80 deg)
        const initialZoom = Math.max(0, Math.log2(90 / fov));

        const panorama = new window.google.maps.StreetViewPanorama(
          containerRef.current,
          {
            position: { lat: point.lat, lng: point.lng },
            pov: { heading: heading, pitch: pitch },
            zoom: initialZoom,
            addressControl: false,
            fullscreenControl: false,
            motionTracking: false,
            motionTrackingControl: false,
          }
        );
        panoramaRef.current = panorama;
      };

      if (!window.google) {
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}`;
        script.async = true;
        script.onload = initPanorama;
        document.head.appendChild(script);
      } else {
        initPanorama();
      }
    }, [open, point.lat, point.lng, point.id]);

   const save = async () => {
     try {
       setSaving(true);
       const pov = panoramaRef.current?.getPov();
       const zoom = panoramaRef.current?.getZoom() || 1;
       
       const headingAtual = Math.round(pov?.heading || 0);
       const pitchAtual = Math.round(pov?.pitch || 0);
       // Converter zoom de volta para FOV aproximado: 90 / 2^zoom
       const fovAtual = Math.round(90 / Math.pow(2, zoom));

       const url = streetViewImg(point.lat, point.lng, { 
         heading: headingAtual, 
         pitch: pitchAtual, 
         fov: fovAtual, 
         size: "640x480" 
       });

       const publicUrl = await salvarFotoSupabase(point.cod, url);
       setAdjustedPhoto(point.id, { 
         heading: headingAtual, 
         pitch: pitchAtual, 
         fov: fovAtual, 
         url: publicUrl 
       });
       onOpenChange(false);
     } catch (err: any) {
       console.error(err);
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
 
        <p className="text-[12px] text-muted-foreground mb-4">
          Navegue no Street View abaixo e clique em Salvar para capturar o ângulo exato.
        </p>

        <div 
          ref={containerRef}
          className="aspect-video w-full rounded-lg overflow-hidden border border-border bg-muted"
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