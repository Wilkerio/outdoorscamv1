 export const GMAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? "";

export function streetViewImg(lat: number, lng: number, opts?: { heading?: number; pitch?: number; fov?: number; size?: string }) {
  // 640x640 é o máximo permitido pela Street View Static API (gratuito).
  // Usamos o tamanho cheio para que a miniatura do card fique nítida.
  const size = opts?.size ?? "640x400";
  const params = new URLSearchParams({
    size,
    location: `${lat},${lng}`,
    fov: String(opts?.fov ?? 80),
    key: GMAPS_KEY,
  });
  if (opts?.heading != null) params.set("heading", String(opts.heading));
  if (opts?.pitch != null) params.set("pitch", String(opts.pitch));
  return `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`;
}

export function streetViewMetadata(lat: number, lng: number) {
  const params = new URLSearchParams({ location: `${lat},${lng}`, key: GMAPS_KEY });
  return `https://maps.googleapis.com/maps/api/streetview/metadata?${params.toString()}`;
}

export function streetViewEmbed(lat: number, lng: number, heading = 0, pitch = 0, fov = 80) {
  const params = new URLSearchParams({
    key: GMAPS_KEY,
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