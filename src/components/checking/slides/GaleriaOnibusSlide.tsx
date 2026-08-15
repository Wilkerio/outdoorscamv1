import type { CheckingFoto } from "@/lib/checking/types";
import { CHECKING_COLORS as C, CHECKING_ENHANCE_FILTER, CHECKING_FONT_BODY, SLIDE_H, SLIDE_W, imagePanZoomTransform } from "../slideTokens";
import { CheckingFooterLogos } from "../CheckingFooterLogos";
import { useFilteredImage } from "@/lib/checking/useFilteredImage";

function FotoBox({ foto, solo }: { foto: CheckingFoto; solo?: boolean }) {
  const fotoFiltrada = useFilteredImage(foto.imageDataUrl, foto.melhorada ? CHECKING_ENHANCE_FILTER : undefined);
  return (
    <div
      className={`h-full rounded-md overflow-hidden ${solo ? "" : "flex-1"}`}
      style={{ border: `4px solid ${C.navy}`, width: solo ? "calc(50% - 12px)" : undefined }}
    >
      {fotoFiltrada ? (
        <img
          src={fotoFiltrada}
          alt="Ônibus"
          className="w-full h-full object-cover"
          style={{ transform: imagePanZoomTransform(foto.imagePosition, foto.imageZoom) }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-sm bg-white" style={{ color: C.grayText }}>
          Foto do ônibus
        </div>
      )}
    </div>
  );
}

export function GaleriaOnibusSlide({ fotos }: { fotos: CheckingFoto[] }) {
  return (
    <div
      style={{ width: SLIDE_W, height: SLIDE_H, fontFamily: CHECKING_FONT_BODY, background: C.cream }}
      className="relative overflow-hidden flex flex-col"
    >
      <div style={{ position: "absolute", top: 0, left: 0, width: 10, height: "100%", background: C.black }} />

      <div
        className={`flex-1 flex gap-6 ${fotos.length === 1 ? "justify-center" : ""}`}
        style={{ padding: "40px 40px 12px 56px" }}
      >
        {fotos.map((foto) => (
          <FotoBox key={foto.id} foto={foto} solo={fotos.length === 1} />
        ))}
      </div>

      <div style={{ padding: "0 40px 24px 56px" }}>
        <CheckingFooterLogos />
      </div>
    </div>
  );
}
