import * as XLSX from "xlsx";
import { useSession } from "@/context/SessionContext";
import type { Point } from "@/lib/outdoorscan/types";
import { normalizeCoord } from "@/lib/outdoorscan/xlsx";

async function geocodeEndereco(
  endereco: string,
  bairro: string,
  cidade: string,
  apiKey: string
): Promise<{ lat: number; lng: number; bairroResolvido: string } | null> {
  const query = [endereco, bairro, cidade, "Brasil"]
    .filter(Boolean)
    .join(", ");
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== "OK" || !data.results?.[0]) return null;
    const result = data.results[0];
    const loc = result.geometry.location;
    const bairroResolvido =
      result.address_components?.find((c: any) =>
        c.types.includes("sublocality") ||
        c.types.includes("sublocality_level_1") ||
        c.types.includes("neighborhood")
      )?.long_name ?? "";
    return { lat: loc.lat, lng: loc.lng, bairroResolvido };
  } catch {
    return null;
  }
}

async function reverseGeocodeLatLng(
  lat: number,
  lng: number,
  apiKey: string
): Promise<string> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== "OK" || !data.results?.[0]) return "";
    const bairro =
      data.results[0].address_components?.find((c: any) =>
        c.types.includes("sublocality") ||
        c.types.includes("sublocality_level_1") ||
        c.types.includes("neighborhood")
      )?.long_name ?? "";
    return bairro;
  } catch {
    return "";
  }
}

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
          
          let invalidos = 0;
          const norm: Point[] = rows.map((r, i) => {
            const n: any = {};
            Object.keys(r).forEach((k) => (n[k.trim()] = typeof r[k] === "string" ? r[k].trim() : r[k]));

            const lat = normalizeCoord(n["Latitude"], "lat");
            const lng = normalizeCoord(n["Longitude"], "lng");
            const cod = String(n["Cod."] || n["Código"] || i);
            const latOk = lat !== null && Math.abs(lat) <= 90;
            const lngOk = lng !== null && Math.abs(lng) <= 180;
            log("info", `${cod} — Lat: ${n["Latitude"]} → ${lat} | Lng: ${n["Longitude"]} → ${lng}`);
            if (!latOk || !lngOk) {
              invalidos++;
              log("warn", `⚠️ ${cod} — Coordenadas inválidas: ${n["Latitude"]}, ${n["Longitude"]}`);
            }

            return {
              id: `${Date.now()}-${i}`,
              cod,
              lat: latOk ? (lat as number) : NaN,
              lng: lngOk ? (lng as number) : NaN,
              status: latOk && lngOk ? "AGUARDANDO" : "ERRO",
              endereco: n["Endereço"] || "",
              bairro: n["Bairro"] || "",
              cidade: n["Cidade"] || "",
              formato: n["Formato"] || "",
              empresa: n["Empresa"] || "",
              foto: n["Foto"] || "",
              originalData: r,
            };
          });
          
          // Enriquecer pontos sem coordenadas ou sem bairro
          const GMAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
          const precisamEnriquecimento = norm.filter(
            (p) => isNaN(p.lat) || isNaN(p.lng) || !p.bairro
          );

          if (precisamEnriquecimento.length > 0) {
            log("info", `🌐 Buscando coordenadas/bairro para ${precisamEnriquecimento.length} ponto(s)...`);
            await Promise.all(
              precisamEnriquecimento.map(async (p) => {
                const resultado = await geocodeEndereco(
                  p.endereco,
                  p.bairro,
                  p.cidade,
                  GMAPS_KEY
                );
                if (!resultado) {
                  log("warn", `⚠️ ${p.cod} — Geocoding sem resultado`);
                  return;
                }
                const idx = norm.findIndex((n) => n.id === p.id);
                if (idx === -1) return;
                if (isNaN(norm[idx].lat) || isNaN(norm[idx].lng)) {
                  norm[idx].lat = resultado.lat;
                  norm[idx].lng = resultado.lng;
                  norm[idx].status = "AGUARDANDO";
                  log("info", `✅ ${p.cod} — Coordenadas resolvidas: ${resultado.lat}, ${resultado.lng}`);
                }
                if (!norm[idx].bairro) {
                  let bairroFinal = resultado.bairroResolvido;

                  // Se o geocoding por endereço não resolveu o bairro mas há coordenadas válidas, tenta reverse geocoding
                  if (!bairroFinal && !isNaN(norm[idx].lat) && !isNaN(norm[idx].lng)) {
                    bairroFinal = await reverseGeocodeLatLng(norm[idx].lat, norm[idx].lng, GMAPS_KEY);
                  }

                  if (bairroFinal) {
                    norm[idx].bairro = bairroFinal;
                    log("info", `✅ ${p.cod} — Bairro resolvido: ${bairroFinal}`);
                  }
                }
              })
            );
          }
          
          setPoints(norm, sheetName, colunasOriginais);
          log("success", `✅ ${norm.length} pontos carregados${invalidos ? ` (${invalidos} com coordenadas inválidas)` : ""}`);
        }}
      />
    </div>
  );
}
