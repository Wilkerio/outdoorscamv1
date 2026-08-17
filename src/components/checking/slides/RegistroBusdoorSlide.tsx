import type { CheckingFoto, CheckingLocal } from "@/lib/checking/types";
import {
  CHECKING_COLORS as C,
  CHECKING_ENHANCE_FILTER,
  CHECKING_FONT_BODY,
  CHECKING_FONT_DISPLAY,
  SLIDE_H,
  SLIDE_W,
  imagePanZoomTransform,
} from "../slideTokens";
import { CheckingFooterLogos } from "../CheckingFooterLogos";
import { useFilteredImage } from "@/lib/checking/useFilteredImage";

export function RegistroBusdoorSlide({ local, foto }: { local: CheckingLocal; foto?: CheckingFoto }) {
  const fotoFiltrada = useFilteredImage(foto?.imageDataUrl, foto?.melhorada ? CHECKING_ENHANCE_FILTER : undefined);
  const linhas = (local.linhas ?? []).filter(Boolean);

  return (
    <div
      style={{ width: SLIDE_W, height: SLIDE_H, fontFamily: CHECKING_FONT_BODY, background: C.cream }}
      className="relative overflow-hidden flex"
    >
      <div style={{ position: "absolute", top: 0, left: 0, width: 10, height: "100%", background: C.black }} />

      <div className="flex flex-col shrink-0" style={{ width: 400, padding: "40px 36px 32px 56px" }}>
        <div style={{ fontFamily: CHECKING_FONT_DISPLAY, color: C.black, fontSize: 30, lineHeight: 1.08 }}>
          REGISTRO
        </div>
        <div style={{ fontFamily: CHECKING_FONT_DISPLAY, color: C.yellow, fontSize: 30, lineHeight: 1.08 }}>
          FOTOGRÁFICO
        </div>

        <div style={{ marginTop: 24 }}>
          <span
            style={{
              background: C.yellow,
              color: C.black,
              fontSize: 11,
              fontWeight: 400,
              letterSpacing: 0.5,
              padding: "2px 6px",
              borderRadius: 2,
            }}
          >
            FORMATO:
          </span>
          <div style={{ color: C.black, fontSize: 15, fontWeight: 400, marginTop: 6 }}>{local.formato || "—"}</div>
        </div>

        <div style={{ marginTop: 18, flex: 1, overflow: "hidden" }}>
          <span
            style={{
              background: C.yellow,
              color: C.black,
              fontSize: 11,
              fontWeight: 400,
              letterSpacing: 0.5,
              padding: "2px 6px",
              borderRadius: 2,
            }}
          >
            LINHAS
          </span>
          <div style={{ marginTop: 8 }}>
            {linhas.length ? (
              linhas.map((linha, idx) => (
                <div key={idx} style={{ color: C.black, fontSize: 13, fontWeight: 400, lineHeight: 1.7 }}>
                  {linha}
                </div>
              ))
            ) : (
              <div style={{ color: C.grayText, fontSize: 13 }}>—</div>
            )}
          </div>
        </div>

        <div style={{ paddingTop: 16 }}>
          <CheckingFooterLogos />
        </div>
      </div>

      <div className="flex-1 flex items-center" style={{ padding: "36px 40px 36px 8px" }}>
        <div className="w-full h-full rounded-md overflow-hidden" style={{ border: `4px solid ${C.navy}` }}>
          {fotoFiltrada ? (
            <img
              src={fotoFiltrada}
              alt="Registro fotográfico"
              className="w-full h-full object-cover"
              style={{ transform: imagePanZoomTransform(foto?.imagePosition, foto?.imageZoom) }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm bg-white" style={{ color: C.grayText }}>
              Foto do busdoor
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
