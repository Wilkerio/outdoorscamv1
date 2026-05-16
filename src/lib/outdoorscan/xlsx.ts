import * as XLSX from "xlsx";
import type { Point } from "./types";

const REQUIRED = ["Cod.", "Endereço", "Bairro", "Cidade", "Latitude", "Longitude", "Formato", "Foto", "Empresa"] as const;

 export const normalizeCoord = (valor: unknown, tipo: "lat" | "lng" = "lat"): number | null => {
   if (valor === null || valor === undefined || valor === "") return null;
  const num = parseFloat(String(valor).replace(",", ".").trim());
  if (isNaN(num)) return null;
  const limite = tipo === "lat" ? 90 : 180;
  let divisor = 1;
  while (Math.abs(num / divisor) > limite && divisor < 10_000_000) {
    divisor *= 10;
  }
  return num / divisor;
 };

 export async function parseXlsx(file: File, logFn?: (lvl: any, msg: string) => void): Promise<Point[]> {
   logFn?.("info", `Lendo arquivo: ${file.name}...`);
   const buf = await file.arrayBuffer();
   const wb = XLSX.read(buf, { type: "array" });
   const ws = wb.Sheets[wb.SheetNames[0]];
   const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
 
   const rowsNormalizadas = rows.map((raw) => {
     const r: Record<string, unknown> = {};
     for (const [k, v] of Object.entries(raw)) {
       r[k.trim()] = typeof v === "string" ? v.trim() : v;
     }
     return r;
   });
 
   logFn?.("info", `${rowsNormalizadas.length} ponto(s) carregado(s) da planilha.`);
   if (rowsNormalizadas.length > 0) {
     logFn?.("info", `Colunas encontradas: ${Object.keys(rowsNormalizadas[0]).join(" | ")}`);
     logFn?.("info", `Primeiro ponto: ${JSON.stringify(rowsNormalizadas[0])}`);
   }
 
   return rowsNormalizadas.map((r, i) => {
     const point: Point = {
       id: `${Date.now()}-${i}`,
       cod: String(r["Cod."] ?? "").trim(),
       endereco: String(r["Endereço"] ?? "").trim(),
       bairro: String(r["Bairro"] ?? "").trim(),
       cidade: String(r["Cidade"] ?? "").trim(),
      lat: normalizeCoord(r["Latitude"], "lat") ?? NaN,
      lng: normalizeCoord(r["Longitude"], "lng") ?? NaN,
       rawLat: r["Latitude"],
       rawLng: r["Longitude"],
       formato: String(r["Formato"] ?? "").trim(),
       foto: String(r["Foto"] ?? "").trim(),
       empresa: String(r["Empresa"] ?? "").trim(),
       status: "AGUARDANDO",
     };
     return point;
   });
 }

export { REQUIRED };