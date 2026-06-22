import { Link } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ConverterBooks() {
  const backendUrl = import.meta.env.VITE_SUPABASE_URL;
  const proxyUrl = `${backendUrl}/functions/v1/converter-books-proxy?path=/login`;
  const externalUrl = "https://msouza-d3df08965b08.herokuapp.com/login";

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
        src={proxyUrl}
        title="Converter Books"
        className="flex-1 w-full border-0"
        allow="clipboard-read; clipboard-write; downloads; fullscreen"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}