import type { Metadata } from "next";
import { preload } from "react-dom";
import { Credentials } from "@/features/auth/Credentials";
import { ROOM } from "@/features/auth/frame";

export const metadata: Metadata = {
  title: "Sign in — FINTIX",
};

export default function Enter() {
  // The room is the first thing on screen, so its artwork is requested with the document.
  preload(ROOM.src, { as: "image", fetchPriority: "high" });
  return <Credentials />;
}
