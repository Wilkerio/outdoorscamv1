import { createFileRoute } from "@tanstack/react-router";
import { History } from "lucide-react";

export const Route = createFileRoute("/historico")({
  component: Historico,
  head: () => ({
    meta: [{ title: "Histórico — OutdoorScan" }],
  }),
});

function Historico() {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">Histórico</h1>
      <p className="text-sm text-muted-foreground mb-8">Sessões anteriores processadas.</p>

      <div className="rounded-xl border border-dashed border-border bg-card p-12 flex flex-col items-center text-center">
        <div className="size-12 rounded-full bg-muted text-muted-foreground flex items-center justify-center mb-4">
          <History className="size-6" />
        </div>
        <div className="font-medium">Nenhuma sessão salva ainda</div>
        <div className="text-sm text-muted-foreground mt-1 max-w-sm">
          O histórico ficará disponível assim que o backend for conectado (próxima etapa).
        </div>
      </div>
    </div>
  );
}