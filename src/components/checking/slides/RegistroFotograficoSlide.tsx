import { Play } from "lucide-react";
import type { CheckingFoto, CheckingLocal } from "@/lib/checking/types";
import { CHECKING_COLORS as C, CHECKING_FONT_BODY, CHECKING_FONT_DISPLAY, SLIDE_H, SLIDE_W } from "../slideTokens";
import { CheckingFooterLogos } from "../CheckingFooterLogos";

function Campo({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <span
        style={{
          background: C.yellow,
          color: C.black,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 0.5,
          padding: "2px 6px",
          borderRadius: 2,
        }}
      >
        {label.toUpperCase()}:
      </span>
      <div style={{ color: C.black, fontSize: 15, fontWeight: 700, marginTop: 6, lineHeight: 1.35 }}>{value || "—"}</div>
    </div>
  );
}

export function RegistroFotograficoSlide({
  local,
  foto,
  sufixo,
}: {
  local: CheckingLocal;
  foto: CheckingFoto;
  sufixo?: number;
}) {
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
          FOTOGRÁFICO{sufixo ? `.${sufixo}` : ""}
        </div>

        <div style={{ marginTop: 32 }}>
          <Campo label="Formato" value={local.formato} />
          <Campo label="Local de Veiculação" value={local.localVeiculacao} />
          <Campo label="Fluxo de Passantes" value={local.fluxoPassantes ? `${local.fluxoPassantes}/dia` : ""} />
        </div>

        {foto.videoUrl && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, color: C.black, marginBottom: 8 }}>
              COMPROVAÇÃO EM VÍDEO
            </div>
            <div
              className="inline-flex items-center gap-2"
              style={{ background: C.yellow, color: C.black, padding: "8px 16px", borderRadius: 20, fontWeight: 800, fontSize: 13 }}
            >
              <Play size={14} fill={C.black} />
              Abrir Vídeo
            </div>
          </div>
        )}

        <div className="mt-auto" style={{ paddingTop: 24 }}>
          <CheckingFooterLogos />
        </div>
      </div>

      <div className="flex-1 flex items-center" style={{ padding: "36px 40px 36px 8px" }}>
        <div className="w-full h-full rounded-md overflow-hidden" style={{ border: `4px solid ${C.navy}` }}>
          {foto.imageDataUrl ? (
            <img src={foto.imageDataUrl} alt="Registro fotográfico" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm bg-white" style={{ color: C.grayText }}>
              Foto do outdoor instalado
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
