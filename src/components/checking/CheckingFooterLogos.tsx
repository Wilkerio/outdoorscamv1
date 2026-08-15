import logoAsset from "@/assets/checking/logo-branco.png.asset.json";
import logoSouzaPreto from "@/assets/logo-souza.png";
import logoSouzaBranco from "@/assets/logo-souza-branco.png";
const logoEhMidia = logoAsset.url;
import { CHECKING_COLORS as C } from "./slideTokens";

export function CheckingFooterLogos({ variant = "light" }: { variant?: "light" | "dark" }) {
  return (
    <div className="flex items-center gap-3">
      <img src={logoEhMidia} alt="EH! Mídia" style={{ height: 30 }} />
      <div style={{ flex: 1, height: 2, background: C.yellow }} />
      <img src={variant === "light" ? logoSouzaPreto : logoSouzaBranco} alt="Souza" style={{ height: 34 }} />
    </div>
  );
}
