 import { Link, useRouterState } from "@tanstack/react-router";
 import { Radar, ListChecks, History, Settings, Key } from "lucide-react";
import { useSession } from "@/context/SessionContext";
 import { useState } from "react";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
   const { stats, geminiKey, setGeminiKey } = useSession();
   const [tempKey, setTempKey] = useState(geminiKey);

  const pct = (n: number) => (stats.total ? Math.round((n / stats.total) * 100) : 0);

  const items = [
    { to: "/", label: "Processamento", icon: ListChecks },
    { to: "/historico", label: "Histórico", icon: History },
  ];

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-sidebar-bg flex flex-col">
      <div className="px-5 py-5 flex items-center gap-2 border-b border-border">
        <div className="size-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
          <Radar className="size-5" />
        </div>
        <div>
          <div className="font-semibold leading-none">OutdoorScan</div>
          <div className="text-xs text-muted-foreground mt-1">Cobertura Street View</div>
        </div>
      </div>

      <nav className="p-3 flex flex-col gap-1">
        {items.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
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

         <Popover>
           <PopoverTrigger asChild>
             <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs text-muted-foreground hover:text-foreground">
               <Settings className="size-3.5" /> Configurações IA
             </Button>
           </PopoverTrigger>
           <PopoverContent className="w-64 p-3" side="right" align="end">
             <div className="space-y-3">
               <div className="flex items-center gap-2 font-medium text-xs uppercase tracking-wider">
                 <Key className="size-3.5" /> Gemini API Key
               </div>
               <div className="space-y-1.5">
                 <Input
                   type="password"
                   placeholder="Insira sua chave..."
                   value={tempKey}
                   onChange={(e) => setTempKey(e.target.value)}
                   className="h-8 text-xs"
                 />
                 <Button 
                   size="sm" 
                   className="w-full h-8 text-xs" 
                   onClick={() => setGeminiKey(tempKey)}
                 >
                   Salvar Chave
                 </Button>
               </div>
               <p className="text-[10px] text-muted-foreground leading-relaxed">
                 Necessário para verificação automática de outdoors nas fotos.
               </p>
             </div>
           </PopoverContent>
         </Popover>
       </div>
      </div>
    </aside>
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