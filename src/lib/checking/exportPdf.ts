import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { SLIDE_H, SLIDE_W } from "@/components/checking/slideTokens";

export async function exportSlidesToPdf(elements: HTMLElement[], filename: string) {
  if (!elements.length) return;
  await document.fonts.ready;

  const doc = new jsPDF({ orientation: "landscape", unit: "px", format: [SLIDE_W, SLIDE_H], compress: true });

  for (let i = 0; i < elements.length; i++) {
    const canvas = await html2canvas(elements[i], { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    if (i > 0) doc.addPage([SLIDE_W, SLIDE_H], "landscape");
    doc.addImage(imgData, "JPEG", 0, 0, SLIDE_W, SLIDE_H);
  }

  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
