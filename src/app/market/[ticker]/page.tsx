import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NotBuilt } from "@/features/shell/NotBuilt";
import { ASSETS, assetByTicker } from "@/features/trade/engine";

type Params = { params: Promise<{ ticker: string }> };

export const generateStaticParams = () => ASSETS.map((asset) => ({ ticker: asset.ticker.toLowerCase() }));

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const asset = assetByTicker((await params).ticker.toUpperCase());
  return { title: asset ? `${asset.ticker} — FINTIX` : "FINTIX" };
}

/** Holding screen: replace with the Asset View. */
export default async function AssetView({ params }: Params) {
  const asset = assetByTicker((await params).ticker.toUpperCase());
  if (!asset) notFound();
  return (
    <NotBuilt area="trade" title={`${asset.ticker} · ${asset.name}`}>
      The Asset View for {asset.name} will open here, with its chart and details. It has not been built yet.
    </NotBuilt>
  );
}
