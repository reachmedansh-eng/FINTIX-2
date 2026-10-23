import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MODULES, moduleBySlug } from "@/features/learn/curriculum";
import { LessonScreen } from "@/features/learn/screens";

type Params = { params: Promise<{ module: string; lesson: string }> };

/** Besides its lessons, every module has a final challenge and a completion screen. */
const EXTRA: Record<string, string> = { challenge: "Final Challenge", complete: "Module complete" };

export const generateStaticParams = () =>
  MODULES.flatMap((entry) => [...entry.lessons.map((lesson) => lesson.slug), ...Object.keys(EXTRA)].map((lesson) => ({ module: entry.slug, lesson })));

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { module, lesson } = await params;
  const entry = moduleBySlug(module);
  const title = EXTRA[lesson] ?? entry?.lessons.find((item) => item.slug === lesson)?.title;
  return { title: entry && title ? `${title} · Module ${entry.id} — FINTIX` : "FINTIX" };
}

export default async function LessonPage({ params }: Params) {
  const { module, lesson } = await params;
  const entry = moduleBySlug(module);
  if (!entry || !(lesson in EXTRA || entry.lessons.some((item) => item.slug === lesson))) notFound();
  return <LessonScreen module={module} lesson={lesson} />;
}
