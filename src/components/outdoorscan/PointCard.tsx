import { useEffect, useRef, useState } from "react";
import { Camera, Link as LinkIcon, Loader2, Map, Pencil, Trash2 } from "lucide-react";
import type { Point } from "@/lib/outdoorscan/types";
import { googleMapsLink } from "@/lib/outdoorscan/streetview";
import { acquireThumbSlot } from "@/lib/outdoorscan/thumbQueue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StreetViewAdjustModal } from "./StreetViewAdjustModal";
import { toast } from "sonner";
import { useSession } from "@/context/SessionContext";
import { supabase } from "@/integrations/supabase/client";

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

function isValidOriginalPhoto(value?: string) {
  const photo = (value ?? "").trim();
  return !!photo && !photo.toLowerCase().includes("not found") && photo !== "link da imagem nao localizado";
}

type StreetViewPreviewResult = "loaded" | "failed";

function StreetViewPreview({ point, onReady }: { point: Point; onReady: (result: StreetViewPreviewResult) => void }) {
  const onReadyRef = useRef(onReady);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [imgSrc, setImgSrc] = useState("");

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setLoaded(false);
    setImgSrc("");
    const heading = point.headingSalvo ?? point.adjustedPhoto?.heading ?? 0;
    const pitch = point.adjustedPhoto?.pitch ?? 0;

    const loadPreview = async () => {
      // Usar invoke em vez de <img src> direto: a função protegida precisa dos
      // headers do cliente, então o GET público virava 401 e todos os cards
      // apareciam como "Street View indisponível". radius=300 faz a Street View
      // Static API buscar cobertura próxima quando o ponto exato não tem imagem,
      // em vez de falhar.
      const apiUrl = `https://maps.googleapis.com/maps/api/streetview?size=640x320&scale=2&location=${point.lat},${point.lng}&heading=${heading}&pitch=${pitch}&fov=80&radius=300&return_error_code=true`;
      const { data, error } = await supabase.functions.invoke("google-proxy", {
        body: { url: apiUrl },
      });
      if (cancelled) return;
      if (error || !data?.image) {
        setFailed(true);
        onReadyRef.current("failed");
        return;
      }
      setImgSrc(`data:${data.contentType ?? "image/jpeg"};base64,${data.image}`);
    };

    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [point.id, point.lat, point.lng, point.headingSalvo, point.adjustedPhoto?.heading, point.adjustedPhoto?.pitch]);

  return (
    <>
      {!loaded && !failed && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-muted text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-[10px]">Carregando Street View…</span>
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted px-3 text-center text-xs text-muted-foreground">
          Street View indisponível
        </div>
      )}
      {imgSrc && !failed && (
        <img
          src={imgSrc}
          alt={`Street View de ${point.endereco}`}
          className="h-full w-full object-cover"
          style={{ filter: "brightness(90%) contrast(136%) saturate(151%)" }}
          draggable={false}
          onLoad={(event) => {
            const img = event.currentTarget;
            if (img.naturalWidth <= 32 || img.naturalHeight <= 32) {
              setFailed(true);
              onReadyRef.current("failed");
              return;
            }
            setFailed(false);
            setLoaded(true);
            onReadyRef.current("loaded");
          }}
          onError={() => {
            setFailed(true);
            onReadyRef.current("failed");
          }}
        />
      )}
    </>
  );
}

export function PointCard({ point, onReady }: { point: Point; onReady?: (id: string) => void }) {
  const { points, toggleExcluido, editarPonto } = useSession();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [modalPointId, setModalPointId] = useState(point.id);
  const [originalBroken, setOriginalBroken] = useState(false);
  const [savedPhotoBroken, setSavedPhotoBroken] = useState(false);
  const [streetViewLoaded, setStreetViewLoaded] = useState(false);
  const [streetViewUnavailable, setStreetViewUnavailable] = useState(false);
  const [showOriginal, setShowOriginal] = useState(isValidOriginalPhoto(point.foto));
  const [releaseSlot, setReleaseSlot] = useState<null | (() => void)>(null);
  const readyFiredRef = useRef(false);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);
  const notifyReady = () => {
    if (readyFiredRef.current) return;
    readyFiredRef.current = true;
    onReadyRef.current?.(point.id);
  };
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

  const validCoords = Number.isFinite(point.lat) && Number.isFinite(point.lng);
  const hasOriginalPhoto = isValidOriginalPhoto(point.foto) && !originalBroken;
  const showingOriginal = showOriginal && hasOriginalPhoto;
  const savedPhotoUrl = point.foto_url && !savedPhotoBroken ? point.foto_url : "";
  const useStreetView = validCoords && !showingOriginal && !savedPhotoUrl;
  const needsQueue = useStreetView;
  const [thumbReady, setThumbReady] = useState(!needsQueue);
  const releaseSlotRef = useRef<null | (() => void)>(null);
  const modalPoint = points.find((p) => p.id === modalPointId) ?? point;
  const modalIndex = points.findIndex((p) => p.id === modalPointId);

  useEffect(() => {
    if (!validCoords) {
      notifyReady();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validCoords]);

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

  useEffect(() => {
    if (point.adjustedPhoto?.url) setShowOriginal(false);
  }, [point.adjustedPhoto?.url]);

  useEffect(() => {
    setSavedPhotoBroken(false);
    setStreetViewLoaded(false);
    setStreetViewUnavailable(false);
  }, [point.id, point.lat, point.lng, point.foto_url]);

  useEffect(() => {
    if (!needsQueue) {
      setThumbReady(true);
      return;
    }
    setThumbReady(false);
    let cancelled = false;
    let release: (() => void) | null = null;
    acquireThumbSlot().then((r) => {
      if (cancelled) {
        r();
        return;
      }
      release = r;
      releaseSlotRef.current = r;
      setReleaseSlot(() => r);
      setThumbReady(true);
    });
    return () => {
      cancelled = true;
      if (release) {
        release();
        if (releaseSlotRef.current === release) releaseSlotRef.current = null;
      }
    };
  }, [needsQueue, point.id]);

  const finishSlot = () => {
    notifyReady();
    const release = releaseSlotRef.current ?? releaseSlot;
    if (!release) return;
    release();
    releaseSlotRef.current = null;
    setReleaseSlot(null);
  };

  const releaseThumbSlot = () => {
    const release = releaseSlotRef.current ?? releaseSlot;
    if (!release) return;
    release();
    releaseSlotRef.current = null;
    setReleaseSlot(null);
  };

  useEffect(() => {
    if (!thumbReady || !releaseSlot) return;
    const timeout = window.setTimeout(() => {
      setStreetViewUnavailable(true);
      finishSlot();
    }, 14000);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thumbReady, releaseSlot]);

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

  const goPrev = () => {
    if (modalIndex > 0) setModalPointId(points[modalIndex - 1].id);
  };

  const goNext = () => {
    if (modalIndex >= 0 && modalIndex < points.length - 1) setModalPointId(points[modalIndex + 1].id);
  };

  return (
    <div className={`rounded-xl border border-border bg-card overflow-hidden flex flex-col group relative transition-opacity ${point.excluido ? "opacity-40 grayscale" : ""}`}>
      {point.excluido && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 pointer-events-none">
          <span className="text-xs font-bold text-white bg-black/60 px-2 py-1 rounded">EXCLUÍDO</span>
        </div>
      )}

      <div className="relative aspect-[2/1] bg-muted">
        {validCoords ? (
          thumbReady ? (
            useStreetView ? (
              <>
                {!streetViewLoaded && !streetViewUnavailable && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
                    <Loader2 className="size-5 animate-spin" />
                    <span className="text-[10px]">Carregando Street View…</span>
                  </div>
                )}
                <div className={`h-full w-full transition-opacity duration-300 ${streetViewLoaded || streetViewUnavailable ? "opacity-100" : "opacity-0"}`}>
                  <StreetViewPreview
                    point={point}
                    onReady={(result) => {
                      if (result === "loaded") {
                        setStreetViewLoaded(true);
                        finishSlot();
                        return;
                      }
                      setStreetViewUnavailable(true);
                      finishSlot();
                    }}
                  />
                </div>
              </>
            ) : (
              <img
                src={showingOriginal ? point.foto : savedPhotoUrl}
                alt={point.endereco}
                className="w-full h-full object-cover transition-opacity duration-300"
                loading="lazy"
                onError={(e) => {
                  finishSlot();
                  const img = e.currentTarget;
                  if (showingOriginal && (img.naturalWidth === 0 || img.naturalWidth <= 400)) {
                    setOriginalBroken(true);
                    setShowOriginal(false);
                    return;
                  }
                  if (!showingOriginal && point.foto_url) setSavedPhotoBroken(true);
                }}
                onLoad={(e) => {
                  finishSlot();
                  const img = e.currentTarget;
                  if (showingOriginal && img.naturalWidth > 0 && img.naturalWidth <= 400 && img.naturalHeight <= 400) {
                    setOriginalBroken(true);
                    setShowOriginal(false);
                  }
                }}
              />
            )
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              <span className="text-[10px]">Carregando Street View…</span>
            </div>
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
            Coordenadas inválidas
          </div>
        )}

        <div className="absolute top-2 left-2 flex gap-1">
          {point.status !== "AGUARDANDO" && (
            <span className={`text-[10px] font-semibold tracking-wider px-2 py-1 rounded-md ${STATUS_STYLES[point.status]}`}>
              {STATUS_LABEL[point.status]}
            </span>
          )}
          {hasOriginalPhoto && (
            <button
              onClick={() => setShowOriginal(!showOriginal)}
              className={`text-[10px] font-semibold tracking-wider px-2 py-1 rounded-md transition-colors ${
                showOriginal ? "bg-primary text-primary-foreground" : "bg-black/50 text-white hover:bg-black/70"
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
            point.excluido ? "bg-success/80 text-white hover:bg-success" : "bg-black/50 text-white hover:bg-destructive"
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
          <Button size="sm" variant="secondary" className="w-full px-2" disabled={!validCoords} onClick={() => window.open(googleMapsLink(point.lat, point.lng), "_blank")} title="Ver no Mapa">
            <Map className="size-3.5" />
            <span className="text-xs">Mapa</span>
          </Button>
          <Button size="sm" variant="secondary" className="w-full px-2" disabled={!validCoords} onClick={() => setOpen(true)} title="Ajustar Foto">
            <Camera className="size-3.5" />
            <span className="text-xs">Ajustar</span>
          </Button>
        </div>

        <div className="flex gap-2 border-t border-border/50 pt-1 mt-1">
          {hasOriginalPhoto && (
            <Button size="sm" variant="ghost" className="flex-1 text-muted-foreground text-[10px] h-8" onClick={() => window.open(point.foto, "_blank")}>
              <LinkIcon className="size-3.5 mr-1" /> Link Original
            </Button>
          )}
          {(point.foto_url || point.adjustedPhoto?.url) && (
            <Button
              size="sm"
              variant="ghost"
              className="flex-1 text-primary text-[10px] h-8 font-semibold"
              onClick={() => window.open(point.foto_url || point.adjustedPhoto!.url, "_blank")}
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
              <Input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} placeholder="-25.4284" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Longitude</Label>
              <Input value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} placeholder="-49.2733" />
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