import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";
import type { Point } from "@/lib/outdoorscan/types";
import { GMAPS_KEY, streetViewImg, streetViewEmbed } from "@/lib/outdoorscan/streetview";
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
   const { setAdjustedPhoto, salvarFotoSupabase, log } = useSession();
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

        <div className="bg-[#1a1a2e] p-2 rounded mb-2 border border-yellow-500/20">
          <p className="text-[#facc15] text-xs m-0">
            ⚠️ Use o slider de Zoom abaixo — o scroll do mouse no iframe não é capturado pelo sistema.
          </p>
        </div>

        <div className="aspect-video w-full rounded-lg overflow-hidden border border-border bg-muted" style={{ height: '380px' }}>
          <iframe
            key={`${heading}-${pitch}-${fov}`}
            title="Street View"
            src={streetViewEmbed(point.lat, point.lng, heading, pitch, fov)}
            className="w-full h-full"
            style={{ border: 'none' }}
            allowFullScreen
          />
        </div>
        <p className="text-xs text-muted-foreground text-center mt-1">
          Use o slider para ajustar o zoom. O scroll do mouse dentro da visualização não é capturado pelo sistema.
        </p>

        <div className="grid grid-cols-1 gap-4 py-2">
          <SliderRow label="↔️ Direção" value={heading} min={0} max={360} onChange={setHeading} suffix="°" />
          <SliderRow label="↕️ Inclinação" value={pitch} min={-45} max={45} onChange={setPitch} suffix="°" />
          <SliderRow label="🔍 Zoom (menor = mais zoom)" value={fov} min={10} max={100} onChange={setFov} suffix="°" />
          
          <div className="flex gap-2 mt-1">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 text-xs"
              onClick={() => setFov(f => Math.max(10, f - 10))}
            >
              🔍 + Zoom
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 text-xs"
              onClick={() => setFov(f => Math.min(100, f + 10))}
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