import type { Metadata } from "next";
import { Dashboard } from "@/features/home/Dashboard";

export const metadata: Metadata = {
  title: "Home — FINTIX",
};

export default function Home() {
  return <Dashboard />;
}
