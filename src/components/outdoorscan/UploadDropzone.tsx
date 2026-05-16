import * as XLSX from "xlsx";
import { useSession } from "@/context/SessionContext";
import type { Point } from "@/lib/outdoorscan/types";

export function UploadDropzone() {
  const { setPoints, log } = useSession();

  return (
    <div style={{ padding: "20px", background: "white", borderRadius: "8px", border: "1px solid #ccc", marginBottom: "20px" }}>
      <p style={{ fontWeight: "bold", marginBottom: "10px" }}>Selecione sua planilha:</p>
      <input
        type="file"
        accept=".xlsx"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          log("info", `Lendo: ${file.name}`);
          const buf = await file.arrayBuffer();
          const wb = XLSX.read(buf);
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });
          
          const norm: Point[] = rows.map((r, i) => {
            const n: any = {};
            Object.keys(r).forEach((k) => (n[k.trim()] = typeof r[k] === "string" ? r[k].trim() : r[k]));
            
            // Mantemos o mapeamento mínimo necessário para o resto do app não quebrar
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
            };
          });
          
          setPoints(norm);
          log("success", `✅ ${norm.length} pontos carregados`);
        }}
      />
    </div>
  );
}