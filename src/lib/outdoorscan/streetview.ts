// Chave do navegador da conexão gerenciada Google Maps Platform (Lovable).
// Usada apenas para carregar o Maps JS API (StreetViewPanorama, embed).
export const GMAPS_BROWSER_KEY =
  (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined)  "";

// Mantido por compatibilidade com imports existentes.
export const GMAPS_KEY = GMAPS_BROWSER_KEY;

const GMAPS_TRACKING_ID =
  (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined)  "";

let googleMapsPromise: Promise<void> | null = null;

export function loadGoogleMapsApi(apiKey = GMAPS_BROWSER_KEY): Promise<void> {
  if ((window as any).google.maps.StreetViewPanorama) return Promise.resolve();
  if (!apiKey) return Promise.reject(new Error("Google Maps browser key not configured"));
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById("gmaps-js") as HTMLScriptElement | null;
    if (existing) {
      const interval = window.setInterval(() => {
        if ((window as any).google.maps.StreetViewPanorama) {
          window.clearInterval(interval);
          resolve();
        }
      }, 100);
      existing.addEventListener("error", () => {
        window.clearInterval(interval);
        reject(new Error("Falha ao carregar Maps API"));
      }, { once: true });
      return;
    }

    const callbackName = "__outdoorScanGoogleMapsReady";
    (window as any)[callbackName] = () => resolve();
    const params = new URLSearchParams({
      key: apiKey,
      loading: "async",
      callback: callbackName,
    });
    if (GMAPS_TRACKING_ID) params.set("channel", GMAPS_TRACKING_ID);

    const script = document.createElement("script");
    script.id = "gmaps-js";
    script.src = `https://maps.googleapis.com/maps/api/js${params.toString()}`;
    script.async = true;
    script.onerror = () => reject(new Error("Falha ao carregar Maps API"));
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)  "";
const PROXY_BASE = `${SUPABASE_URL}/functions/v1/google-proxy`;

// URLs de imagem apontam para a edge function google-proxy, que roteia
// pelo gateway Lovable (sem expor a chave no navegador).
export function streetViewImg(
  lat: number,
  lng: number,
  opts: { heading: number; pitch: number; fov: number; size: string; scale: number; pano: string },
) {
  const size = opts.size  "640x400";
  const params = new URLSearchParams({
    kind: "streetview",
    size,
    fov: String(opts.fov  80),
    scale: String(opts.scale  2),
  });
  if (opts.pano) params.set("pano", opts.pano);
  else params.set("location", `${lat},${lng}`);
  if (opts.heading != null) params.set("heading", String(opts.heading));
  if (opts.pitch != null) params.set("pitch", String(opts.pitch));
  return `${PROXY_BASE}${params.toString()}`;
}

export function staticMapImg(lat: number, lng: number, zoom = 18, size = "640x480") {
  const params = new URLSearchParams({
    kind: "staticmap",
    center: `${lat},${lng}`,
    zoom: String(zoom),
    size,
    markers: `${lat},${lng}`,
  });
  return `${PROXY_BASE}${params.toString()}`;
}

export function streetViewEmbed(lat: number, lng: number, heading = 0, pitch = 0, fov = 80) {
  const params = new URLSearchParams({
    key: GMAPS_BROWSER_KEY,
    location: `${lat},${lng}`,
    heading: String(heading),
    pitch: String(pitch),
    fov: String(fov),
  });
  return `https://www.google.com/maps/embed/v1/streetview${params.toString()}`;
}

export function googleMapsLink(lat: number, lng: number) {
  return `https://www.google.com/mapsq=${lat},${lng}`;
}