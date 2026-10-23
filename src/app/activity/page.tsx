import type { Metadata } from "next";
import { NotBuilt } from "@/features/shell/NotBuilt";

export const metadata: Metadata = { title: "Activity — FINTIX" };

/** Holding screen: replace with the full activity history. */
export default function Activity() {
  return (
    <NotBuilt area="home" title="Activity">
      Your full history of trades and completed lessons will be listed here. It has not been built yet; Home shows the most recent entries.
    </NotBuilt>
  );
}
