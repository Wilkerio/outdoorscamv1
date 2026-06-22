import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ConverterBooks() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <div className="font-semibold">Converter Books</div>
        <Button asChild variant="secondary" size="sm">
          <Link to="/">
            <ArrowLeft className="size-4" /> Voltar para OutdoorScan
          </Link>
        </Button>
      </div>
      <iframe
        src="https://msouza-d3df08965b08.herokuapp.com/login"
        title="Converter Books"
        className="flex-1 w-full border-0"
      />
    </div>
  );
}