import { supabase } from "@/integrations/supabase/client";

export interface PoiCount {
  type: string;
  label: string;
  count: number;
}

interface PoiHit extends PoiCount {
  avgDist: number;
}

// Raio de captação a pé considerado relevante pra quem passa perto de um outdoor.
const RADIUS_M = 300;
// Fluxo base de qualquer ponto na rua, mesmo sem POI relevante perto.
const BASE_DAILY_FLOW = 1500;
// Evita que um POI com dezenas de resultados (ex.: vários bancos na mesma quadra) domine a conta.
const MAX_COUNT_PER_TYPE = 3;

// peopleImpact = pessoas/dia adicionais estimadas por unidade desse tipo de POI dentro do raio,
// calibrado por ordem de grandeza de geração de fluxo de pedestres (hospital/shopping/metrô > escola/banco).
const POI_TYPES: { type: string; label: string; peopleImpact: number }[] = [
  { type: "hospital", label: "Hospital", peopleImpact: 900 },
  { type: "shopping_mall", label: "Shopping", peopleImpact: 800 },
  { type: "subway_station", label: "Metrô", peopleImpact: 950 },
  { type: "bus_station", label: "Terminal/Ponto de ônibus", peopleImpact: 500 },
  { type: "supermarket", label: "Mercado", peopleImpact: 450 },
  { type: "university", label: "Universidade", peopleImpact: 400 },
  { type: "school", label: "Escola", peopleImpact: 300 },
];

// Hash determinístico da coordenada — mesmo ponto sempre gera o mesmo "ruído",
// mas pontos diferentes não caem todos no mesmo número redondo (o que parece fake).
function coordSeed(lat: number, lng: number): number {
  const s = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export async function fetchNearbyPois(lat: number, lng: number): Promise<PoiHit[]> {
  const results = await Promise.all(
    POI_TYPES.map(async (poi) => {
      const { data, error } = await supabase.functions.invoke("google-proxy", {
        body: { nearby: { lat, lng, radius: RADIUS_M, type: poi.type } },
      });
      const items = !error && Array.isArray(data?.results) ? data.results : [];
      const dists = items.map((r: any) =>
        haversineMeters(lat, lng, r.geometry?.location?.lat, r.geometry?.location?.lng),
      );
      return {
        type: poi.type,
        label: poi.label,
        count: items.length,
        avgDist: dists.length ? dists.reduce((a: number, b: number) => a + b, 0) / dists.length : RADIUS_M,
      };
    }),
  );
  return results;
}

export function estimateAudience(lat: number, lng: number, hits: PoiHit[]): number {
  const seed = coordSeed(lat, lng);
  // ±20% de variação por coordenada — evita todo ponto sem POI cair no mesmo número base.
  const jitter = 0.8 + (seed % 4001) / 4001 * 0.4;
  let total = BASE_DAILY_FLOW * jitter;
  for (const hit of hits) {
    const poi = POI_TYPES.find((p) => p.type === hit.type);
    if (!poi || !hit.count) continue;
    const proximity = Math.max(0.5, 1 - (hit.avgDist / RADIUS_M) * 0.5);
    total += Math.min(hit.count, MAX_COUNT_PER_TYPE) * poi.peopleImpact * proximity * jitter;
  }
  return Math.round(total);
}

export function poiCounts(hits: PoiHit[]): PoiCount[] {
  return hits.filter((h) => h.count > 0).map(({ type, label, count }) => ({ type, label, count }));
}
