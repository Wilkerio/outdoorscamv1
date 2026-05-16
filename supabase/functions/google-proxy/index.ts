const ALLOWED_HOSTS = new Set([
  'maps.googleapis.com',
  'maps.gstatic.com',
  'streetviewpixels-pa.googleapis.com',
]);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const { url } = await req.json();

    if (typeof url !== 'string' || url.length > 2048) {
      return new Response(JSON.stringify({ error: 'Invalid url' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return new Response(JSON.stringify({ error: 'Malformed url' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) {
      return new Response(JSON.stringify({ error: 'URL not allowed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    const response = await fetch(parsed.toString());
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const CHUNK = 8192;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(
        null,
        Array.from(bytes.subarray(i, Math.min(i + CHUNK, bytes.length)))
      );
    }
    const base64 = btoa(binary);
    return new Response(
      JSON.stringify({ image: base64, contentType: response.headers.get('content-type') }),
      { headers: { 'Content-Type': 'application/json', ...CORS } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } }
    );
  }
});