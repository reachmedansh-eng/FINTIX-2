import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MODULES, moduleBySlug } from "@/features/learn/curriculum";
import { ModuleScreen } from "@/features/learn/screens";

type Params = { params: Promise<{ module: string }> };

export const generateStaticParams = () => MODULES.map((entry) => ({ module: entry.slug }));

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const entry = moduleBySlug((await params).module);
  return { title: entry ? `Module ${entry.id}: ${entry.title} — FINTIX` : "FINTIX" };
}

export default async function ModulePage({ params }: Params) {
  const { module } = await params;
  if (!moduleBySlug(module)) notFound();
  return <ModuleScreen module={module} />;
}
