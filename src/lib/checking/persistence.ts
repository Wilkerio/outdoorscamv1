import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { CheckingData } from "./types";

const BUCKET = "checking-imagens";

function isDataUrl(v?: string) {
  return !!v && v.startsWith("data:");
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

async function uploadImagemSeNecessario(valor: string | undefined, pasta: string): Promise<string | undefined> {
  if (!isDataUrl(valor)) return valor;
  const blob = await dataUrlToBlob(valor!);
  const ext = blob.type.split("/")[1] || "jpg";
  const fileName = `${pasta}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(fileName, blob, { contentType: blob.type, upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}

// Sobe qualquer imagem ainda em base64 (capa, mapas, fotos) pro storage antes de salvar —
// evita gravar imagem grande direto na coluna jsonb.
async function prepararParaSalvar(data: CheckingData): Promise<CheckingData> {
  const capaImageDataUrl = await uploadImagemSeNecessario(data.capaImageDataUrl, "capas");
  const locais = await Promise.all(
    data.locais.map(async (local) => ({
      ...local,
      mapaImageDataUrl: await uploadImagemSeNecessario(local.mapaImageDataUrl, "mapas"),
      fotos: await Promise.all(
        local.fotos.map(async (foto) => ({
          ...foto,
          imageDataUrl: (await uploadImagemSeNecessario(foto.imageDataUrl, "fotos")) ?? "",
        })),
      ),
    })),
  );
  return { ...data, capaImageDataUrl, locais };
}

export interface CheckingSalvo {
  id: string;
  nome: string;
  updated_at: string;
}

export async function salvarChecking(id: string | null, nome: string, data: CheckingData): Promise<string> {
  const dadosProntos = (await prepararParaSalvar(data)) as unknown as Json;
  if (id) {
    const { error } = await supabase
      .from("checkings")
      .update({ nome, dados: dadosProntos, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return id;
  }
  const { data: inserted, error } = await supabase
    .from("checkings")
    .insert({ nome, dados: dadosProntos })
    .select("id")
    .single();
  if (error) throw error;
  return inserted.id;
}

export async function listarCheckings(): Promise<CheckingSalvo[]> {
  const { data, error } = await supabase
    .from("checkings")
    .select("id, nome, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function carregarChecking(id: string): Promise<CheckingData> {
  const { data, error } = await supabase.from("checkings").select("dados").eq("id", id).single();
  if (error) throw error;
  return data.dados as unknown as CheckingData;
}

export async function excluirChecking(id: string): Promise<void> {
  const { error } = await supabase.from("checkings").delete().eq("id", id);
  if (error) throw error;
}
