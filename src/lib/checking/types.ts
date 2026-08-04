export interface CheckingFoto {
  id: string;
  imageDataUrl: string;
  imagePosition?: string;
  melhorada?: boolean;
  videoUrl?: string;
}

export interface CheckingLocal {
  id: string;
  localVeiculacao: string;
  formato: string;
  fluxoPassantes: string;
  mapaImageDataUrl?: string;
  mapaImagePosition?: string;
  mapaMelhorada?: boolean;
  fotos: CheckingFoto[];
}

export interface CheckingTituloSlide {
  id: string;
  texto: string;
}

export interface CheckingData {
  cliente: string;
  campanha: string;
  praca: string;
  periodo: string;
  ativo: string;
  temAgencia: boolean;
  agencia: string;
  capaImageDataUrl?: string;
  capaImagePosition?: string;
  capaMelhorada?: boolean;
  slidesTitulo: CheckingTituloSlide[];
  locais: CheckingLocal[];
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
    fotos: [novaFoto()],
  };
}

export function novoSlideTitulo(): CheckingTituloSlide {
  return { id: novoId(), texto: "" };
}

export function checkingVazio(): CheckingData {
  return {
    cliente: "",
    campanha: "",
    praca: "",
    periodo: "",
    ativo: "",
    temAgencia: false,
    agencia: "",
    slidesTitulo: [],
    locais: [novoLocal()],
  };
}
