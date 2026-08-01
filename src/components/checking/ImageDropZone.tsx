import { useRef, useState, type DragEvent } from "react";
import { ImagePlus, X } from "lucide-react";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Falha ao ler imagem"));
    reader.readAsDataURL(file);
  });
}

export function ImageDropZone({
  value,
  onChange,
  label,
  aspect = "aspect-video",
}: {
  value?: string;
  onChange: (dataUrl: string) => void;
  label: string;
  aspect?: string;
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
    return (
      <div className={`relative ${aspect} rounded-lg overflow-hidden border border-border bg-muted group`}>
        <img src={value} alt={label} className="w-full h-full object-cover" />
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute top-2 right-2 p-1.5 rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
          title="Remover imagem"
        >
          <X className="size-3.5" />
        </button>
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
