import { Camera } from "lucide-react";
import logoAsset from "@/assets/checking/logo-branco.png.asset.json";
import { logoSouzaBranca } from "@/assets/logoSouza";
const logoEhMidia = logoAsset.url;
import { CHECKING_COLORS as C, CHECKING_FONT_BODY, CHECKING_FONT_DISPLAY, SLIDE_H, SLIDE_W } from "../slideTokens";

export function TituloSlide({ texto }: { texto: string }) {
  return (
    <div
      style={{ width: SLIDE_W, height: SLIDE_H, fontFamily: CHECKING_FONT_BODY, background: C.black }}
      className="relative overflow-hidden"
    >
      <div style={{ position: "absolute", top: 24, left: 40, right: 40, height: 3, background: C.yellow }} />
      <div style={{ position: "absolute", bottom: 24, left: 40, right: 40, height: 3, background: C.yellow }} />

      <div className="h-full flex flex-col" style={{ padding: "56px 56px 70px" }}>
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="flex items-center justify-center rounded-full shrink-0"
            style={{ width: 26, height: 26, background: C.yellow }}
          >
            <Camera size={14} color={C.black} />
          </div>
          <span style={{ color: C.white, fontSize: 13, fontWeight: 700, letterSpacing: 1.5 }}>
            CHECKING FOTOGRÁFICO
          </span>
        </div>

        <div className="flex-1 flex items-center">
          <div
            style={{
              fontFamily: CHECKING_FONT_DISPLAY,
              color: C.white,
              fontSize: 60,
              lineHeight: 1.08,
              whiteSpace: "pre-line",
            }}
          >
            {texto || "TÍTULO"}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-3">
          <img src={logoEhMidia} alt="EH! Mídia" style={{ height: 36 }} />
          <img src={logoSouzaBranca} alt="Souza" style={{ height: 40 }} />
        </div>
      </div>
    </div>
  );
}
