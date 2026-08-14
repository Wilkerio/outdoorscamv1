// Paleta/geometria extraídas do modelo de Checking Fotográfico já usado pela agência
// (EH! Mídia / M.Souza) — fidelidade ao layout original, não uma escolha nova.
export const SLIDE_W = 1280;
export const SLIDE_H = 720;

export const CHECKING_COLORS = {
  black: "#0B0B0B",
  yellow: "#F5B400",
  cream: "#F1EFEA",
  navy: "#16223A",
  white: "#FFFFFF",
  grayText: "#6B6B6B",
};

export const CHECKING_FONT_DISPLAY = "'Archivo Black', 'Montserrat', sans-serif";
export const CHECKING_FONT_BODY = "'Montserrat', 'Inter', sans-serif";

// Mesmo preset usado no "Ajustar Foto" do Processamento (brilho/contraste/saturação).
export const CHECKING_ENHANCE_FILTER = "brightness(90%) contrast(136%) saturate(151%)";

// Deslocamento livre (não "âncora dentro da área visível") — pode cortar a imagem de
// propósito, a moldura (overflow:hidden) recorta o que sair mesmo. Zoom padrão 130% (mesmo
// sem o usuário mexer) garante que sempre sobra margem pra mover sem abrir vazio ao redor —
// tem que bater com o mesmo default usado no preview do formulário (ImageDropZone).
export function imagePanZoomTransform(position?: string, zoom?: number): string {
  const [x, y] = (position ?? "0% 0%").split(" ").map((v) => parseInt(v, 10));
  const px = Number.isFinite(x) ? x : 0;
  const py = Number.isFinite(y) ? y : 0;
  const z = Math.max(zoom  ?? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? 00, 80);
  return `translate(${px}%, ${py}%) scale(${z / 100})`;
}
