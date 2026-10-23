import type { Metadata } from "next";
import { preload } from "react-dom";
import { Hub } from "@/features/learn/Hub";
import { asset } from "@/lib/asset";

export const metadata: Metadata = {
  title: "Learning Hub — FINTIX",
};

export default function Learn() {
  // The room is the first thing on screen, so its artwork is requested with the document.
  preload(asset("/learn/room.png"), { as: "image", fetchPriority: "high" });
  return <Hub />;
}
