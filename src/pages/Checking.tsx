import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import "@/components/checking/checking-fonts.css";
import { ChevronDown, ChevronRight, ChevronUp, Download, Link2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CapaSlide } from "@/components/checking/slides/CapaSlide";
import { PotencialImpactoSlide } from "@/components/checking/slides/PotencialImpactoSlide";
import { RegistroFotograficoSlide } from "@/components/checking/slides/RegistroFotograficoSlide";
import { RegistroBusdoorSlide } from "@/components/checking/slides/RegistroBusdoorSlide";
import { GaleriaOnibusSlide } from "@/components/checking/slides/GaleriaOnibusSlide";
import { TituloSlide } from "@/components/checking/slides/TituloSlide";
import { ImageDropZone } from "@/components/checking/ImageDropZone";
import { SLIDE_H, SLIDE_W } from "@/components/checking/slideTokens";
import { buildPdfBlob, exportSlidesToPdf } from "@/lib/checking/exportPdf";
import { carregarChecking, gerarLinkPdf, salvarChecking } from "@/lib/checking/persistence";
import {
  checkingVazio,
  normalizarChecking,
  novaFoto,
  novoLocal,
  novoSlideTitulo,
  type CheckingData,
  type CheckingFoto,
  type CheckingLocal,
  type CheckingTituloSlide,
} from "@/lib/checking/types";

const PREVIEW_SCALE = 0.2;
const DRAFT_KEY = "checking:draft:v1";

function moveItem<T>(arr: T[], index: number, dir: -1 | 1): T[] {
  const target = index + dir;
  if (index < 0 || target < 0 || target >= arr.length) return arr;
  const next = [...arr];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export default function Checking() {
  const [searchParams, setSearchParams] = useSearchParams();
  const checkingId = searchParams.get("id");
  const [data, setData] = useState<CheckingData>(() => {
    const tipoParam = searchParams.get("tipo");
    const tipo = tipoParam === "onibus" ? "onibus" : "outdoor";
    if (searchParams.get("id")) return checkingVazio(tipo);
    // ?tipo= na URL = veio do seletor "Criar Checking" → é um checking NOVO de propósito,
    // não deve misturar com rascunho antigo salvo (senão herda dados de outra sessão).
    if (!tipoParam) {
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (raw) return normalizarChecking({ ...checkingVazio(tipo), ...JSON.parse(raw) });
      } catch {}
    }
    return checkingVazio(tipo);
  });
  const [gerando, setGerando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [gerandoLink, setGerandoLink] = useState(false);
  const [carregando, setCarregando] = useState(!!checkingId);
  // Todo Local/Slide já nasce recolhido — inclusive o(s) que vêm padrão ao abrir a página.
  const [colapsados, setColapsados] = useState<Set<string>>(() => new Set(data.ordem));
  const slideRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const toggleColapso = (key: string) =>
    setColapsados((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  useEffect(() => {
    if (!checkingId) return;
    setCarregando(true);
    carregarChecking(checkingId)
      .then((loaded) => {
        const normalizado = normalizarChecking(loaded);
        setData(normalizado);
        setColapsados(new Set(normalizado.ordem));
      })
      .catch((err: any) => toast.error(`Falha ao carregar checking: ${err.message}`))
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingId]);

  // Rascunho local — só pra checking novo (ainda não salvo no banco), pra não perder
  // o que foi digitado se fechar a aba sem clicar em "Salvar".
  useEffect(() => {
    if (checkingId) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    } catch {}
  }, [data, checkingId]);

  const updateField = (patch: Partial<CheckingData>) => setData((d) => ({ ...d, ...patch }));

  const updateLocal = (id: string, patch: Partial<CheckingLocal>) =>
    setData((d) => ({ ...d, locais: d.locais.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));

  const addLocal = () => {
    const novo = novoLocal();
    setData((d) => ({ ...d, locais: [...d.locais, novo], ordem: [...d.ordem, `local:${novo.id}`] }));
    setColapsados((s) => new Set(s).add(`local:${novo.id}`));
  };
  const removeLocal = (id: string) =>
    setData((d) => ({
      ...d,
      locais: d.locais.filter((l) => l.id !== id),
      ordem: d.ordem.filter((t) => t !== `local:${id}`),
    }));

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

  const moveFoto = (localId: string, fotoId: string, dir: -1 | 1) =>
    setData((d) => ({
      ...d,
      locais: d.locais.map((l) =>
        l.id === localId ? { ...l, fotos: moveItem(l.fotos, l.fotos.findIndex((f) => f.id === fotoId), dir) } : l,
      ),
    }));

  const addSlideTitulo = () => {
    const novo = novoSlideTitulo();
    setData((d) => ({ ...d, slidesTitulo: [...d.slidesTitulo, novo], ordem: [...d.ordem, `titulo:${novo.id}`] }));
    // Novo slide já nasce recolhido — evita poluir a lista quando tem muitos.
    setColapsados((s) => new Set(s).add(`titulo:${novo.id}`));
  };
  const updateSlideTitulo = (id: string, patch: Partial<CheckingTituloSlide>) =>
    setData((d) => ({ ...d, slidesTitulo: d.slidesTitulo.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const removeSlideTitulo = (id: string) =>
    setData((d) => ({
      ...d,
      slidesTitulo: d.slidesTitulo.filter((s) => s.id !== id),
      ordem: d.ordem.filter((t) => t !== `titulo:${id}`),
    }));

  // Move um item (slide de título OU local) pra qualquer posição — mesma lista, cruza categorias.
  const moveOrdem = (token: string, dir: -1 | 1) =>
    setData((d) => ({ ...d, ordem: moveItem(d.ordem, d.ordem.indexOf(token as any), dir) }));

  // Ordem das páginas do PDF: capa, depois segue data.ordem (slides de título e locais
  // intercalados como o usuário organizou — cada local expande em [potencial, registros]),
  // e sempre um "Obrigado!" no final.
  const paginas = useMemo(() => {
    const pgs: { key: string; label: string; node: ReactNode }[] = [
      { key: "capa", label: "Capa", node: <CapaSlide data={data} /> },
    ];
    data.ordem.forEach((token) => {
      if (token.startsWith("titulo:")) {
        const slide = data.slidesTitulo.find((s) => `titulo:${s.id}` === token);
        if (!slide) return;
        pgs.push({
          key: `titulo-${slide.id}`,
          label: slide.nome || slide.texto || "Slide de título",
          node: <TituloSlide texto={slide.texto} />,
        });
        return;
      }
      const local = data.locais.find((l) => `local:${l.id}` === token);
      if (!local) return;
      const nomeLocal = local.nome || local.localVeiculacao || "Local";

      if (data.tipo === "onibus") {
        pgs.push({
          key: `${local.id}-registro-onibus`,
          label: `Registro Fotográfico — ${nomeLocal}`,
          node: <RegistroBusdoorSlide local={local} foto={local.fotos[0]} />,
        });
        for (let idx = 0; idx < local.fotos.length; idx += 2) {
          const par = local.fotos.slice(idx, idx + 2);
          pgs.push({
            key: `${local.id}-galeria-${idx}`,
            label: `Galeria Ônibus — ${nomeLocal} (${idx + 1}${par.length > 1 ? `-${idx + 2}` : ""})`,
            node: <GaleriaOnibusSlide fotos={par} />,
          });
        }
        return;
      }

      pgs.push({
        key: `${local.id}-potencial`,
        label: `Potencial de Impacto — ${nomeLocal}`,
        node: <PotencialImpactoSlide local={local} />,
      });
      local.fotos.forEach((foto, idx) => {
        pgs.push({
          key: `${local.id}-foto-${foto.id}`,
          label: `Registro Fotográfico${local.fotos.length > 1 ? `.${idx + 1}` : ""} — ${nomeLocal}`,
          node: (
            <RegistroFotograficoSlide local={local} foto={foto} sufixo={local.fotos.length > 1 ? idx + 1 : undefined} />
          ),
        });
      });
    });
    pgs.push({ key: "obrigado", label: "Obrigado!", node: <TituloSlide texto="OBRIGADO!" /> });
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
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      toast.success("Checking salvo. Você pode voltar e continuar editando depois em \"Meus Checkings\".");
    } catch (err: any) {
      toast.error(`Falha ao salvar: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const gerarLink = async () => {
    const elements = paginas.map((p) => slideRefs.current.get(p.key)).filter((el): el is HTMLDivElement => !!el);
    if (!elements.length) return;
    setGerandoLink(true);
    try {
      const blob = await buildPdfBlob(elements);
      const url = await gerarLinkPdf(checkingId, blob, data.cliente || "checking");
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Link copiado! " + url, { duration: 10000 });
    } catch (err: any) {
      toast.error(`Falha ao gerar link: ${err.message}`);
    } finally {
      setGerandoLink(false);
    }
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Carregando checking…
      </div>
    );
  }

  const capaColapsada = colapsados.has("capa");

  return (
    <div className="flex flex-col lg:flex-row h-full">
      <div className="w-full lg:w-[420px] lg:shrink-0 border-r border-border p-5 space-y-6 overflow-y-auto">
        <div>
          <h1 className="text-xl font-semibold">Criar Checking</h1>
          <p className="text-sm text-muted-foreground mt-1">Preenche os dados — a prévia atualiza ao lado.</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => toggleColapso("capa")}
            className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            {capaColapsada ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            Capa
          </button>
          {!capaColapsada && (
            <>
              <ImageDropZone
                label="Foto de capa"
                value={data.capaImageDataUrl}
                onChange={(v) => updateField({ capaImageDataUrl: v })}
                aspect="aspect-video"
                position={data.capaImagePosition}
                onPositionChange={(p) => updateField({ capaImagePosition: p })}
                zoom={data.capaImageZoom}
                onZoomChange={(z) => updateField({ capaImageZoom: z })}
                melhorada={data.capaMelhorada}
                onToggleMelhorada={() => updateField({ capaMelhorada: !data.capaMelhorada })}
                guiaCapa
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
            </>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Conteúdo</div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={addSlideTitulo}>
                <Plus className="size-3.5" /> Slide de Título
              </Button>
              <Button size="sm" variant="secondary" onClick={addLocal}>
                <Plus className="size-3.5" /> Local
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!data.locais.length}
                onClick={() => {
                  const ultimo = data.locais[data.locais.length - 1];
                  if (!ultimo) return;
                  addFoto(ultimo.id);
                  setColapsados((s) => {
                    const next = new Set(s);
                    next.delete(`local:${ultimo.id}`);
                    return next;
                  });
                }}
              >
                <Plus className="size-3.5" /> Foto
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Slides de título e Locais aparecem nessa ordem — usa ▲▼ pra mover qualquer um pra qualquer posição, mesmo
            entre categorias diferentes. "+ Foto" aqui em cima adiciona no último Local da lista. Um "Obrigado!" já é
            incluído automático no final de todo PDF.
          </p>

          {data.ordem.map((token, i) => {
            const podeSubir = i > 0;
            const podeDescer = i < data.ordem.length - 1;

            if (token.startsWith("titulo:")) {
              const slide = data.slidesTitulo.find((s) => `titulo:${s.id}` === token);
              if (!slide) return null;
              const tituloColapsado = colapsados.has(token);
              return (
                <div key={token} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => toggleColapso(token)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground min-w-0"
                    >
                      {tituloColapsado ? <ChevronRight className="size-3.5 shrink-0" /> : <ChevronDown className="size-3.5 shrink-0" />}
                      <span className="truncate">
                        {i + 1}. {slide.nome || slide.texto || "Slide de título"}
                      </span>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => moveOrdem(token, -1)}
                        disabled={!podeSubir}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-25"
                        title="Mover pra cima"
                      >
                        <ChevronUp className="size-3.5" />
                      </button>
                      <button
                        onClick={() => moveOrdem(token, 1)}
                        disabled={!podeDescer}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-25"
                        title="Mover pra baixo"
                      >
                        <ChevronDown className="size-3.5" />
                      </button>
                      <button
                        onClick={() => removeSlideTitulo(slide.id)}
                        className="text-muted-foreground hover:text-destructive"
                        title="Remover slide"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  {!tituloColapsado && (
                    <>
                      <FieldInput
                        label="Nome (só de organização, não aparece no PDF)"
                        value={slide.nome ?? ""}
                        onChange={(v) => updateSlideTitulo(slide.id, { nome: v })}
                        placeholder={`Slide ${i + 1}`}
                      />
                      <Input
                        placeholder="Texto do slide (ex.: Painel LED)"
                        value={slide.texto}
                        onChange={(e) => updateSlideTitulo(slide.id, { texto: e.target.value })}
                      />
                    </>
                  )}
                </div>
              );
            }

            const local = data.locais.find((l) => `local:${l.id}` === token);
            if (!local) return null;
            const localColapsado = colapsados.has(token);

            return (
              <div key={token} className="rounded-lg border border-border p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => toggleColapso(token)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground min-w-0"
                  >
                    {localColapsado ? <ChevronRight className="size-3.5 shrink-0" /> : <ChevronDown className="size-3.5 shrink-0" />}
                    <span className="truncate">
                      {i + 1}. {local.nome || local.localVeiculacao || "Local sem nome"}
                    </span>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => moveOrdem(token, -1)}
                      disabled={!podeSubir}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-25"
                      title="Mover pra cima"
                    >
                      <ChevronUp className="size-3.5" />
                    </button>
                    <button
                      onClick={() => moveOrdem(token, 1)}
                      disabled={!podeDescer}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-25"
                      title="Mover pra baixo"
                    >
                      <ChevronDown className="size-3.5" />
                    </button>
                    {data.locais.length > 1 && (
                      <button onClick={() => removeLocal(local.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {!localColapsado && (
                  <>
                    <FieldInput
                      label="Nome (só de organização, não aparece no PDF)"
                      value={local.nome ?? ""}
                      onChange={(v) => updateLocal(local.id, { nome: v })}
                      placeholder={`Local ${i + 1}`}
                    />
                    <FieldTextarea
                      label="Local de veiculação"
                      value={local.localVeiculacao}
                      onChange={(v) => updateLocal(local.id, { localVeiculacao: v })}
                    />
                    <FieldInput
                      label="Formato"
                      value={local.formato}
                      onChange={(v) => updateLocal(local.id, { formato: v })}
                      placeholder={data.tipo === "onibus" ? "Busdoor" : "Painel de LED"}
                    />

                    {data.tipo === "onibus" ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Linhas (carro — linha)</Label>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[11px]"
                            onClick={() =>
                              updateLocal(local.id, { linhas: [...(local.linhas ?? []), ""] })
                            }
                          >
                            <Plus className="size-3" /> Linha
                          </Button>
                        </div>
                        {(local.linhas ?? []).map((linha, idx) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <Input
                              placeholder="Carro 608 – Linha B19"
                              value={linha}
                              onChange={(e) => {
                                const linhas = [...(local.linhas ?? [])];
                                linhas[idx] = e.target.value;
                                updateLocal(local.id, { linhas });
                              }}
                            />
                            <button
                              onClick={() => {
                                const linhas = (local.linhas ?? []).filter((_, li) => li !== idx);
                                updateLocal(local.id, { linhas });
                              }}
                              className="text-muted-foreground hover:text-destructive shrink-0"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        ))}
                        {!(local.linhas ?? []).length && (
                          <p className="text-[11px] text-muted-foreground">Nenhuma linha adicionada ainda.</p>
                        )}
                      </div>
                    ) : (
                      <>
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
                            position={local.mapaImagePosition}
                            onPositionChange={(p) => updateLocal(local.id, { mapaImagePosition: p })}
                            zoom={local.mapaImageZoom}
                            onZoomChange={(z) => updateLocal(local.id, { mapaImageZoom: z })}
                            melhorada={local.mapaMelhorada}
                            onToggleMelhorada={() => updateLocal(local.id, { mapaMelhorada: !local.mapaMelhorada })}
                          />
                        </div>
                      </>
                    )}

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
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => moveFoto(local.id, foto.id, -1)}
                                disabled={fotoIdx === 0}
                                className="text-muted-foreground hover:text-foreground disabled:opacity-25"
                                title="Mover pra cima"
                              >
                                <ChevronUp className="size-3" />
                              </button>
                              <button
                                onClick={() => moveFoto(local.id, foto.id, 1)}
                                disabled={fotoIdx === local.fotos.length - 1}
                                className="text-muted-foreground hover:text-foreground disabled:opacity-25"
                                title="Mover pra baixo"
                              >
                                <ChevronDown className="size-3" />
                              </button>
                              <button
                                onClick={() => removeFoto(local.id, foto.id)}
                                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"
                                title="Remover esta foto"
                              >
                                <Trash2 className="size-3" /> Remover
                              </button>
                            </div>
                          </div>
                          <ImageDropZone
                            label="Solte a foto do outdoor"
                            value={foto.imageDataUrl}
                            onChange={(v) => updateFoto(local.id, foto.id, { imageDataUrl: v })}
                            aspect="aspect-video"
                            position={foto.imagePosition}
                            onPositionChange={(p) => updateFoto(local.id, foto.id, { imagePosition: p })}
                            zoom={foto.imageZoom}
                            onZoomChange={(z) => updateFoto(local.id, foto.id, { imageZoom: z })}
                            melhorada={foto.melhorada}
                            onToggleMelhorada={() => updateFoto(local.id, foto.id, { melhorada: !foto.melhorada })}
                          />
                          <Input
                            placeholder="Link do vídeo (opcional)"
                            className="h-8 text-xs"
                            value={foto.videoUrl ?? ""}
                            onChange={(e) => updateFoto(local.id, foto.id, { videoUrl: e.target.value })}
                          />
                        </div>
                      ))}
                      {!local.fotos.length && (
                        <p className="text-[11px] text-muted-foreground">Nenhuma foto adicionada ainda.</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-2">
          <Button className="flex-1" variant="secondary" onClick={salvar} disabled={salvando}>
            <Save className="size-4" />
            {salvando ? "Salvando…" : checkingId ? "Salvar alterações" : "Salvar"}
          </Button>
          <Button className="flex-1" variant="secondary" onClick={gerarLink} disabled={gerandoLink}>
            <Link2 className="size-4" />
            {gerandoLink ? "Gerando…" : "Gerar Link"}
          </Button>
        </div>
        <Button className="w-full" onClick={gerarPdf} disabled={gerando}>
          <Download className="size-4" />
          {gerando ? "Gerando…" : "Baixar PDF"}
        </Button>
      </div>

      <div className="flex-1 min-w-0 overflow-y-auto p-6 bg-muted/30">
        <div className="text-xs text-muted-foreground mb-3">{paginas.length} página(s) no PDF</div>
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${SLIDE_W * PREVIEW_SCALE}px, 1fr))` }}>
          {paginas.map((p, i) => (
            <div key={p.key} className="space-y-1">
              <div
                style={{ width: SLIDE_W * PREVIEW_SCALE, height: SLIDE_H * PREVIEW_SCALE }}
                className="shadow-md rounded-md overflow-hidden bg-white"
              >
                <div style={{ width: SLIDE_W, height: SLIDE_H, transform: `scale(${PREVIEW_SCALE})`, transformOrigin: "top left" }}>
                  {p.node}
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {i + 1}. {p.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cópia oculta em tamanho real (sem transform/escala) — é daqui que o PDF é capturado.
          Renderizar direto da prévia (que tem transform: scale) deixa o html2canvas confuso
          sobre a resolução real, gerando PDF borrado. */}
      <div aria-hidden style={{ position: "fixed", top: 0, left: -99999, width: SLIDE_W, height: 0, overflow: "visible" }}>
        {paginas.map((p) => (
          <div
            key={p.key}
            ref={(el) => {
              if (el) slideRefs.current.set(p.key, el);
              else slideRefs.current.delete(p.key);
            }}
            style={{ width: SLIDE_W, height: SLIDE_H }}
          >
            {p.node}
          </div>
        ))}
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
