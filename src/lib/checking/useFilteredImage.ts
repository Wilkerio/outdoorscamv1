import { useEffect, useState } from "react";

// html2canvas não aplica CSS `filter` de forma confiável (fotos saíam sem o
// preto-e-branco/realce). Aqui a gente "assa" o filtro direto nos pixels via
// canvas 2D — o resultado já sai correto tanto na tela quanto no PDF exportado.
export function useFilteredImage(src: string | undefined, filterCss: string | undefined): string | undefined {
  const [saida, setSaida] = useState<string | undefined>(src);

  useEffect(() => {
    if (!src) {
      setSaida(undefined);
      return;
    }
    if (!filterCss) {
      setSaida(src);
      return;
    }

    let cancelado = false;
    const img = new Image();
    img.onload = () => {
      if (cancelado) return;
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || 1;
      canvas.height = img.naturalHeight || 1;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setSaida(src);
        return;
      }
      ctx.filter = filterCss;
      ctx.drawImage(img, 0, 0);
      setSaida(canvas.toDataURL("image/png"));
    };
    img.onerror = () => setSaida(src);
    img.src = src;

    return () => {
      cancelado = true;
    };
  }, [src, filterCss]);

  return saida;
}
