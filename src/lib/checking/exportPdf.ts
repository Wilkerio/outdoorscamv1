import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";
import { SLIDE_H, SLIDE_W } from "@/components/checking/slideTokens";

export async function buildPdfBlob(elements: HTMLElement[]): Promise<Blob> {
  await document.fonts.ready;

  const doc = new jsPDF({ orientation: "landscape", unit: "px", format: [SLIDE_W, SLIDE_H], compress: true });

  for (let i = 0; i < elements.length; i++) {
    // scale 3 + PNG (sem perda) — mesma nitidez da prévia na tela, sem os artefatos do JPEG.
    const canvas = await html2canvas(elements[i], { scale: 3, useCORS: true, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");
    if (i > 0) doc.addPage([SLIDE_W, SLIDE_H], "landscape");
    doc.addImage(imgData, "PNG", 0, 0, SLIDE_W, SLIDE_H);
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
