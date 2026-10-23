import { preload } from "react-dom";
import { Onboarding } from "@/features/onboarding/Onboarding";
import { WORLD } from "@/features/onboarding/world/camera";

export default function Home() {
  // The world is the first thing on screen, so its artwork is requested with the document.
  preload(WORLD.src, { as: "image", fetchPriority: "high" });
  return <Onboarding />;
}
