import { Link } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useRef, useState } from "react";

export default function ConverterBooks() {
  const backendUrl = import.meta.env.VITE_SUPABASE_URL;
  const proxyBase = `${backendUrl}/functions/v1/converter-books-proxy`;
  const externalUrl = "https://msouza-d3df08965b08.herokuapp.com/login";
  const [html, setHtml] = useState("");
  const cookieJarRef = useRef<Record<string, string>>({});

  const updateCookies = useCallback((encodedCookies: string | null) => {
    if (!encodedCookies) return;

    try {
      const cookies = JSON.parse(decodeURIComponent(encodedCookies)) as string[];
      for (const cookie of cookies) {
        const [pair] = cookie.split(";");
        const [name, ...value] = pair.split("=");
        if (name) cookieJarRef.current[name.trim()] = value.join("=");
      }
    } catch {
      // Keep the iframe usable even if a cookie header is not readable.
    }
  }, []);

  const loadPath = useCallback(async (path: string) => {
    const cookieHeader = Object.entries(cookieJarRef.current)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");

    const response = await fetch(`${proxyBase}?path=${encodeURIComponent(path)}`, {
      redirect: "manual",
      headers: cookieHeader ? { "x-proxy-cookie": cookieHeader } : undefined,
    });

    updateCookies(response.headers.get("x-proxy-cookies"));

    const location = response.headers.get("location");
    if (location && response.status >= 300 && response.status < 400) {
      const nextUrl = new URL(location);
      await loadPath(nextUrl.searchParams.get("path") || "/login");
      return;
    }

    setHtml(await response.text());
  }, [proxyBase, updateCookies]);

  useEffect(() => {
    loadPath("/login");
  }, [loadPath]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== "converter-books:navigate") return;
      const target = String(event.data.url || "/login");
      const nextUrl = new URL(target, proxyBase);
      loadPath(nextUrl.searchParams.get("path") || target);
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [loadPath, proxyBase]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <div className="font-semibold">Converter Books</div>
        <div className="flex gap-2">
          <Button asChild variant="default" size="sm">
            <a href={externalUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" /> Abrir em nova aba
            </a>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link to="/">
              <ArrowLeft className="size-4" /> Voltar para OutdoorScan
            </Link>
          </Button>
        </div>
      </div>
      <iframe
        srcDoc={html}
        title="Converter Books"
        className="flex-1 w-full border-0"
        allow="clipboard-read; clipboard-write; downloads; fullscreen"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}