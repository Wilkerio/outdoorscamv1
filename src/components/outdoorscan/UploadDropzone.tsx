import * as XLSX from "xlsx";
import { useRef } from "react";
import { Upload } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { Button } from "@/components/ui/button";
import type { Point } from "@/lib/outdoorscan/types";

 export function UploadDropzone() {
  const { setPoints, log } = useSession();
   const fileInputRef = useRef<HTMLInputElement>(null);
 
  const normalizeCoord = (valor: any) => {
    if (valor === null || valor === undefined || valor === "") return null;
    const num = parseFloat(String(valor).replace(",", "."));
    if (isNaN(num)) return null;
    if (Math.abs(num) > 180) return num / 1_000_000;
    return num;
   };
 
  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    log("info", `Lendo arquivo: ${file.name}...`);
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });

    const normalizados: Point[] = rows.map((row, i) => {
      const novo: any = {};
      Object.keys(row).forEach((k) => {
        novo[k.trim()] = typeof row[k] === "string" ? row[k].trim() : row[k];
      });

      return {
        id: `${Date.now()}-${i}`,
        cod: String(novo["Cod."] ?? "").trim(),
        endereco: String(novo["Endereço"] ?? "").trim(),
        bairro: String(novo["Bairro"] ?? "").trim(),
        cidade: String(novo["Cidade"] ?? "").trim(),
        lat: normalizeCoord(novo["Latitude"]) ?? NaN,
        lng: normalizeCoord(novo["Longitude"]) ?? NaN,
        rawLat: novo["Latitude"],
        rawLng: novo["Longitude"],
        formato: String(novo["Formato"] ?? "").trim(),
        foto: String(novo["Foto"] ?? "").trim(),
        empresa: String(novo["Empresa"] ?? "").trim(),
        status: "AGUARDANDO",
      };
    });

    setPoints(normalizados);
    log("success", `✅ ${normalizados.length} pontos carregados`);
  };

   return (
    <div className="flex justify-center p-8 bg-card rounded-xl border border-border">
       <input
         ref={fileInputRef}
         type="file"
        accept=".xlsx,.xls"
         className="hidden"
         onChange={(e) => handleFile(e.target.files?.[0])}
       />
      <Button onClick={() => fileInputRef.current?.click()} className="gap-2 h-12 px-6">
        <Upload className="size-4" /> 📂 Selecionar Planilha .xlsx
      </Button>
     </div>
   );
 }