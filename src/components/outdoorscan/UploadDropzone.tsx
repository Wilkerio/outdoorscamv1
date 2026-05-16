import { useRef, useState } from "react";
import { Upload, FileSpreadsheet } from "lucide-react";
import { parseXlsx } from "@/lib/outdoorscan/xlsx";
import { useSession } from "@/context/SessionContext";
import { toast } from "sonner";

 export function UploadDropzone() {
   const { setPoints, points, log } = useSession();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = async (f: File) => {
    if (!/\.xlsx$/i.test(f.name)) {
      toast.error("Envie um arquivo .xlsx");
      return;
    }
     try {
       const pts = await parseXlsx(f, log);
       setPoints(pts);
      setFileName(f.name);
      toast.success(`${pts.length} ponto(s) carregado(s)`);
    } catch (e) {
      toast.error("Falha ao ler a planilha");
      console.error(e);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) void handleFile(f);
      }}
      onClick={() => inputRef.current?.click()}
      className={`relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
        dragOver ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-accent/40"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx"
        className="absolute inset-0 opacity-0 cursor-pointer"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      <div className="flex flex-col items-center gap-3 pointer-events-none">
        <div className="size-12 rounded-full bg-primary/15 text-primary flex items-center justify-center">
          {fileName ? <FileSpreadsheet className="size-6" /> : <Upload className="size-6" />}
        </div>
        {fileName ? (
          <>
            <div className="font-medium">{fileName}</div>
            <div className="text-sm text-muted-foreground">
              {points.length} ponto(s) prontos — solte outra planilha para substituir
            </div>
          </>
        ) : (
          <>
            <div className="font-medium">Arraste sua planilha .xlsx aqui</div>
            <div className="text-sm text-muted-foreground">ou clique para selecionar</div>
            <div className="text-xs text-muted-foreground mt-2">
              Colunas: Cod. | Endereço | Bairro | Cidade | Latitude | Longitude | Formato | Foto | Empresa
            </div>
          </>
        )}
      </div>
    </div>
  );
}