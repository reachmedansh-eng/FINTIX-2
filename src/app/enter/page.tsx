import type { Metadata } from "next";
import { preload } from "react-dom";
import { Credentials } from "@/features/auth/Credentials";
import { ROOM, ROOM_SHOWN } from "@/features/auth/frame";

export const metadata: Metadata = {
  title: "Sign in — FINTIX",
};

export default function Enter() {
  // On a wide screen the room is the first thing on screen, so its first frame is requested with the document (not on phones, which never show it).
  preload(ROOM.poster, { as: "image", fetchPriority: "high", media: ROOM_SHOWN });
  return <Credentials />;
}
