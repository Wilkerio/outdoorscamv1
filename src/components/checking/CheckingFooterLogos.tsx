import logoCombinado from "@/assets/checking/eh-midia-msouza-combinado.svg";
import { CHECKING_COLORS as C } from "./slideTokens";

export function CheckingFooterLogos() {
  return (
    <div className="flex items-center gap-3">
      <img src={logoCombinado} alt="EH! Mídia · M.Souza" style={{ height: 30 }} />
      <div style={{ flex: 1, height: 2, background: C.yellow }} />
    </div>
  );
}
