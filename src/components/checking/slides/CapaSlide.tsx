import { User, ClipboardList, MapPin, Calendar, Clock, Building2 } from "lucide-react";
import type { CheckingData } from "@/lib/checking/types";
import { CHECKING_COLORS as C, CHECKING_FONT_BODY, CHECKING_FONT_DISPLAY, SLIDE_H, SLIDE_W, imagePanZoomTransform } from "../slideTokens";
import { CheckingFooterLogos } from "../CheckingFooterLogos";
import { useFilteredImage } from "@/lib/checking/useFilteredImage";

const PANEL_W = SLIDE_W * 0.47;

const ROWS: { key: "cliente" | "campanha" | "praca" | "periodo" | "ativo"; label: string; icon: typeof User }[] = [
  { key: "cliente", label: "Cliente", icon: User },
  { key: "campanha", label: "Campanha", icon: ClipboardList },
  { key: "praca", label: "Praça", icon: MapPin },
  { key: "periodo", label: "Período", icon: Calendar },
  { key: "ativo", label: "Ativo", icon: Clock },
];

export function CapaSlide({ data }: { data: CheckingData }) {
  const rows = data.temAgencia && data.agencia
     [ROWS[0], { key: "agencia" as const, label: "Agência", icon: Building2 }, ...ROWS.slice(1)]
    : ROWS;

  const capaFiltrada = useFilteredImage(
    data.capaImageDataUrl,
    data.capaMelhorada  "grayscale(1) contrast(1.15) brightness(95%)" : "grayscale(1) contrast(1.05)",
  );

  return (
    <div
      style={{ width: SLIDE_W, height: SLIDE_H, fontFamily: CHECKING_FONT_BODY, background: C.white }}
      className="relative overflow-hidden"
    >
      {capaFiltrada  (
        <img
          src={capaFiltrada}
          alt="Capa"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: imagePanZoomTransform(data.capaImagePosition, data.capaImageZoom) }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg,#d9d9d9,#a8a8a8)" }} />
      )}

      {/* html2canvas não recorta clip-path de forma confiável — desenha a forma via SVG (bem suportado). */}
      <svg
        className="absolute top-0 left-0"
        width={PANEL_W}
        height={SLIDE_H}
        viewBox={`0 0 ${PANEL_W} ${SLIDE_H}`}
        style={{ display: "block" }}
      >
        <polygon points={`0,0 ${PANEL_W},0 ${PANEL_W * 0.8},${SLIDE_H} 0,${SLIDE_H}`} fill={C.black} />
      </svg>

      <div
        className="absolute top-0 left-0 h-full flex flex-col"
        style={{
          width: PANEL_W * 0.8,
          padding: "48px 40px 40px",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, width: 14, height: 64, background: C.yellow }} />

        <div>
          <div style={{ fontFamily: CHECKING_FONT_DISPLAY, color: C.white, fontSize: 46, lineHeight: 1.02 }}>
            CHECKING
          </div>
          <div style={{ fontFamily: CHECKING_FONT_DISPLAY, color: C.yellow, fontSize: 46, lineHeight: 1.02 }}>
            FOTOGRÁFICO
          </div>
          <div style={{ color: "#CFCFCF", fontSize: 12, letterSpacing: 1.5, marginTop: 10, fontWeight: 600 }}>
            COMPROVAÇÃO DE MÍDIA INSTALADA
          </div>
        </div>

        <div className="flex flex-col gap-4" style={{ marginTop: 44 }}>
          {rows.map(({ key, label, icon: Icon }) => (
            <div key={key} className="flex items-center gap-3">
              <div
                className="flex items-center justify-center shrink-0 rounded-md"
                style={{ width: 30, height: 30, background: C.yellow }}
              >
                <Icon size={16} color={C.black} />
              </div>
              <div>
                <div style={{ color: C.yellow, fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>
                  {label.toUpperCase()}:
                </div>
                <div style={{ color: C.white, fontSize: 15, fontWeight: 700 }}>{data[key] || "—"}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto" style={{ paddingTop: 32 }}>
          <CheckingFooterLogos />
        </div>
      </div>
    </div>
  );
}
