import { useState, useEffect, useRef } from "react";
import { Map, Camera, Link as LinkIcon, Trash2, Pencil, Loader2 } from "lucide-react";
import type { Point } from "@/lib/outdoorscan/types";
import { loadGoogleMapsApi, googleMapsLink } from "@/lib/outdoorscan/streetview";
import { acquireThumbSlot } from "@/lib/outdoorscan/thumbQueue";
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

function StreetViewPreview({ point, onReady }: { point: Point; onReady?: () => void }) {
  const onReadyRef = useRef(onReady);
  const [tileUrls, setTileUrls] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    let cancelled = false;
    setTileUrls([]);
    setFailed(false);

    const init = async () => {
      try {
        await loadGoogleMapsApi();
        if (cancelled) return;
        const google = (window as any).google;
        const service = new google.maps.StreetViewService();
        service.getPanorama(
          {
            location: { lat: point.lat, lng: point.lng },
            radius: 80,
            source: google.maps.StreetViewSource?.OUTDOOR,
          },
          (data: any, status: any) => {
            if (cancelled) return;
            if (status !== "OK" || !data?.location?.pano) {
              setFailed(true);
              onReadyRef.current?.();
              return;
            }

            const zoom = 3;
            const cols = 1 << zoom;
            const rows = 1 << (zoom - 1);
            const desiredHeading = point.headingSalvo ?? point.adjustedPhoto?.heading ?? 0;
            const centerHeading = data.tiles?.centerHeading ?? data.tiles?.originHeading ?? 0;
            const normalizedHeading = (((desiredHeading - centerHeading + 180) % 360) + 360) % 360;
            const centerX = Math.floor((normalizedHeading / 360) * cols);
            const y = Math.max(0, Math.min(rows - 1, Math.floor(rows / 2) - 1));
            const tile = (x: number) =>
              `https://streetviewpixels-pa.googleapis.com/v1/tile?cb_client=maps_sv.tactile&panoid=${encodeURIComponent(data.location.pano)}&x=${((x % cols) + cols) % cols}&y=${y}&zoom=${zoom}&nbt=1&fover=2`;

            setTileUrls([tile(centerX), tile(centerX + 1)]);
          },
        );
      } catch {
        if (!cancelled) {
          setFailed(true);
          onReadyRef.current?.();
        }
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [point.id, point.lat, point.lng, point.headingSalvo, point.adjustedPhoto?.heading]);

  const handleTileLoad = () => {
    onReadyRef.current?.();
  };

  const handleTileError = () => {
    setFailed(true);
    onReadyRef.current?.();
  };

  return (
    <>
      {!tileUrls.length && !failed && (
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
      {tileUrls.length > 0 && (
        <div className="grid h-full w-full grid-cols-2 overflow-hidden">
          {tileUrls.map((url, index) => (
            <img
              key={`${url}-${index}`}
              src={url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              onLoad={handleTileLoad}
              onError={handleTileError}
            />
          ))}
        </div>
      )}
    </>
  );
}

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

  const [savedPhotoBroken, setSavedPhotoBroken] = useState(false);
  const previewUrl = point.foto_url && !savedPhotoBroken ? point.foto_url : "";
  // Se não tiver link na planilha (point.foto), forçamos showOriginal como false (Street View)
  const [originalBroken, setOriginalBroken] = useState(false);
  const [streetViewFrameLoaded, setStreetViewFrameLoaded] = useState(false);
  const hasOriginalPhoto = !!(point.foto && point.foto.trim() !== "" && !point.foto.toLowerCase().includes("not found") && point.foto !== "link da imagem nao localizado") && !originalBroken;
  const [showOriginal, setShowOriginal] = useState(hasOriginalPhoto);

  // Fila: só começa a carregar o thumb do Street View quando um slot liberar.
  // Fotos originais (imgbb) ou foto_url própria não passam pela fila.
  const needsQueue = !previewUrl && !(showOriginal && hasOriginalPhoto) && validCoords;
  const [thumbReady, setThumbReady] = useState(!needsQueue);
  const [releaseSlot, setReleaseSlot] = useState<null | (() => void)>(null);

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
      setReleaseSlot(() => r);
      setThumbReady(true);
    });
    return () => {
      cancelled = true;
      if (release) release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsQueue, point.id]);

  // Safety net: se o img não disparar onLoad/onError em 10s (imagem cacheada,
  // hidden tab, etc.), libera o slot para não travar a fila inteira.
  useEffect(() => {
    if (!thumbReady || !releaseSlot) return;
    const t = setTimeout(() => {
      finishSlot();
    }, 10000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thumbReady, releaseSlot]);

  const finishSlot = () => {
    if (releaseSlot) {
      releaseSlot();
      setReleaseSlot(null);
    }
  };

  // Quando o usuário escolhe "Usar Nova Foto" no modal, alternar automaticamente
  // para mostrar a nova foto no card.
  useEffect(() => {
    if (point.adjustedPhoto?.url) {
      setShowOriginal(false);
    }
  }, [point.adjustedPhoto?.url]);

  useEffect(() => {
    setSavedPhotoBroken(false);
    setStreetViewFrameLoaded(false);
  }, [point.id, point.lat, point.lng, point.foto_url]);

  const showingOriginal = showOriginal && hasOriginalPhoto;
  const useStreetViewFrame = validCoords && !showingOriginal && !previewUrl;

  return (
    <div className={`rounded-xl border border-border bg-card overflow-hidden flex flex-col group relative transition-opacity ${point.excluido ? 'opacity-40 grayscale' : ''}`}>
      {point.excluido && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 pointer-events-none">
          <span className="text-xs font-bold text-white bg-black/60 px-2 py-1 rounded">EXCLUÍDO</span>
        </div>
      )}
      <div className="relative aspect-[2/1] bg-muted">
        {validCoords ? (
          thumbReady ? (
            useStreetViewFrame ? (
              <>
                {!streetViewFrameLoaded && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
                    <Loader2 className="size-5 animate-spin" />
                    <span className="text-[10px]">Carregando Street View…</span>
                  </div>
                )}
                <div className={`h-full w-full transition-opacity duration-300 ${streetViewFrameLoaded ? "opacity-100" : "opacity-0"}`}>
                  <StreetViewPreview point={point} onReady={() => { setStreetViewFrameLoaded(true); finishSlot(); }} />
                </div>
              </>
            ) : (
              <img 
                src={showingOriginal ? point.foto : previewUrl} 
                alt={point.endereco} 
                className="w-full h-full object-cover transition-opacity duration-300" 
                loading="lazy" 
                onError={(e) => {
                  finishSlot();
                  const img = e.currentTarget;
                  // Detecta imagens quebradas (imgbb "image not found" tem dimensões pequenas)
                  if (showingOriginal && (img.naturalWidth === 0 || img.naturalWidth <= 400)) {
                    setOriginalBroken(true);
                    setShowOriginal(false);
                    return;
                  }
                  if (!showingOriginal && point.foto_url) {
                    setSavedPhotoBroken(true);
                  }
                }}
                onLoad={(e) => {
                  finishSlot();
                  const img = e.currentTarget;
                  // imgbb placeholder "image not found" é ~400x300
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
          if (cancelled) return;
          const status = panorama?.getStatus?.();
          if ((window as any).google?.maps?.StreetViewStatus && status === (window as any).google.maps.StreetViewStatus.ZERO_RESULTS) {
            setFailed(true);
            onReadyRef.current?.();
            return;
          }
          setLoaded(true);
          onReadyRef.current?.();
        };

        listeners = [
          panorama.addListener("status_changed", markReady),
          panorama.addListener("pano_changed", markReady),
        ];
        window.setTimeout(markReady, 2500);
      } catch {
        if (!cancelled) {
          setFailed(true);
          onReadyRef.current?.();
        }
      }
    };

    init();
    return () => {
      cancelled = true;
      listeners.forEach((listener) => listener?.remove?.());
      if (panorama) panorama.setVisible(false);
    };
  }, [point.id, point.lat, point.lng, point.headingSalvo, point.pitchSalvo, point.adjustedPhoto?.heading, point.adjustedPhoto?.pitch]);

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
      <div ref={containerRef} className="h-full w-full pointer-events-none" />
    </>
  );
}

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

  const previewUrl = point.foto_url || "";
  // Se não tiver link na planilha (point.foto), forçamos showOriginal como false (Street View)
  const [originalBroken, setOriginalBroken] = useState(false);
  const [streetViewFrameLoaded, setStreetViewFrameLoaded] = useState(false);
  const hasOriginalPhoto = !!(point.foto && point.foto.trim() !== "" && !point.foto.toLowerCase().includes("not found") && point.foto !== "link da imagem nao localizado") && !originalBroken;
  const [showOriginal, setShowOriginal] = useState(hasOriginalPhoto);

  // Fila: só começa a carregar o thumb do Street View quando um slot liberar.
  // Fotos originais (imgbb) ou foto_url própria não passam pela fila.
  const needsQueue = !point.foto_url && !(showOriginal && hasOriginalPhoto) && validCoords;
  const [thumbReady, setThumbReady] = useState(!needsQueue);
  const [releaseSlot, setReleaseSlot] = useState<null | (() => void)>(null);

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
      setReleaseSlot(() => r);
      setThumbReady(true);
    });
    return () => {
      cancelled = true;
      if (release) release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsQueue, point.id]);

  // Safety net: se o img não disparar onLoad/onError em 10s (imagem cacheada,
  // hidden tab, etc.), libera o slot para não travar a fila inteira.
  useEffect(() => {
    if (!thumbReady || !releaseSlot) return;
    const t = setTimeout(() => {
      finishSlot();
    }, 10000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thumbReady, releaseSlot]);

  const finishSlot = () => {
    if (releaseSlot) {
      releaseSlot();
      setReleaseSlot(null);
    }
  };

  // Quando o usuário escolhe "Usar Nova Foto" no modal, alternar automaticamente
  // para mostrar a nova foto no card.
  useEffect(() => {
    if (point.adjustedPhoto?.url) {
      setShowOriginal(false);
    }
  }, [point.adjustedPhoto?.url]);

  useEffect(() => {
    setStreetViewFrameLoaded(false);
  }, [point.id, point.lat, point.lng, point.foto_url]);

  const showingOriginal = showOriginal && hasOriginalPhoto;
  const useStreetViewFrame = validCoords && !showingOriginal && !point.foto_url;

  return (
    <div className={`rounded-xl border border-border bg-card overflow-hidden flex flex-col group relative transition-opacity ${point.excluido ? 'opacity-40 grayscale' : ''}`}>
      {point.excluido && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 pointer-events-none">
          <span className="text-xs font-bold text-white bg-black/60 px-2 py-1 rounded">EXCLUÍDO</span>
        </div>
      )}
      <div className="relative aspect-[2/1] bg-muted">
        {validCoords ? (
          thumbReady ? (
            useStreetViewFrame ? (
              <>
                {!streetViewFrameLoaded && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
                    <Loader2 className="size-5 animate-spin" />
                    <span className="text-[10px]">Carregando Street View…</span>
                  </div>
                )}
                <div className={`h-full w-full transition-opacity duration-300 ${streetViewFrameLoaded ? "opacity-100" : "opacity-0"}`}>
                  <StreetViewPreview point={point} onReady={() => setStreetViewFrameLoaded(true)} />
                </div>
              </>
            ) : (
              <img 
                src={showingOriginal ? point.foto : previewUrl} 
                alt={point.endereco} 
                className="w-full h-full object-cover transition-opacity duration-300" 
                loading="lazy" 
                onError={(e) => {
                  finishSlot();
                  const img = e.currentTarget;
                  // Detecta imagens quebradas (imgbb "image not found" tem dimensões pequenas)
                  if (showingOriginal && (img.naturalWidth === 0 || img.naturalWidth <= 400)) {
                    setOriginalBroken(true);
                    setShowOriginal(false);
                    return;
                  }
                }}
                onLoad={(e) => {
                  finishSlot();
                  const img = e.currentTarget;
                  // imgbb placeholder "image not found" é ~400x300
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