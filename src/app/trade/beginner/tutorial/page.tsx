import type { Metadata } from "next";
import { preload } from "react-dom";
import { Tutorial } from "@/features/trade/Tutorial";
import { asset } from "@/lib/asset";

export const metadata: Metadata = { title: "Simulator Tutorial — FINTIX" };

export default function SimulatorTutorial() {
  // The opening scene is the first thing on screen, so its artwork is requested with the document.
  preload(asset("/trade/neo-room.png"), { as: "image", fetchPriority: "high" });
  return <Tutorial />;
}
