import type { Metadata } from "next";
import { Levels } from "@/features/trade/Levels";

export const metadata: Metadata = { title: "Trading Simulator — FINTIX" };

export default function Trade() {
  return <Levels />;
}
