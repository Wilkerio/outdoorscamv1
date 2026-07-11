// Chave do navegador da conexão gerenciada Google Maps Platform (Lovable).
// Usada apenas para carregar o Maps JS API (StreetViewPanorama, embed).
export const GMAPS_BROWSER_KEY =
  (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined) ?? "";

// Mantido por compatibilidade com imports existentes.
export const GMAPS_KEY = GMAPS_BROWSER_KEY;

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
const PROXY_BASE = `${SUPABASE_URL}/functions/v1/google-proxy`;

// URLs de imagem apontam para a edge function google-proxy, que roteia
// pelo gateway Lovable (sem expor a chave no navegador).
export function streetViewImg(
  lat: number,
  lng: number,
  opts?: { heading?: number; pitch?: number; fov?: number; size?: string },
) {
  const size = opts?.size ?? "640x400";
  const params = new URLSearchParams({
    kind: "streetview",
    size,
    location: `${lat},${lng}`,
    fov: String(opts?.fov ?? 80),
  });
  if (opts?.heading != null) params.set("heading", String(opts.heading));
  if (opts?.pitch != null) params.set("pitch", String(opts.pitch));
  return `${PROXY_BASE}?${params.toString()}`;
}

export function staticMapImg(lat: number, lng: number, zoom = 18, size = "640x480") {
  const params = new URLSearchParams({
    kind: "staticmap",
    center: `${lat},${lng}`,
    zoom: String(zoom),
    size,
    markers: `${lat},${lng}`,
  });
  return `${PROXY_BASE}?${params.toString()}`;
}

export function streetViewEmbed(lat: number, lng: number, heading = 0, pitch = 0, fov = 80) {
  const params = new URLSearchParams({
    key: GMAPS_BROWSER_KEY,
    location: `${lat},${lng}`,
    heading: String(heading),
    pitch: String(pitch),
    fov: String(fov),
  });
  return `https://www.google.com/maps/embed/v1/streetview?${params.toString()}`;
}

export function googleMapsLink(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}