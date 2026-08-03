import { MapPin } from "lucide-react";
import type { CheckingLocal } from "@/lib/checking/types";
import { CHECKING_COLORS as C, CHECKING_FONT_BODY, CHECKING_FONT_DISPLAY, SLIDE_H, SLIDE_W } from "../slideTokens";
import { CheckingFooterLogos } from "../CheckingFooterLogos";

export function PotencialImpactoSlide({ local }: { local: CheckingLocal }) {
  return (
    <div
      style={{ width: SLIDE_W, height: SLIDE_H, fontFamily: CHECKING_FONT_BODY, background: C.white }}
      className="relative overflow-hidden flex flex-col"
    >
      <div style={{ background: C.black, padding: "26px 0", textAlign: "center" }}>
        <div style={{ fontFamily: CHECKING_FONT_DISPLAY, color: C.white, fontSize: 32, letterSpacing: 1 }}>
          POTENCIAL DE IMPACTO
        </div>
      </div>

      <div className="flex-1 flex" style={{ padding: "28px 40px 8px" }}>
        <div className="flex-1 flex flex-col" style={{ marginRight: 32 }}>
          <div
            className="flex-1 rounded-md overflow-hidden"
            style={{ border: `3px solid ${C.navy}`, background: "#EDEDED" }}
          >
            {local.mapaImageDataUrl ? (
              <img src={local.mapaImageDataUrl} alt="Mapa de impacto" className="w-full h-full object-cover" />
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
            <div style={{ fontSize: 15, fontWeight: 700, color: C.black }}>
              {local.localVeiculacao || "Endereço do ponto"}
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center shrink-0" style={{ width: 240 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.black }}>Fluxo de passantes/dia:</div>
          <div style={{ color: C.yellow, fontSize: 46, fontWeight: 900, lineHeight: 1.1, marginTop: 4 }}>
            {local.fluxoPassantes || "—"}
          </div>
          <div style={{ height: 3, background: C.yellow, marginTop: 10 }} />
          <div style={{ textAlign: "right", fontSize: 11, color: C.grayText, marginTop: 8, fontStyle: "italic" }}>
            Fonte: Economapas
          </div>
        </div>
      </div>

      <div style={{ padding: "0 40px 24px" }}>
        <CheckingFooterLogos />
      </div>
    </div>
  );
}
