export interface CheckingFoto {
  id: string;
  imageDataUrl: string;
  videoUrl?: string;
}

export interface CheckingLocal {
  id: string;
  localVeiculacao: string;
  formato: string;
  fluxoPassantes: string;
  mapaImageDataUrl?: string;
  fotos: CheckingFoto[];
}

export interface CheckingData {
  cliente: string;
  campanha: string;
  praca: string;
  periodo: string;
  ativo: string;
  capaImageDataUrl?: string;
  locais: CheckingLocal[];
}

export function novoLocal(): CheckingLocal {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    localVeiculacao: "",
    formato: "",
    fluxoPassantes: "",
    fotos: [],
  };
}

export function novaFoto(): CheckingFoto {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, imageDataUrl: "" };
}

export function checkingVazio(): CheckingData {
  return {
    cliente: "",
    campanha: "",
    praca: "",
    periodo: "",
    ativo: "",
    locais: [novoLocal()],
  };
}
