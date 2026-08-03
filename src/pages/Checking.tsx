import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import "@/components/checking/checking-fonts.css";
import { Download, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CapaSlide } from "@/components/checking/slides/CapaSlide";
import { PotencialImpactoSlide } from "@/components/checking/slides/PotencialImpactoSlide";
import { RegistroFotograficoSlide } from "@/components/checking/slides/RegistroFotograficoSlide";
import { TituloSlide } from "@/components/checking/slides/TituloSlide";
import { ImageDropZone } from "@/components/checking/ImageDropZone";
import { SLIDE_H, SLIDE_W } from "@/components/checking/slideTokens";
import { exportSlidesToPdf } from "@/lib/checking/exportPdf";
import { carregarChecking, salvarChecking } from "@/lib/checking/persistence";
import {
  checkingVazio,
  novaFoto,
  novoLocal,
  novoSlideTitulo,
  type CheckingData,
  type CheckingFoto,
  type CheckingLocal,
} from "@/lib/checking/types";

const PREVIEW_SCALE = 0.42;

export default function Checking() {
  const [searchParams, setSearchParams] = useSearchParams();
  const checkingId = searchParams.get("id");
  const [data, setData] = useState<CheckingData>(checkingVazio());
  const [gerando, setGerando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(!!checkingId);
  const slideRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!checkingId) return;
    setCarregando(true);
    carregarChecking(checkingId)
      .then((loaded) => setData({ ...loaded, slidesTitulo: loaded.slidesTitulo ?? [] }))
      .catch((err: any) => toast.error(`Falha ao carregar checking: ${err.message}`))
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingId]);

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

  const addSlideTitulo = () => setData((d) => ({ ...d, slidesTitulo: [...d.slidesTitulo, novoSlideTitulo()] }));
  const updateSlideTitulo = (id: string, texto: string) =>
    setData((d) => ({ ...d, slidesTitulo: d.slidesTitulo.map((s) => (s.id === id ? { ...s, texto } : s)) }));
  const removeSlideTitulo = (id: string) =>
    setData((d) => ({ ...d, slidesTitulo: d.slidesTitulo.filter((s) => s.id !== id) }));

  // Ordem das páginas do PDF: capa, slides de título (contracapas), locais
  // [potencial de impacto, 1 registro fotográfico por foto], e sempre um "Obrigado!" no final.
  const paginas = useMemo(() => {
    const pgs: { key: string; node: ReactNode }[] = [{ key: "capa", node: <CapaSlide data={data} /> }];
    for (const slide of data.slidesTitulo) {
      pgs.push({ key: `titulo-${slide.id}`, node: <TituloSlide texto={slide.texto} /> });
    }
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
    pgs.push({ key: "obrigado", node: <TituloSlide texto="OBRIGADO!" /> });
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

  const salvar = async () => {
    const nome = window.prompt("Nome desse checking:", data.cliente || "Checking sem nome");
    if (nome === null) return;
    setSalvando(true);
    try {
      const id = await salvarChecking(checkingId, nome, data);
      if (!checkingId) setSearchParams({ id }, { replace: true });
      toast.success("Checking salvo. Você pode voltar e continuar editando depois em \"Meus Checkings\".");
    } catch (err: any) {
      toast.error(`Falha ao salvar: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Carregando checking…
      </div>
    );
  }

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

          <div className="space-y-1.5">
            <Label className="text-xs">Esse material tem agência?</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={data.temAgencia ? "default" : "secondary"}
                className="flex-1"
                onClick={() => updateField({ temAgencia: true })}
              >
                Sim
              </Button>
              <Button
                type="button"
                size="sm"
                variant={!data.temAgencia ? "default" : "secondary"}
                className="flex-1"
                onClick={() => updateField({ temAgencia: false, agencia: "" })}
              >
                Não
              </Button>
            </div>
            {data.temAgencia && (
              <FieldInput label="Nome da agência" value={data.agencia} onChange={(v) => updateField({ agencia: v })} />
            )}
          </div>

          <FieldInput label="Campanha" value={data.campanha} onChange={(v) => updateField({ campanha: v })} />
          <FieldInput label="Praça" value={data.praca} onChange={(v) => updateField({ praca: v })} />
          <FieldInput label="Período" value={data.periodo} onChange={(v) => updateField({ periodo: v })} />
          <FieldInput label="Ativo(s)" value={data.ativo} onChange={(v) => updateField({ ativo: v })} placeholder="Painel de LED" />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Slides de título</div>
            <Button size="sm" variant="secondary" onClick={addSlideTitulo}>
              <Plus className="size-3.5" /> Slide
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Página preta de destaque (tipo "PAINEL LED") — entram entre a capa e os locais, na ordem que adicionar. Um
            slide "Obrigado!" já é incluído automático no final de todo PDF.
          </p>
          {data.slidesTitulo.map((slide) => (
            <div key={slide.id} className="flex items-center gap-2">
              <Input
                placeholder="Texto do slide (ex.: Painel LED)"
                value={slide.texto}
                onChange={(e) => updateSlideTitulo(slide.id, e.target.value)}
              />
              <button
                onClick={() => removeSlideTitulo(slide.id)}
                className="text-muted-foreground hover:text-destructive shrink-0"
                title="Remover slide"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
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
                {local.fotos.map((foto, fotoIdx) => (
                  <div key={foto.id} className="space-y-1.5 border-t border-border/50 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">Foto {fotoIdx + 1}</span>
                      <button
                        onClick={() => removeFoto(local.id, foto.id)}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"
                        title="Remover esta foto"
                      >
                        <Trash2 className="size-3" /> Remover foto
                      </button>
                    </div>
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
                  </div>
                ))}
                {!local.fotos.length && <p className="text-[11px] text-muted-foreground">Nenhuma foto adicionada ainda.</p>}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button className="flex-1" variant="secondary" onClick={salvar} disabled={salvando}>
            <Save className="size-4" />
            {salvando ? "Salvando…" : checkingId ? "Salvar alterações" : "Salvar"}
          </Button>
          <Button className="flex-1" onClick={gerarPdf} disabled={gerando}>
            <Download className="size-4" />
            {gerando ? "Gerando…" : "Gerar PDF"}
          </Button>
        </div>
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
