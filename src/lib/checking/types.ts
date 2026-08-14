export interface CheckingFoto {
  id: string;
  imageDataUrl: string;
  imagePosition?: string;
  imageZoom?: number;
  melhorada?: boolean;
  videoUrl?: string;
}

export interface CheckingLocal {
  id: string;
  nome?: string;
  localVeiculacao: string;
  formato: string;
  fluxoPassantes: string;
  linhas?: string[];
  mapaImageDataUrl?: string;
  mapaImagePosition?: string;
  mapaImageZoom?: number;
  mapaMelhorada?: boolean;
  fotos: CheckingFoto[];
}

export interface CheckingTituloSlide {
  id: string;
  nome?: string;
  texto: string;
}

// Token de ordem: "titulo:<id>" ou "local:<id>" — define a sequência real das páginas,
// permitindo mover um Slide de Título pra qualquer posição entre os Locais (não só entre si).
export type CheckingOrdemToken = `titulo:${string}` | `local:${string}`;

export type CheckingTipo = "outdoor" | "onibus";

export interface CheckingData {
  tipo: CheckingTipo;
  cliente: string;
  campanha: string;
  praca: string;
  periodo: string;
  ativo: string;
  temAgencia: boolean;
  agencia: string;
  capaImageDataUrl?: string;
  capaImagePosition?: string;
  capaImageZoom?: number;
  capaMelhorada?: boolean;
  slidesTitulo: CheckingTituloSlide[];
  locais: CheckingLocal[];
  ordem: CheckingOrdemToken[];
}

function novoId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function novaFoto(): CheckingFoto {
  return { id: novoId(), imageDataUrl: "" };
}

export function novoLocal(): CheckingLocal {
  return {
    id: novoId(),
    localVeiculacao: "",
    formato: "",
    fluxoPassantes: "",
    fotos: [],
  };
}

export function novoSlideTitulo(): CheckingTituloSlide {
  return { id: novoId(), texto: "" };
}

export function checkingVazio(tipo: CheckingTipo = "outdoor"): CheckingData {
  const local = novoLocal();
  return {
    tipo,
    cliente: "",
    campanha: "",
    praca: "",
    periodo: "",
    ativo: "",
    temAgencia: false,
    agencia: "",
    slidesTitulo: [],
    locais: [local],
    ordem: [`local:${local.id}`],
  };
}

// Preenche campos que podem faltar em checkings salvos antes de existirem (ex.: ordem, tipo).
export function normalizarChecking(data: CheckingData): CheckingData {
  const slidesTitulo = data.slidesTitulo ?? [];
  const locais = data.locais ?? [];
  const ordem =
    data.ordem?.length
      ? data.ordem
      : [
          ...slidesTitulo.map((s) => `titulo:${s.id}` as CheckingOrdemToken),
          ...locais.map((l) => `local:${l.id}` as CheckingOrdemToken),
        ];
  return { ...data, tipo: data.tipo ?? "outdoor", slidesTitulo, locais, ordem };
}
