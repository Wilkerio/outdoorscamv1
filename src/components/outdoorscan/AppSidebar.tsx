  import { Link, useLocation } from "react-router-dom";
  import { Radar, ListChecks, BookOpen, FileImage, FolderOpen, Menu, X } from "lucide-react";
import { useSession } from "@/context/SessionContext";
 import { useState } from "react";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function AppSidebar() {
   const location = useLocation();
   const pathname = location.pathname;
   const { stats } = useSession();
   const [open, setOpen] = useState(false);

  const pct = (n: number) => (stats.total ? Math.round((n / stats.total) * 100) : 0);

  const items = [
    { to: "/", label: "Processamento", icon: ListChecks },
    { to: "/converter-books", label: "Converter Books", icon: BookOpen },
    { to: "/checking/novo", label: "Criar Checking", icon: FileImage },
    { to: "/meus-checkings", label: "Meus Checkings", icon: FolderOpen },
  ];

  return (
    <>
      {/* Barra superior — só aparece no mobile/tablet (abaixo de lg) */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-sidebar-bg px-4 py-3">
        <button
          onClick={() => setOpen(true)}
          className="p-1 text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Abrir menu"
        >
          <Menu className="size-5" />
        </button>
        <div className="size-7 rounded-md bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <Radar className="size-4" />
        </div>
        <span className="font-semibold text-sm truncate">OutdoorScan</span>
      </div>

      {/* Fundo escuro atrás do menu quando aberto no mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-border bg-sidebar-bg flex flex-col transition-transform duration-200 ease-out lg:static lg:z-auto lg:w-64 lg:max-w-none lg:shrink-0 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 py-5 flex items-center gap-2 border-b border-border">
          <div className="size-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Radar className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold leading-none truncate">OutdoorScan</div>
            <div className="text-xs text-muted-foreground mt-1 truncate">Cobertura Street View</div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="ml-auto lg:hidden p-1 text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Fechar menu"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="p-3 flex flex-col gap-1">
          {items.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>

         <div className="mt-auto p-4 border-t border-border space-y-4">
           <div className="space-y-3">
             <div className="text-xs uppercase tracking-wider text-muted-foreground">Resumo da sessão</div>
             <StatRow label="Sucesso" value={pct(stats.sucesso)} count={stats.sucesso} color="bg-success" />
             <StatRow label="Erro" value={pct(stats.erro)} count={stats.erro} color="bg-destructive" />
             <StatRow label="Sem Cobertura" value={pct(stats.semCobertura)} count={stats.semCobertura} color="bg-warning" />
             <div className="text-xs text-muted-foreground pt-1">Total: {stats.total}</div>
           </div>

          </div>
       </aside>
    </>
  );
}

function StatRow({ label, value, count, color }: { label: string; value: number; count: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {value}% <span className="text-muted-foreground">({count})</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
