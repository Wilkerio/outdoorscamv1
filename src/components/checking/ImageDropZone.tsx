import { useRef, useState, type DragEvent } from "react";
import { ImagePlus, Sparkles, X } from "lucide-react";
import { CHECKING_ENHANCE_FILTER } from "./slideTokens";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Falha ao ler imagem"));
    reader.readAsDataURL(file);
  });
}

// Posição = deslocamento livre em % (não mais "âncora dentro da área visível" do object-fit:cover) —
// dá pra mover mesmo sem zoom, cortando a imagem, já que a moldura recorta o que sair mesmo.
function parsePosition(pos?: string): { x: number; y: number } {
  const [x, y] = (pos ?? "0% 0%").split(" ").map((v) => parseInt(v, 10));
  return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 };
}

export function ImageDropZone({
  value,
  onChange,
  label,
  aspect = "aspect-video",
  position,
  onPositionChange,
  zoom,
  onZoomChange,
  melhorada,
  onToggleMelhorada,
  guiaCapa,
}: {
  value?: string;
  onChange: (dataUrl: string) => void;
  label: string;
  aspect?: string;
  position?: string;
  onPositionChange?: (pos: string) => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  melhorada?: boolean;
  onToggleMelhorada?: () => void;
  // Mostra por cima da prévia onde o painel preto diagonal da capa vai cobrir a foto.
  guiaCapa?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file?: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    onChange(await fileToDataUrl(file));
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    await handleFile(e.dataTransfer.files?.[0]);
  };

  if (value) {
    const { x, y } = parsePosition(position);
    // Nunca abaixo de 130% — mesmo com rascunho antigo salvo com zoom 100%, garante margem pra mover sem brecha.
    const z = Math.max(zoom ?? 100, 80);
    return (
      <div className="space-y-1.5">
        <div className={`relative ${aspect} rounded-lg overflow-hidden border border-border bg-muted group`}>
          <img
            src={value}
            alt={label}
            className="w-full h-full object-contain cursor-pointer"
            onClick={() => inputRef.current?.click()}
            title="Clique para trocar a foto"
            style={{
              transform: `translate(${x}%, ${y}%) scale(${z / 100})`,
              filter: melhorada ? CHECKING_ENHANCE_FILTER : undefined,
            }}
          />
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          {guiaCapa && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <polygon points="0,0 47,0 37.6,100 0,100" fill="black" fillOpacity={0.55} />
              <polyline points="47,0 37.6,100" stroke="#F5B400" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
            </svg>
          )}
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute top-2 right-2 p-1.5 rounded-md bg-black/60 text-white transition-colors hover:bg-destructive"
            title="Remover imagem"
          >
            <X className="size-3.5" />
          </button>
        </div>
        {guiaCapa && (
          <p className="text-[10px] text-muted-foreground">
            A área escurecida é coberta pelo painel preto da capa — só o lado claro aparece.
          </p>
        )}

        {onPositionChange && (
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] text-muted-foreground flex flex-col gap-0.5">
              Mover ↔
              <input
                type="range"
                min={-50}
                max={50}
                value={x}
                onChange={(e) => onPositionChange(`${e.target.value}% ${y}%`)}
              />
            </label>
            <label className="text-[10px] text-muted-foreground flex flex-col gap-0.5">
              Mover ↕
              <input
                type="range"
                min={-50}
                max={50}
                value={y}
                onChange={(e) => onPositionChange(`${x}% ${e.target.value}%`)}
              />
            </label>
          </div>
        )}

        {onZoomChange && (
          <label className="text-[10px] text-muted-foreground flex flex-col gap-0.5">
            Zoom — {z}%
            <input
              type="range"
              min={80}
              max={250}
              value={z}
              onChange={(e) => onZoomChange(Number(e.target.value))}
            />
          </label>
        )}

        {onToggleMelhorada && (
          <button
            type="button"
            onClick={onToggleMelhorada}
            className={`w-full flex items-center justify-center gap-1.5 text-xs h-7 rounded-md border transition-colors ${
              melhorada
                ? "bg-primary/15 text-primary border-primary/30"
                : "text-muted-foreground border-border hover:bg-accent"
            }`}
          >
            <Sparkles className="size-3.5" />
            {melhorada ? "Foto melhorada" : "Melhorar foto"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`${aspect} rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors text-center px-3 ${
        dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-accent"
      }`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <ImagePlus className="size-5 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
