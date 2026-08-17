import { MapPin } from "lucide-react";
import type { CheckingLocal } from "@/lib/checking/types";
import {
  CHECKING_COLORS as C,
  CHECKING_ENHANCE_FILTER,
  CHECKING_FONT_BODY,
  CHECKING_FONT_DISPLAY,
  SLIDE_H,
  SLIDE_W,
  imagePanZoomTransform,
} from "../slideTokens";
import { logoSouzaBranca } from "@/assets/logoSouza";
import { useFilteredImage } from "@/lib/checking/useFilteredImage";

export function PotencialImpactoSlide({ local }: { local: CheckingLocal }) {
  const mapaFiltrado = useFilteredImage(local.mapaImageDataUrl, local.mapaMelhorada ? CHECKING_ENHANCE_FILTER : undefined);

  return (
    <div
      style={{ width: SLIDE_W, height: SLIDE_H, fontFamily: CHECKING_FONT_BODY, background: C.white }}
      className="relative overflow-hidden flex flex-col"
    >
      <div className="relative flex items-center" style={{ background: C.black, padding: "26px 40px" }}>
        <img src={logoSouzaBranca} alt="M.Souza" style={{ height: 26 }} />
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ fontFamily: CHECKING_FONT_DISPLAY, color: C.white, fontSize: 32, letterSpacing: 1 }}
        >
          POTENCIAL DE IMPACTO
        </div>
      </div>

      <div className="flex-1 flex" style={{ padding: "28px 40px 8px" }}>
        <div className="flex-1 flex flex-col" style={{ marginRight: 32 }}>
          <div
            className="flex-1 rounded-md overflow-hidden"
            style={{ border: `3px solid ${C.navy}`, background: "#EDEDED" }}
          >
            {mapaFiltrado ? (
              <img
                src={mapaFiltrado}
                alt="Mapa de impacto"
                className="w-full h-full object-cover"
                style={{ transform: imagePanZoomTransform(local.mapaImagePosition, local.mapaImageZoom) }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm" style={{ color: C.grayText }}>
                Print do mapa de fluxo (Economapas)
              </div>
            )}
          </div>

          <div className="flex items-center gap-2" style={{ marginTop: 16 }}>
            <div
              className="flex items-center justify-center shrink-0 rounded-full"
              style={{ width: 26, height: 26, background: C.yellow }}
            >
              <MapPin size={14} color={C.black} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 400, color: C.black }}>
              {local.localVeiculacao || "Endereço do ponto"}
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center shrink-0" style={{ width: 240 }}>
          <div style={{ fontSize: 14, fontWeight: 400, color: C.black }}>Fluxo de passantes/dia:</div>
          <div style={{ color: C.yellow, fontSize: 46, fontWeight: 400, lineHeight: 1.1, marginTop: 4 }}>
            {local.fluxoPassantes || "—"}
          </div>
          <div style={{ height: 3, background: C.yellow, marginTop: 10 }} />
          <div style={{ textAlign: "right", fontSize: 11, color: C.grayText, marginTop: 8, fontStyle: "italic" }}>
            Fonte: Economapas
          </div>
        </div>
      </div>
    </div>
  );
}
