import { Pause, RotateCcw, Trash2, Download, Save, Play } from "lucide-react";
import { UploadDropzone } from "@/components/outdoorscan/UploadDropzone";
import { PointCard } from "@/components/outdoorscan/PointCard";
import { useSession } from "@/context/SessionContext";
import { Button } from "@/components/ui/button";

export default function Processamento() {
  const { points, phase, start, pause, resume, reset, currentIndex, exportarExcel, salvarProgresso, ultimoSalvamento } = useSession();
  const total = points.length;
  const ativos = points.filter((p) => !p.excluido);
  const totalAtivos = ativos.length;
  const processed = ativos.filter((p) => p.status !== "AGUARDANDO" && p.status !== "PROCESSANDO").length;
  const hasProcessed = ativos.some((p) => p.status !== "AGUARDANDO" && p.status !== "PROCESSANDO");
  const progressPct = totalAtivos ? Math.round((processed / totalAtivos) * 100) : 0;
  const excluidosCount = total - totalAtivos;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Processamento</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Faça upload da planilha e verifique a cobertura Street View de cada ponto.
          </p>
        </div>
        <div className="flex gap-2">
          {phase === "running" ? (
            <Button onClick={pause} variant="secondary">
              <Pause className="size-4" /> Pausar
            </Button>
          ) : phase === "paused" && (
            <Button onClick={resume}>
              <Play className="size-4" /> Retomar
            </Button>
          )}
          <Button
            onClick={salvarProgresso}
            disabled={!total}
            variant="secondary"
            title={ultimoSalvamento ? `Último salvamento: ${new Date(ultimoSalvamento).toLocaleString()}` : "Salvar progresso no navegador"}
          >
            <Save className="size-4" /> Salvar Progresso
          </Button>
          <Button
            onClick={exportarExcel}
            disabled={!totalAtivos}
            className="bg-success hover:bg-success/90 text-white"
          >
            <Download className="size-4" /> 💾 Baixar Planilha
          </Button>
          <Button variant="ghost" onClick={reset} disabled={!total}>
            <Trash2 className="size-4" /> Limpar
          </Button>
        </div>
      </header>

      <UploadDropzone />

      {ultimoSalvamento && total > 0 && (
        <div className="text-xs text-muted-foreground">
          💾 Progresso salvo · {new Date(ultimoSalvamento).toLocaleString()}
        </div>
      )}

      {total > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>
              {phase === "running" && <RotateCcw className="size-3 inline animate-spin mr-1" />}
              {processed}/{totalAtivos} processados{excluidosCount > 0 ? ` · ${excluidosCount} excluído${excluidosCount > 1 ? 's' : ''}` : ''}
              {phase === "running" && total > 0 && ` · atual #${currentIndex + 1}`}
            </span>
            <span className="tabular-nums font-medium">{progressPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {total > 0 && (
        <>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Pontos ({totalAtivos} ativos{excluidosCount > 0 ? `, ${excluidosCount} excluído${excluidosCount > 1 ? 's' : ''}` : ''})
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {points.map((p) => (
                <PointCard key={p.id} point={p} />
              ))}
            </div>
          </div>
          {total > 0 && (
            <div className="flex justify-center pt-2">
              <Button
                onClick={exportarExcel}
                className="bg-success hover:bg-success/90 text-white"
                size="lg"
              >
                <Download className="size-4" /> 💾 Baixar Planilha
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
