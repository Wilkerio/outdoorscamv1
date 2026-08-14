import { Link } from "react-router-dom";
import { FileImage, Bus } from "lucide-react";

export default function NovoChecking() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Criar Checking</h1>
        <p className="text-sm text-muted-foreground mt-1">Escolhe o modelo pra começar.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          to="/checking?tipo=outdoor"
          className="rounded-xl border border-border bg-card p-6 flex flex-col items-center gap-3 text-center hover:border-primary/50 hover:bg-accent transition-colors"
        >
          <div className="size-12 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
            <FileImage className="size-6" />
          </div>
          <div>
            <div className="font-semibold">Checking</div>
            <p className="text-xs text-muted-foreground mt-1">Outdoor, painel de LED, front light etc.</p>
          </div>
        </Link>

        <Link
          to="/checking?tipo=onibus"
          className="rounded-xl border border-border bg-card p-6 flex flex-col items-center gap-3 text-center hover:border-primary/50 hover:bg-accent transition-colors"
        >
          <div className="size-12 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
            <Bus className="size-6" />
          </div>
          <div>
            <div className="font-semibold">Checking Ônibus</div>
            <p className="text-xs text-muted-foreground mt-1">Mesmo modelo, com campo de linhas do ônibus.</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
