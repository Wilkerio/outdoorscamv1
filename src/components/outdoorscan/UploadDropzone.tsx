import * as XLSX from "xlsx";
import { useSession } from "@/context/SessionContext";
import type { Point } from "@/lib/outdoorscan/types";

export function UploadDropzone() {
  const { setPoints, log } = useSession();

  const normalizeCoord = (valor: any) => {
    if (valor === null || valor === undefined || valor === "") return null;
    const num = parseFloat(String(valor).replace(",", "."));
    if (isNaN(num)) return null;
    if (Math.abs(num) > 180) return num / 1_000_000;
    return num;
  };

  return (
    <div className="flex justify-center p-8 bg-card rounded-xl border border-border">
      <input
        type="file"
        accept=".xlsx,.xls"
        className="block w-full text-sm text-slate-500
          file:mr-4 file:py-2 file:px-4
          file:rounded-full file:border-0
          file:text-sm file:font-semibold
          file:bg-primary file:text-primary-foreground
          hover:file:bg-primary/90"
        onChange={async (e) => {
          const file = e.target.files?.[0];
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
        }}
      />
    </div>
  );
}