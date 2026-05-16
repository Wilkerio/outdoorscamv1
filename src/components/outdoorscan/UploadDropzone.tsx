import * as XLSX from "xlsx";
import { useSession } from "@/context/SessionContext";
import type { Point } from "@/lib/outdoorscan/types";

export function UploadDropzone() {
  const { setPoints, log } = useSession();

  return (
    <div style={{ padding: "20px", background: "rgba(255,255,255,0.05)", borderRadius: "8px", border: "1px solid #333", marginBottom: "20px" }}>
      <p style={{ fontWeight: "bold", marginBottom: "10px", color: "#fff" }}>Selecione sua planilha:</p>
      <input
        type="file"
        accept=".xlsx"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          log("info", `Lendo: ${file.name}`);
          const buf = await file.arrayBuffer();
           const wb = XLSX.read(buf);
           const sheetName = wb.SheetNames[0];
           const ws = wb.Sheets[sheetName];
           const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });
           const colunasOriginais = rows.length > 0 ? Object.keys(rows[0]) : [];
           
           const norm: Point[] = rows.map((r, i) => {
             const n: any = {};
             Object.keys(r).forEach((k) => (n[k.trim()] = typeof r[k] === "string" ? r[k].trim() : r[k]));
             
             return {
               id: `${Date.now()}-${i}`,
               cod: String(n["Cod."] || n["Código"] || i),
               lat: parseFloat(String(n["Latitude"] || 0).replace(",", ".")),
               lng: parseFloat(String(n["Longitude"] || 0).replace(",", ".")),
               status: "AGUARDANDO",
               endereco: n["Endereço"] || "",
               bairro: n["Bairro"] || "",
               cidade: n["Cidade"] || "",
               formato: n["Formato"] || "",
               empresa: n["Empresa"] || "",
               foto: n["Foto"] || "",
               originalData: r,
             };
           });
           
           setPoints(norm, sheetName, colunasOriginais);
           log("success", `✅ ${norm.length} pontos carregados`);
        }}
      />
    </div>
  );
}