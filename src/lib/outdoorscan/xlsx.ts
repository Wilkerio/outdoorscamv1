import * as XLSX from "xlsx";
import type { Point } from "./types";

const REQUIRED = ["Cod.", "Endereço", "Bairro", "Cidade", "Latitude", "Longitude", "Formato", "Foto", "Empresa"] as const;

function normalizeCoord(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  if (!Number.isFinite(n)) return NaN;
  return Math.abs(n) > 180 ? n / 1_000_000 : n;
}

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
      lat: normalizeCoord(r["Latitude"]),
      lng: normalizeCoord(r["Longitude"]),
      formato: String(r["Formato"] ?? "").trim(),
      foto: String(r["Foto"] ?? "").trim(),
      empresa: String(r["Empresa"] ?? "").trim(),
      status: "AGUARDANDO",
    };
    return point;
  });
}

export { REQUIRED };