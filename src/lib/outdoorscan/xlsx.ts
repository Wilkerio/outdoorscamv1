import * as XLSX from "xlsx";
import type { Point } from "./types";

const REQUIRED = ["Cod.", "Endereço", "Bairro", "Cidade", "Latitude", "Longitude", "Formato", "Foto", "Empresa"] as const;

 export const normalizeCoord = (valor: any) => {
   if (valor === null || valor === undefined || valor === "") return null;
   const num = parseFloat(String(valor).replace(",", "."));
   if (isNaN(num)) return null;
   // Se valor absoluto > 90 (lat) ou > 180 (lng), provavelmente está sem ponto decimal
   if (Math.abs(num) > 180) return num / 1_000_000;
   return num;
 };

export async function parseXlsx(file: File): Promise<Point[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  return rows.map((raw, i) => {
    // trim header names
    const r: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) r[k.trim()] = v;

    const point: Point = {
      id: `${Date.now()}-${i}`,
      cod: String(r["Cod."] ?? "").trim(),
      endereco: String(r["Endereço"] ?? "").trim(),
      bairro: String(r["Bairro"] ?? "").trim(),
      cidade: String(r["Cidade"] ?? "").trim(),
      lat: normalizeCoord(r["Latitude"]) ?? NaN,
      lng: normalizeCoord(r["Longitude"]) ?? NaN,
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