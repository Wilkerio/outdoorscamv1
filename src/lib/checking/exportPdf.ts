import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";
import { SLIDE_H, SLIDE_W } from "@/components/checking/slideTokens";

type LinkAnnotation = {
  x: number;
  y: number;
  w: number;
  h: number;
  href: string;
};

// Fotos de um checking já salvo vêm de URL https (Supabase), não mais base64 local —
// sem isso o html2canvas pode capturar a página antes da imagem terminar de baixar,
// gerando página em branco.
async function waitForImages(elements: HTMLElement[]): Promise<void> {
  const imgs = elements.flatMap((el) => Array.from(el.querySelectorAll("img")));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
          setTimeout(done, 10000);
        }),
    ),
  );
  // folga pro filtro em canvas (preto-e-branco/melhorar foto) terminar de "assar" o resultado.
  await new Promise((resolve) => setTimeout(resolve, 400));
}

function normalizarHref(href: string): string | null {
  const valor = href.trim();
  if (!valor) return null;
  if (/^(https:|mailto:|tel:|sms:|ftp:|ftps:|#)/i.test(valor)) return valor;
  return `https://${valor}`;
}

function coletarLinks(elemento: HTMLElement): LinkAnnotation[] {
  const slideRect = elemento.getBoundingClientRect();
  return Array.from(elemento.querySelectorAll<HTMLAnchorElement>("a[href]"))
    .map((anchor) => {
      const href = normalizarHref(anchor.getAttribute("href") ?? ?? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? ? nchor.href);
      if (!href) return null;
      const rect = anchor.getBoundingClientRect();
      const x = rect.left - slideRect.left;
      const y = rect.top - slideRect.top;
      const w = rect.width;
      const h = rect.height;
      if (w <= 0 || h <= 0) return null;
      return { x, y, w, h, href };
    })
    .filter((link): link is LinkAnnotation => !!link);
}

export async function buildPdfBlob(elements: HTMLElement[]): Promise<Blob> {
  await document.fonts.ready;
  await waitForImages(elements);

  const doc = new jsPDF({ orientation: "landscape", unit: "px", format: [SLIDE_W, SLIDE_H], compress: true });

  for (let i = 0; i < elements.length; i++) {
    // Prioridade é qualidade, não tamanho de arquivo — scale 4 + PNG sem perda nenhuma.
    const canvas = await html2canvas(elements[i], {
      scale: 4,
      useCORS: true,
      backgroundColor: "#ffffff",
      imageTimeout: 15000,
    });
    const imgData = canvas.toDataURL("image/png");
    if (i > 0) doc.addPage([SLIDE_W, SLIDE_H], "landscape");
    doc.addImage(imgData, "PNG", 0, 0, SLIDE_W, SLIDE_H);

    for (const link of coletarLinks(elements[i])) {
      doc.link(link.x, link.y, link.w, link.h, { url: link.href });
    }
  }

  return doc.output("blob");
}

export async function exportSlidesToPdf(elements: HTMLElement[], filename: string) {
  if (!elements.length) return;
  const blob = await buildPdfBlob(elements);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
