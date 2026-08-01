import { MapPin, Users } from "lucide-react";
import type { CheckingLocal } from "@/lib/checking/types";
import { CHECKING_COLORS as C, CHECKING_FONT_BODY, CHECKING_FONT_DISPLAY, SLIDE_H, SLIDE_W } from "../slideTokens";
import { CheckingFooterLogos } from "../CheckingFooterLogos";

export function PotencialImpactoSlide({ local }: { local: CheckingLocal }) {
  return (
    <div
      style={{ width: SLIDE_W, height: SLIDE_H, fontFamily: CHECKING_FONT_BODY, background: C.white }}
      className="relative overflow-hidden flex"
    >
      <div
        className="flex flex-col shrink-0"
        style={{ width: 400, height: "100%", background: C.black, padding: "40px 36px" }}
      >
        <div style={{ fontFamily: CHECKING_FONT_DISPLAY, color: C.white, fontSize: 34, lineHeight: 1.08 }}>
          POTENCIAL
        </div>
        <div style={{ fontFamily: CHECKING_FONT_DISPLAY, color: C.yellow, fontSize: 34, lineHeight: 1.08 }}>
          DE IMPACTO
        </div>

        <div className="mt-auto">
          <div className="flex items-center gap-2 mb-2">
            <Users size={20} color={C.yellow} />
            <span style={{ color: C.white, fontSize: 13, fontWeight: 600 }}>Fluxo de passantes:</span>
          </div>
          <div style={{ color: C.yellow, fontSize: 44, fontWeight: 900, lineHeight: 1 }}>
            {local.fluxoPassantes || "—"}
            <span style={{ fontSize: 18, fontWeight: 700 }}> /dia</span>
          </div>
        </div>

        <div style={{ marginTop: 40 }}>
          <CheckingFooterLogos />
        </div>
      </div>

      <div className="flex-1 flex flex-col" style={{ padding: "40px 40px 32px" }}>
        <div className="flex items-start gap-3" style={{ marginBottom: 20 }}>
          <div
            className="flex items-center justify-center shrink-0 rounded-full"
            style={{ width: 30, height: 30, background: C.yellow, marginTop: 2 }}
          >
            <MapPin size={16} color={C.black} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.black, lineHeight: 1.3 }}>
            {local.localVeiculacao || "Endereço do ponto"}
          </div>
        </div>

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

        <div style={{ textAlign: "right", fontSize: 11, color: C.grayText, marginTop: 8, fontStyle: "italic" }}>
          Fonte: Economapas
        </div>
      </div>
    </div>
  );
}
