import type { Metadata } from "next";
import { Simulator } from "@/features/trade/Simulator";

export const metadata: Metadata = { title: "Beginner Simulator — FINTIX" };

export default function Beginner() {
  return <Simulator />;
}
