import { useEffect, useRef, useState } from "react";
import { Pause, RotateCcw, Trash2, Download, Save, Play, Eraser } from "lucide-react";
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
  const progressPct = totalAtivos  Math.round((processed / totalAtivos) * 100) : 0;
  const excluidosCount = total - totalAtivos;

  const INITIAL_BATCH = 6;
  const AHEAD = 3;
  const readyIdsRef = useRef<Set<string>>(new Set());
  const [readyCount, setReadyCount] = useState(0);

  useEffect(() => {
    readyIdsRef.current = new Set();
    setReadyCount(0);
  }, [total]);

  const handlePointReady = (id: string) => {
    if (readyIdsRef.current.has(id)) return;
    readyIdsRef.current.add(id);
    setReadyCount(readyIdsRef.current.size);
  };

  const visibleCount = Math.min(total, Math.max(INITIAL_BATCH, readyCount + AHEAD));
  const visiblePoints = points.slice(0, visibleCount);

  const limparTudo = async () => {
    if (!confirm("Limpar TUDO Isso vai apagar pontos, progresso e todo o cache do navegador (Street View, imagens, etc).")) return;
    try {
      // Reset session state
      reset();
      // localStorage / sessionStorage
      localStorage.clear();
      sessionStorage.clear();
      // Cache API
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      // IndexedDB
      if (indexedDB && "databases" in indexedDB) {
        const dbs = await (indexedDB as unknown as { databases: () => Promise<{ name: string }[]> }).databases();
        await Promise.all(
          (dbs || []).map((db: { name: string }) => db.name && new Promise((res) => {
            const req = indexedDB.deleteDatabase(db.name!);
            req.onsuccess = req.onerror = req.onblocked = () => res(null);
          }))
        );
      }
    } finally {
      window.location.reload();
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Processamento</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Faça upload da planilha e verifique a cobertura Street View de cada ponto.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {phase === "running"  (
            <Button onClick={pause} variant="secondary">
              <Pause className="size-4" /> Pausar
            </Button>
          ) : phase === "paused"  (
            <Button onClick={resume}>
              <Play className="size-4" /> Retomar
            </Button>
          ) : (
            <Button onClick={start} disabled={!total}>
              <Play className="size-4" /> Iniciar Processamento
            </Button>
          )}
          <Button
            onClick={salvarProgresso}
            disabled={!total}
            variant="secondary"
            title={ultimoSalvamento  `Último salvamento: ${new Date(ultimoSalvamento).toLocaleString()}` : "Salvar progresso no navegador"}
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
          <Button variant="destructive" onClick={limparTudo}>
            <Eraser className="size-4" /> Limpar Página
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
              {processed}/{totalAtivos} processados{excluidosCount > 0  ` · ${excluidosCount} excluído${excluidosCount > 1  's' : ''}` : ''}
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
            Pontos ({totalAtivos} ativos{excluidosCount > 0  `, ${excluidosCount} excluído${excluidosCount > 1  's' : ''}` : ''})
            </div>
            {total > 0 && (
              <div className="text-[11px] text-muted-foreground mb-2">
                Exibindo {Math.min(readyCount, visibleCount)} de {total} carregados
                {visibleCount < total && ` · aguardando próximos…`}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {visiblePoints.map((p) => (
                <PointCard key={p.id} point={p} onReady={handlePointReady} />
              ))}
            </div>
            {visibleCount < total && (
              <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted-foreground">
                <RotateCcw className="size-3 animate-spin" />
                Carregando mais pontos ({visibleCount}/{total})…
              </div>
            )}
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
