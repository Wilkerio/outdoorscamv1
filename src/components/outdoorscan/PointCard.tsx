import { useState } from "react";
 import { Map, Camera, Link as LinkIcon, Bot } from "lucide-react";
import type { Point } from "@/lib/outdoorscan/types";
import { streetViewImg, googleMapsLink } from "@/lib/outdoorscan/streetview";
import { Button } from "@/components/ui/button";
import { StreetViewAdjustModal } from "./StreetViewAdjustModal";
import { toast } from "sonner";
 import { useSession } from "@/context/SessionContext";

const STATUS_STYLES: Record<Point["status"], string> = {
  AGUARDANDO: "bg-muted text-muted-foreground",
  PROCESSANDO: "bg-primary/20 text-primary animate-pulse",
  SUCESSO: "bg-success/20 text-success",
   SEM_COBERTURA: "bg-warning/20 text-warning",
   ERRO: "bg-destructive/20 text-destructive",
   SEM_OUTDOOR_VISIVEL: "bg-warning/40 text-warning",
 };
 
 const STATUS_LABEL: Record<Point["status"], string> = {
   AGUARDANDO: "AGUARDANDO",
   PROCESSANDO: "PROCESSANDO",
   SUCESSO: "SUCESSO",
   SEM_COBERTURA: "SEM COBERTURA",
   ERRO: "ERRO",
   SEM_OUTDOOR_VISIVEL: "SEM OUTDOOR VISÍVEL",
 };

export function PointCard({ point }: { point: Point }) {
  const [open, setOpen] = useState(false);
   const { corrigirComIA } = useSession();
  const validCoords = Number.isFinite(point.lat) && Number.isFinite(point.lng);

   const previewUrl = point.foto_url || (point.lat && point.lng ? streetViewImg(point.lat, point.lng) : "");

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
      <div className="relative aspect-[2/1] bg-muted">
        {validCoords ? (
          <img src={previewUrl} alt={point.endereco} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
            Coordenadas inválidas
          </div>
        )}
        <span
          className={`absolute top-2 right-2 text-[10px] font-semibold tracking-wider px-2 py-1 rounded-md ${STATUS_STYLES[point.status]}`}
        >
          {STATUS_LABEL[point.status]}
        </span>
      </div>

      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-mono text-xs text-muted-foreground">{point.cod}</div>
            <div className="font-medium text-sm truncate">{point.endereco}</div>
            <div className="text-xs text-muted-foreground truncate">
              {point.bairro} · {point.cidade}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 text-[10px]">
          {point.formato && <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{point.formato}</span>}
          {point.empresa && <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{point.empresa}</span>}
        </div>

        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <Button
            size="sm"
            variant="secondary"
            className="flex-1 min-w-0"
            disabled={!validCoords}
            onClick={() => window.open(googleMapsLink(point.lat, point.lng), "_blank")}
          >
            <Map className="size-3.5" /> 🗺️ Ver no Mapa
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="flex-1 min-w-0"
            disabled={!validCoords}
            onClick={() => setOpen(true)}
          >
            <Camera className="size-3.5" /> 📸 Ajustar Foto
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 min-w-0 border-primary/50 text-primary hover:bg-primary/10"
            disabled={!validCoords || point.status === "PROCESSANDO"}
            onClick={() => corrigirComIA(point)}
          >
            <Bot className="size-3.5" /> 🤖 IA
          </Button>
        </div>

        <div className="flex gap-2">
          {(point.foto_url || point.adjustedPhoto?.url) && (
            <Button
              size="sm"
              variant="ghost"
              className="flex-1 text-primary text-[10px] h-8"
              onClick={() => {
                const url = point.foto_url || point.adjustedPhoto!.url;
                window.open(url, "_blank");
              }}
            >
              <LinkIcon className="size-3.5 mr-1" /> Link da Foto
            </Button>
          )}
        </div>
      </div>

      <StreetViewAdjustModal open={open} onOpenChange={setOpen} point={point} />
    </div>
  );
}