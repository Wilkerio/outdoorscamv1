import logoEhMidia from "@/assets/checking/eh-midia-logo.svg";
import { CHECKING_COLORS as C } from "./slideTokens";

export function CheckingFooterLogos() {
  return (
    <div className="flex items-center gap-3">
      <img src={logoEhMidia} alt="EH! Mídia" style={{ height: 30 }} />
      <div style={{ flex: 1, height: 2, background: C.yellow }} />
    </div>
  );
}
