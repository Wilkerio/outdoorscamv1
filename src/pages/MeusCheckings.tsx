import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FolderOpen, Link2, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { excluirChecking, listarCheckings, type CheckingSalvo } from "@/lib/checking/persistence";

export default function MeusCheckings() {
  const [itens, setItens] = useState<CheckingSalvo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  const carregar = () => {
    setCarregando(true);
    listarCheckings()
      .then(setItens)
      .catch((err: any) => toast.error(`Falha ao listar checkings: ${err.message}`))
      .finally(() => setCarregando(false));
  };

  useEffect(() => {
    carregar();
  }, []);

  const excluir = async (id: string) => {
    if (!confirm("Excluir esse checking? Não dá pra desfazer.")) return;
    setExcluindoId(id);
    try {
      await excluirChecking(id);
      setItens((arr) => arr.filter((i) => i.id !== id));
      toast.success("Checking excluído.");
    } catch (err: any) {
      toast.error(`Falha ao excluir: ${err.message}`);
    } finally {
      setExcluindoId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Meus Checkings</h1>
          <p className="text-sm text-muted-foreground mt-1">Checkings salvos — abre pra continuar editando.</p>
        </div>
        <Button asChild>
          <Link to="/checking/novo">
            <Plus className="size-4" /> Novo Checking
          </Link>
        </Button>
      </header>

      {carregando && (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground gap-2">
          <Loader2 className="size-4 animate-spin" /> Carregando…
        </div>
      )}

      {!carregando && !itens.length && (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-2">
          <FolderOpen className="size-8" />
          <p className="text-sm">Nenhum checking salvo ainda.</p>
        </div>
      )}

      {!carregando && itens.length > 0 && (
        <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
          {itens.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="font-medium truncate">{item.nome}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Atualizado em {new Date(item.updated_at).toLocaleString("pt-BR")}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {item.pdf_url && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(item.pdf_url!).catch(() => {});
                      toast.success("Link copiado.");
                    }}
                    title="Copiar link do PDF"
                  >
                    <Link2 className="size-3.5" />
                  </Button>
                )}
                <Button size="sm" variant="secondary" asChild>
                  <Link to={`/checking?id=${item.id}`}>Abrir</Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={excluindoId === item.id}
                  onClick={() => excluir(item.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
