import type { Metadata } from "next";
import { NotBuilt } from "@/features/shell/NotBuilt";

export const metadata: Metadata = { title: "Market — FINTIX" };

/** Holding screen: replace with the full Market screen. */
export default function Market() {
  return (
    <NotBuilt area="trade" title="Market">
      The full Market screen will list every asset here. It has not been built yet; Home shows a snapshot of five.
    </NotBuilt>
  );
}
