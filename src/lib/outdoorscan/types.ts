 export type PointStatus = "AGUARDANDO" | "PROCESSANDO" | "SUCESSO" | "SEM_COBERTURA" | "ERRO";

export interface PhotoAdjustment {
  heading: number;
  pitch: number;
  fov: number;
  url: string;
}

export interface Point {
  id: string;
  cod: string;
  endereco: string;
  bairro: string;
  cidade: string;
  lat: number;
  lng: number;
  formato: string;
  foto: string;
  empresa: string;
  status: PointStatus;
  adjustedPhoto?: PhotoAdjustment;
  foto_url?: string;
  fotoSalva?: boolean;
  error?: string;
}

export interface LogEntry {
  id: string;
  ts: number;
  level: "info" | "warn" | "error" | "success";
  message: string;
}