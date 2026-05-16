import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
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
  const { setAdjustedPhoto } = useSession();
  const [heading, setHeading] = useState(point.adjustedPhoto?.heading ?? 0);
  const [pitch, setPitch] = useState(point.adjustedPhoto?.pitch ?? 0);
  const [fov, setFov] = useState(point.adjustedPhoto?.fov ?? 80);

  useEffect(() => {
    if (open) {
      setHeading(point.adjustedPhoto?.heading ?? 0);
      setPitch(point.adjustedPhoto?.pitch ?? 0);
      setFov(point.adjustedPhoto?.fov ?? 80);
    }
  }, [open, point.id]);

  const save = () => {
    const url = streetViewImg(point.lat, point.lng, { heading, pitch, fov, size: "600x400" });
    setAdjustedPhoto(point.id, { heading, pitch, fov, url });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Ajustar foto — <span className="font-mono text-sm text-muted-foreground">{point.cod}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="aspect-video w-full rounded-lg overflow-hidden border border-border bg-muted">
          <iframe
            key={`${heading}-${pitch}-${fov}`}
            title="Street View"
            src={streetViewEmbed(point.lat, point.lng, heading, pitch, fov)}
            className="w-full h-full"
            allowFullScreen
          />
        </div>

        <div className="grid grid-cols-1 gap-4 py-2">
          <SliderRow label="Heading" value={heading} min={0} max={360} onChange={setHeading} suffix="°" />
          <SliderRow label="Pitch" value={pitch} min={-90} max={90} onChange={setPitch} suffix="°" />
          <SliderRow label="FOV" value={fov} min={20} max={120} onChange={setFov} suffix="°" />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save}>
            <Save className="size-4" /> Salvar
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