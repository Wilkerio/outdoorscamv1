import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
 import { Save, Loader2 } from "lucide-react";
import type { Point } from "@/lib/outdoorscan/types";
import { streetViewEmbed, streetViewImg } from "@/lib/outdoorscan/streetview";
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
   const [heading, setHeading] = useState(point.headingSalvo ?? point.adjustedPhoto?.heading ?? 0);
   const [pitch, setPitch] = useState(point.pitchSalvo ?? point.adjustedPhoto?.pitch ?? 0);
   const [fov, setFov] = useState(point.fovSalvo ?? point.adjustedPhoto?.fov ?? 80);

    useEffect(() => {
      if (open) {
        setHeading(point.headingSalvo ?? point.adjustedPhoto?.heading ?? 0);
        setPitch(point.pitchSalvo ?? point.adjustedPhoto?.pitch ?? 0);
        setFov(point.fovSalvo ?? point.adjustedPhoto?.fov ?? 80);
      }
    }, [open, point.id, point.headingSalvo, point.pitchSalvo, point.fovSalvo]);

   const save = async () => {
     try {
       setSaving(true);
       const url = streetViewImg(point.lat, point.lng, { heading, pitch, fov, size: "640x480" });
       const publicUrl = await salvarFotoSupabase(point.cod, url);
       setAdjustedPhoto(point.id, { heading, pitch, fov, url: publicUrl });
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
 
         <p className="text-[12px] text-muted-foreground mb-2">
           ⚠️ Use os sliders abaixo para ajustar o ângulo. A foto será salva com os valores dos sliders.
         </p>
 
          <div className="aspect-video w-full rounded-lg overflow-hidden border border-border bg-muted">
           <iframe
             key={`${heading}-${pitch}-${fov}`}
             title="Street View"
             src={streetViewEmbed(point.lat, point.lng, heading, pitch, fov)}
             className="w-full h-full pointer-events-none"
             allowFullScreen
           />
        </div>

         <div className="grid grid-cols-1 gap-4 py-2">
            <SliderRow label="↔️ Direção (Heading)" value={heading} min={0} max={360} onChange={setHeading} suffix="°" />
            <SliderRow label="↕️ Inclinação (Pitch)" value={pitch} min={-90} max={90} onChange={setPitch} suffix="°" />
            <SliderRow label="🔍 Zoom (FOV)" value={fov} min={30} max={120} onChange={setFov} suffix="°" />
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
        <span className="text-muted-foreground">{label}:</span>
        <span className="tabular-nums font-medium">
          {value}
          {suffix}
        </span>
      </div>
      <Slider value={[value]} min={min} max={max} step={1} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}