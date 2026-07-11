const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_BASE = 'https://connector-gateway.lovable.dev/google_maps';
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY') ?? '';
const GMAPS_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY') ?? '';

function gwHeaders() {
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    'X-Connection-Api-Key': GMAPS_KEY,
  };
}

// Rewrite a maps.googleapis.com URL to the gateway (strip client-provided key).
function toGatewayUrl(rawUrl: string): { url: string; useGateway: boolean } | null {
  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch { return null; }
  if (parsed.protocol !== 'https:') return null;
  if (parsed.hostname === 'maps.googleapis.com') {
    parsed.searchParams.delete('key');
    return { url: `${GATEWAY_BASE}${parsed.pathname}${parsed.search}`, useGateway: true };
  }
  // Street View native panorama tiles — public tile server, no key required.
  if (parsed.hostname === 'streetviewpixels-pa.googleapis.com') {
    return { url: parsed.toString(), useGateway: false };
  }
  return null;
}

async function fetchImageAsBase64(gwUrl: string, useGateway: boolean) {
  const resp = await fetch(gwUrl, useGateway ? { headers: gwHeaders() } : undefined);
  const buf = await resp.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, Math.min(i + CHUNK, bytes.length)))
    );
  }
  return {
    ok: resp.ok,
    status: resp.status,
    contentType: resp.headers.get('content-type') ?? 'image/jpeg',
    base64: btoa(binary),
    bytes,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  if (!LOVABLE_API_KEY || !GMAPS_KEY) {
    return new Response(
      JSON.stringify({ error: 'Google Maps connector not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } },
    );
  }

  try {
    const reqUrl = new URL(req.url);

    // GET: stream image bytes back (for <img src>) — kind = streetview | staticmap
    if (req.method === 'GET') {
      const kind = reqUrl.searchParams.get('kind');
      if (kind !== 'streetview' && kind !== 'staticmap') {
        return new Response(JSON.stringify({ error: 'Invalid kind' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
        });
      }
      const path = kind === 'streetview' ? '/maps/api/streetview' : '/maps/api/staticmap';
      const qs = new URLSearchParams(reqUrl.searchParams);
      qs.delete('kind');
      qs.delete('key');
      const gw = `${GATEWAY_BASE}${path}?${qs.toString()}`;
      const upstream = await fetch(gw, { headers: gwHeaders() });
      const buf = await upstream.arrayBuffer();
      return new Response(buf, {
        status: upstream.status,
        headers: {
          ...CORS,
          'Content-Type': upstream.headers.get('content-type') ?? 'image/jpeg',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // POST: JSON body — { url } (image fetch, base64) OR { geocode: {...} } OR { metadata: {...} }
    const body = await req.json().catch(() => ({}));

    if (body?.geocode) {
      const { address, latlng } = body.geocode as { address?: string; latlng?: string };
      const qs = new URLSearchParams();
      if (address) qs.set('address', address);
      if (latlng) qs.set('latlng', latlng);
      const gw = `${GATEWAY_BASE}/maps/api/geocode/json?${qs.toString()}`;
      const r = await fetch(gw, { headers: gwHeaders() });
      const text = await r.text();
      return new Response(text, {
        status: r.status,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    if (body?.metadata) {
      const { location } = body.metadata as { location: string };
      const qs = new URLSearchParams({ location });
      const gw = `${GATEWAY_BASE}/maps/api/streetview/metadata?${qs.toString()}`;
      const r = await fetch(gw, { headers: gwHeaders() });
      const text = await r.text();
      return new Response(text, {
        status: r.status,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    const { url } = body ?? {};
    if (typeof url !== 'string' || url.length > 2048) {
      return new Response(JSON.stringify({ error: 'Invalid url' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }
    const target = toGatewayUrl(url);
    if (!target) {
      return new Response(JSON.stringify({ error: 'URL not allowed' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }
    const img = await fetchImageAsBase64(target.url, target.useGateway);
    if (!img.ok) {
      return new Response(JSON.stringify({ error: `Upstream ${img.status}` }), {
        status: img.status, headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }
    return new Response(
      JSON.stringify({ image: img.base64, contentType: img.contentType }),
      { headers: { 'Content-Type': 'application/json', ...CORS } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } },
    );
  }
});