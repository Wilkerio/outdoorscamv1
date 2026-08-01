import { useMemo, useRef, useState, type ReactNode } from "react";
import "@/components/checking/checking-fonts.css";
import { Download, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CapaSlide } from "@/components/checking/slides/CapaSlide";
import { PotencialImpactoSlide } from "@/components/checking/slides/PotencialImpactoSlide";
import { RegistroFotograficoSlide } from "@/components/checking/slides/RegistroFotograficoSlide";
import { ImageDropZone } from "@/components/checking/ImageDropZone";
import { SLIDE_H, SLIDE_W } from "@/components/checking/slideTokens";
import { exportSlidesToPdf } from "@/lib/checking/exportPdf";
import { checkingVazio, novaFoto, novoLocal, type CheckingData, type CheckingFoto, type CheckingLocal } from "@/lib/checking/types";

const PREVIEW_SCALE = 0.42;

export default function Checking() {
  const [data, setData] = useState<CheckingData>(checkingVazio());
  const [gerando, setGerando] = useState(false);
  const slideRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const updateField = (patch: Partial<CheckingData>) => setData((d) => ({ ...d, ...patch }));

  const updateLocal = (id: string, patch: Partial<CheckingLocal>) =>
    setData((d) => ({ ...d, locais: d.locais.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));

  const addLocal = () => setData((d) => ({ ...d, locais: [...d.locais, novoLocal()] }));
  const removeLocal = (id: string) => setData((d) => ({ ...d, locais: d.locais.filter((l) => l.id !== id) }));

  const addFoto = (localId: string) =>
    setData((d) => ({
      ...d,
      locais: d.locais.map((l) => (l.id === localId ? { ...l, fotos: [...l.fotos, novaFoto()] } : l)),
    }));

  const updateFoto = (localId: string, fotoId: string, patch: Partial<CheckingFoto>) =>
    setData((d) => ({
      ...d,
      locais: d.locais.map((l) =>
        l.id === localId ? { ...l, fotos: l.fotos.map((f) => (f.id === fotoId ? { ...f, ...patch } : f)) } : l,
      ),
    }));

  const removeFoto = (localId: string, fotoId: string) =>
    setData((d) => ({
      ...d,
      locais: d.locais.map((l) => (l.id === localId ? { ...l, fotos: l.fotos.filter((f) => f.id !== fotoId) } : l)),
    }));

  // Ordem das páginas do PDF: capa, depois por local [potencial de impacto, 1 registro fotográfico por foto].
  const paginas = useMemo(() => {
    const pgs: { key: string; node: ReactNode }[] = [{ key: "capa", node: <CapaSlide data={data} /> }];
    for (const local of data.locais) {
      pgs.push({ key: `${local.id}-potencial`, node: <PotencialImpactoSlide local={local} /> });
      local.fotos.forEach((foto, idx) => {
        pgs.push({
          key: `${local.id}-foto-${foto.id}`,
          node: (
            <RegistroFotograficoSlide local={local} foto={foto} sufixo={local.fotos.length > 1 ? idx + 1 : undefined} />
          ),
        });
      });
    }
    return pgs;
  }, [data]);

  const gerarPdf = async () => {
    const elements = paginas.map((p) => slideRefs.current.get(p.key)).filter((el): el is HTMLDivElement => !!el);
    if (!elements.length) return;
    setGerando(true);
    try {
      await exportSlidesToPdf(elements, `Checking_${data.cliente || "Fotografico"}`);
      toast.success("PDF gerado.");
    } catch (err: any) {
      toast.error(`Falha ao gerar PDF: ${err.message}`);
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full">
      <div className="w-full lg:w-[420px] lg:shrink-0 border-r border-border p-5 space-y-6 overflow-y-auto">
        <div>
          <h1 className="text-xl font-semibold">Criar Checking</h1>
          <p className="text-sm text-muted-foreground mt-1">Preenche os dados — a prévia atualiza ao lado.</p>
        </div>

        <div className="space-y-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Capa</div>
          <ImageDropZone
            label="Foto de capa"
            value={data.capaImageDataUrl}
            onChange={(v) => updateField({ capaImageDataUrl: v })}
            aspect="aspect-video"
          />
          <FieldInput label="Cliente" value={data.cliente} onChange={(v) => updateField({ cliente: v })} />
          <FieldInput label="Campanha" value={data.campanha} onChange={(v) => updateField({ campanha: v })} />
          <FieldInput label="Praça" value={data.praca} onChange={(v) => updateField({ praca: v })} />
          <FieldInput label="Período" value={data.periodo} onChange={(v) => updateField({ periodo: v })} />
          <FieldInput label="Ativo(s)" value={data.ativo} onChange={(v) => updateField({ ativo: v })} placeholder="Painel de LED" />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Locais</div>
            <Button size="sm" variant="secondary" onClick={addLocal}>
              <Plus className="size-3.5" /> Local
            </Button>
          </div>

          {data.locais.map((local, i) => (
            <div key={local.id} className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Local {i + 1}</span>
                {data.locais.length > 1 && (
                  <button onClick={() => removeLocal(local.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>

              <FieldTextarea
                label="Local de veiculação"
                value={local.localVeiculacao}
                onChange={(v) => updateLocal(local.id, { localVeiculacao: v })}
              />
              <FieldInput
                label="Formato"
                value={local.formato}
                onChange={(v) => updateLocal(local.id, { formato: v })}
                placeholder="Painel de LED"
              />
              <FieldInput
                label="Fluxo de passantes/dia"
                value={local.fluxoPassantes}
                onChange={(v) => updateLocal(local.id, { fluxoPassantes: v })}
                placeholder="18.387"
              />

              <div>
                <Label className="text-xs mb-1.5 block">Print do mapa (Economapas)</Label>
                <ImageDropZone
                  label="Solte o print aqui"
                  value={local.mapaImageDataUrl}
                  onChange={(v) => updateLocal(local.id, { mapaImageDataUrl: v })}
                  aspect="aspect-[4/3]"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Fotos do outdoor</Label>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => addFoto(local.id)}>
                    <Plus className="size-3" /> Foto
                  </Button>
                </div>
                {local.fotos.map((foto) => (
                  <div key={foto.id} className="space-y-1.5 border-t border-border/50 pt-2">
                    <ImageDropZone
                      label="Solte a foto do outdoor"
                      value={foto.imageDataUrl}
                      onChange={(v) => updateFoto(local.id, foto.id, { imageDataUrl: v })}
                      aspect="aspect-video"
                    />
                    <Input
                      placeholder="Link do vídeo (opcional)"
                      className="h-8 text-xs"
                      value={foto.videoUrl ?? ""}
                      onChange={(e) => updateFoto(local.id, foto.id, { videoUrl: e.target.value })}
                    />
                    <button
                      onClick={() => removeFoto(local.id, foto.id)}
                      className="text-[11px] text-muted-foreground hover:text-destructive"
                    >
                      Remover foto
                    </button>
                  </div>
                ))}
                {!local.fotos.length && <p className="text-[11px] text-muted-foreground">Nenhuma foto adicionada ainda.</p>}
              </div>
            </div>
          ))}
        </div>

        <Button className="w-full" size="lg" onClick={gerarPdf} disabled={gerando}>
          <Download className="size-4" />
          {gerando ? "Gerando PDF…" : "Gerar PDF"}
        </Button>
      </div>

      <div className="flex-1 min-w-0 overflow-y-auto p-6 bg-muted/30">
        <div className="flex flex-col items-center gap-6">
          {paginas.map((p) => (
            <div
              key={p.key}
              style={{ width: SLIDE_W * PREVIEW_SCALE, height: SLIDE_H * PREVIEW_SCALE }}
              className="shadow-md rounded-md overflow-hidden bg-white"
            >
              <div
                ref={(el) => {
                  if (el) slideRefs.current.set(p.key, el);
                  else slideRefs.current.delete(p.key);
                }}
                style={{ width: SLIDE_W, height: SLIDE_H, transform: `scale(${PREVIEW_SCALE})`, transformOrigin: "top left" }}
              >
                {p.node}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function FieldTextarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} className="text-sm" />
    </div>
  );
}
