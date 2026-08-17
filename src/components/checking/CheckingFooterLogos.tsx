import { logoSouzaPreta, logoSouzaBranca } from "@/assets/logoSouza";
import { CHECKING_COLORS as C } from "./slideTokens";

export function CheckingFooterLogos({ variant = "light" }: { variant?: "light" | "dark" }) {
  return (
    <div className="flex items-center gap-3">
      <img src={variant === "light" ? logoSouzaPreta : logoSouzaBranca} alt="M.Souza" style={{ height: 34 }} />
      <div style={{ flex: 1, height: 2, background: C.yellow }} />
    </div>
  );
}
