import { notFound } from "next/navigation";
import { EntryCategoryPage } from "@/components/entry-category-page";

export default async function DailyFeaturePage({
  params,
}: {
  params: Promise<{ feature: string }>;
}) {
  const { feature } = await params;
  if (feature === "diary") {
    return <EntryCategoryPage title="共同日记" description="平凡日子也值得被认真写下来。" eyebrow="Shared diary" categories={["diary"]} backHref="/daily" backLabel="关于日常" />;
  }
  if (feature === "watch") {
    return <EntryCategoryPage title="观影记录" description="电影结束以后，也把我们的感受留下来。" eyebrow="Watch together" categories={["watch"]} backHref="/daily" backLabel="关于日常" />;
  }
  if (feature === "wishlist") notFound();
  notFound();
}
