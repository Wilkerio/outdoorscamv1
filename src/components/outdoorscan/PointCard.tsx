import { useState, useEffect } from "react";
import { Map, Camera, Link as LinkIcon, Trash2, Pencil } from "lucide-react";
import type { Point } from "@/lib/outdoorscan/types";
import { streetViewImg, googleMapsLink } from "@/lib/outdoorscan/streetview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
   const { points, toggleExcluido, editarPonto } = useSession();
   const [editOpen, setEditOpen] = useState(false);
   const [form, setForm] = useState({
     cod: point.cod ?? "",
     endereco: point.endereco ?? "",
     bairro: point.bairro ?? "",
     cidade: point.cidade ?? "",
     lat: String(point.lat ?? ""),
     lng: String(point.lng ?? ""),
     formato: point.formato ?? "",
     empresa: point.empresa ?? "",
   });
   useEffect(() => {
     if (editOpen) {
       setForm({
         cod: point.cod ?? "",
         endereco: point.endereco ?? "",
         bairro: point.bairro ?? "",
         cidade: point.cidade ?? "",
         lat: String(point.lat ?? ""),
         lng: String(point.lng ?? ""),
         formato: point.formato ?? "",
         empresa: point.empresa ?? "",
       });
     }
   }, [editOpen, point]);
   const handleSaveEdit = () => {
     const lat = parseFloat(String(form.lat).replace(",", "."));
     const lng = parseFloat(String(form.lng).replace(",", "."));
     if (form.lat && !Number.isFinite(lat)) {
       toast.error("Latitude inválida.");
       return;
     }
     if (form.lng && !Number.isFinite(lng)) {
       toast.error("Longitude inválida.");
       return;
     }
     editarPonto(point.id, {
       cod: form.cod,
       endereco: form.endereco,
       bairro: form.bairro,
       cidade: form.cidade,
       lat,
       lng,
       formato: form.formato,
       empresa: form.empresa,
     });
     toast.success("Ponto atualizado.");
     setEditOpen(false);
   };
  const [modalPointId, setModalPointId] = useState<string>(point.id);
  const modalPoint = points.find((p) => p.id === modalPointId) ?? point;
  const modalIndex = points.findIndex((p) => p.id === modalPointId);
  const goPrev = () => {
    if (modalIndex > 0) setModalPointId(points[modalIndex - 1].id);
  };
  const goNext = () => {
    if (modalIndex >= 0 && modalIndex < points.length - 1) setModalPointId(points[modalIndex + 1].id);
  };
  const validCoords = Number.isFinite(point.lat) && Number.isFinite(point.lng);

  const previewUrl = point.foto_url || (point.lat && point.lng ? streetViewImg(point.lat, point.lng) : "");
  // Se não tiver link na planilha (point.foto), forçamos showOriginal como false (Street View)
  const [originalBroken, setOriginalBroken] = useState(false);
  const hasOriginalPhoto = !!(point.foto && point.foto.trim() !== "" && !point.foto.toLowerCase().includes("not found") && point.foto !== "link da imagem nao localizado") && !originalBroken;
  const [showOriginal, setShowOriginal] = useState(hasOriginalPhoto);

  // Quando o usuário escolhe "Usar Nova Foto" no modal, alternar automaticamente
  // para mostrar a nova foto no card.
  useEffect(() => {
    if (point.adjustedPhoto?.url) {
      setShowOriginal(false);
    }
  }, [point.adjustedPhoto?.url]);

  return (
    <div className={`rounded-xl border border-border bg-card overflow-hidden flex flex-col group relative transition-opacity ${point.excluido ? 'opacity-40 grayscale' : ''}`}>
      {point.excluido && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 pointer-events-none">
          <span className="text-xs font-bold text-white bg-black/60 px-2 py-1 rounded">EXCLUÍDO</span>
        </div>
      )}
      <div className="relative aspect-[2/1] bg-muted">
        {validCoords ? (
          <img 
            src={showOriginal && hasOriginalPhoto ? point.foto : previewUrl} 
            alt={point.endereco} 
            className="w-full h-full object-cover transition-opacity duration-300" 
            loading="lazy" 
            onError={(e) => {
              const img = e.currentTarget;
              // Detecta imagens quebradas (imgbb "image not found" tem dimensões pequenas)
              if (showOriginal && (img.naturalWidth === 0 || img.naturalWidth <= 400)) {
                setOriginalBroken(true);
                setShowOriginal(false);
              }
            }}
            onLoad={(e) => {
              const img = e.currentTarget;
              // imgbb placeholder "image not found" é ~400x300
              if (showOriginal && img.naturalWidth > 0 && img.naturalWidth <= 400 && img.naturalHeight <= 400) {
                setOriginalBroken(true);
                setShowOriginal(false);
              }
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
            Coordenadas inválidas
          </div>
        )}
        
        <div className="absolute top-2 left-2 flex gap-1">
          {point.status !== "AGUARDANDO" && (
            <span
              className={`text-[10px] font-semibold tracking-wider px-2 py-1 rounded-md ${STATUS_STYLES[point.status]}`}
            >
              {STATUS_LABEL[point.status]}
            </span>
          )}
          {hasOriginalPhoto && (
            <button
              onClick={() => setShowOriginal(!showOriginal)}
              className={`text-[10px] font-semibold tracking-wider px-2 py-1 rounded-md transition-colors ${
                showOriginal 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-black/50 text-white hover:bg-black/70"
              }`}
            >
              {showOriginal ? "VER STREET VIEW" : "VER ORIGINAL"}
            </button>
          )}
        </div>
        <button
          onClick={() => {
            toggleExcluido(point.id);
            toast.success(point.excluido ? "Ponto restaurado." : "Ponto excluído da exportação.");
          }}
          className={`absolute top-2 right-2 p-1.5 rounded-md transition-colors z-20 ${
            point.excluido
              ? "bg-success/80 text-white hover:bg-success"
              : "bg-black/50 text-white hover:bg-destructive"
          }`}
          title={point.excluido ? "Restaurar ponto" : "Excluir ponto da exportação"}
        >
          <Trash2 className="size-3.5" />
        </button>
        <button
          onClick={() => setEditOpen(true)}
          className="absolute top-2 right-10 p-1.5 rounded-md bg-black/50 text-white hover:bg-primary transition-colors z-20"
          title="Editar dados do ponto"
        >
          <Pencil className="size-3.5" />
        </button>
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

        <div className="mt-auto grid grid-cols-2 gap-1.5 pt-2">
          <Button
            size="sm"
            variant="secondary"
            className="w-full px-2"
            disabled={!validCoords}
            onClick={() => window.open(googleMapsLink(point.lat, point.lng), "_blank")}
            title="Ver no Mapa"
          >
            <Map className="size-3.5" />
            <span className="text-xs">Mapa</span>
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="w-full px-2"
            disabled={!validCoords}
            onClick={() => setOpen(true)}
            title="Ajustar Foto"
          >
            <Camera className="size-3.5" />
            <span className="text-xs">Ajustar</span>
          </Button>
        </div>

        <div className="flex gap-2 border-t border-border/50 pt-1 mt-1">
          {hasOriginalPhoto && (
            <Button
              size="sm"
              variant="ghost"
              className="flex-1 text-muted-foreground text-[10px] h-8"
              onClick={() => window.open(point.foto, "_blank")}
            >
              <LinkIcon className="size-3.5 mr-1" /> Link Original
            </Button>
          )}
          {(point.foto_url || point.adjustedPhoto?.url) && (
            <Button
              size="sm"
              variant="ghost"
              className="flex-1 text-primary text-[10px] h-8 font-semibold"
              onClick={() => {
                const url = point.foto_url || point.adjustedPhoto!.url;
                window.open(url, "_blank");
              }}
            >
              <LinkIcon className="size-3.5 mr-1" /> Link Nova Foto
            </Button>
          )}
        </div>
      </div>

      <StreetViewAdjustModal
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (v) setModalPointId(point.id);
        }}
        point={modalPoint}
        onPrev={modalIndex > 0 ? goPrev : undefined}
        onNext={modalIndex >= 0 && modalIndex < points.length - 1 ? goNext : undefined}
        position={modalIndex >= 0 ? { current: modalIndex + 1, total: points.length } : undefined}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar ponto</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Código</Label>
              <Input value={form.cod} onChange={(e) => setForm({ ...form, cod: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Formato</Label>
              <Input value={form.formato} onChange={(e) => setForm({ ...form, formato: e.target.value })} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Endereço</Label>
              <Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Bairro</Label>
              <Input value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cidade</Label>
              <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Latitude</Label>
              <Input
                value={form.lat}
                onChange={(e) => setForm({ ...form, lat: e.target.value })}
                placeholder="-25.4284"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Longitude</Label>
              <Input
                value={form.lng}
                onChange={(e) => setForm({ ...form, lng: e.target.value })}
                placeholder="-49.2733"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Empresa</Label>
              <Input value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Alterar latitude/longitude irá atualizar o Street View e o ponto voltará para "AGUARDANDO".
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}