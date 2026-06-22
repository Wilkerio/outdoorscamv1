const TARGET_ORIGIN = "https://msouza-d3df08965b08.herokuapp.com";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "x-frame-options",
  "content-security-policy",
]);

function targetUrlFromRequest(requestUrl: URL) {
  const rawPath = requestUrl.searchParams.get("path") || "/login";
  const normalizedPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const targetUrl = new URL(normalizedPath, TARGET_ORIGIN);

  for (const [key, value] of requestUrl.searchParams.entries()) {
    if (key !== "path") targetUrl.searchParams.append(key, value);
  }

  if (targetUrl.origin !== TARGET_ORIGIN) {
    throw new Error("Blocked external target");
  }

  return targetUrl;
}

function proxyUrlFor(rawUrl: string, proxyBase: string) {
  if (!rawUrl || rawUrl.startsWith("#") || rawUrl.startsWith("data:") || rawUrl.startsWith("mailto:")) {
    return rawUrl;
  }

  let targetUrl: URL;
  try {
    targetUrl = rawUrl.startsWith("/") && !rawUrl.startsWith("//")
      ? new URL(rawUrl, TARGET_ORIGIN)
      : new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  if (targetUrl.origin !== TARGET_ORIGIN) return rawUrl;

  return `${proxyBase}?path=${encodeURIComponent(
    `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`,
  )}`;
}

function rewriteBody(text: string, proxyBase: string, contentType: string) {
  let rewritten = text.replace(
    /\b(href|src|action)=(["'])([^"']+)\2/gi,
    (match, attr, quote, value) => {
      const proxied = proxyUrlFor(value, proxyBase);
      return proxied === value ? match : `${attr}=${quote}${proxied}${quote}`;
    },
  );

  rewritten = rewritten.replace(
    /url\((['"]?)(\/[^)'"\s]+)\1\)/gi,
    (_match, quote, value) => `url(${quote}${proxyUrlFor(value, proxyBase)}${quote})`,
  );

  if (contentType.includes("html") || contentType.includes("javascript")) {
    rewritten = rewritten.replace(
      /(["'`])(\/[^"'`\s<>)]*)\1/g,
      (_match, quote, value) => `${quote}${proxyUrlFor(value, proxyBase)}${quote}`,
    );
    rewritten = rewritten.replace(
      /(["'`])(https:\/\/msouza-d3df08965b08\.herokuapp\.com[^"'`]*)\1/g,
      (_match, quote, value) => `${quote}${proxyUrlFor(value, proxyBase)}${quote}`,
    );
  }

  return rewritten;
}

function rewriteSetCookie(cookie: string, proxyPath: string) {
  const safeParts = cookie
    .split(";")
    .map((part) => part.trim())
    .filter((part, index) => {
      if (index === 0) return true;
      const lower = part.toLowerCase();
      return !lower.startsWith("domain=")
        && !lower.startsWith("path=")
        && !lower.startsWith("samesite=")
        && lower !== "secure"
        && lower !== "partitioned";
    });

  return `${safeParts.join("; ")}; Path=${proxyPath}; SameSite=None; Secure; Partitioned`;
}

Deno.serve(async (req) => {
  try {
    const requestUrl = new URL(req.url);
    const proxyBase = `https://${requestUrl.host}/functions/v1/converter-books-proxy`;
    const proxyPath = new URL(proxyBase).pathname;
    const targetUrl = targetUrlFromRequest(requestUrl);

    const requestHeaders = new Headers(req.headers);
    requestHeaders.delete("host");
    requestHeaders.delete("origin");
    requestHeaders.set("referer", TARGET_ORIGIN);

    const targetResponse = await fetch(targetUrl, {
      method: req.method,
      headers: requestHeaders,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : req.body,
      redirect: "manual",
    });

    const responseHeaders = new Headers();
    for (const [key, value] of targetResponse.headers.entries()) {
      const lower = key.toLowerCase();
      if (HOP_BY_HOP_HEADERS.has(lower) || lower === "set-cookie") continue;
      responseHeaders.set(key, value);
    }

    const location = targetResponse.headers.get("location");
    if (location) responseHeaders.set("location", proxyUrlFor(location, proxyBase));

    const cookies = targetResponse.headers.getSetCookie?.() ?? [];
    for (const cookie of cookies) {
      responseHeaders.append("set-cookie", rewriteSetCookie(cookie, proxyPath));
    }

    const contentType = targetResponse.headers.get("content-type") || "";
    const isHtmlPage = contentType.includes("text/html")
      || (!/\.[a-z0-9]+$/i.test(targetUrl.pathname) && contentType.includes("text/plain"));
    if (
      isHtmlPage
      || contentType.includes("text/css")
      || contentType.includes("javascript")
    ) {
      responseHeaders.set("content-type", isHtmlPage ? "text/html; charset=utf-8" : contentType);
      const text = await targetResponse.text();
      return new Response(rewriteBody(text, proxyBase, contentType), {
        status: targetResponse.status,
        headers: responseHeaders,
      });
    }

    return new Response(targetResponse.body, {
      status: targetResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});