import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ReviewAccessGate } from "@/features/import-review/components/access-gate";
import { ImportReviewWorkbench } from "@/features/import-review/components/workbench";
import { canUseReview, reviewModeEnabled } from "@/features/import-review/server/store";

export const metadata = { title: "记忆审核入口" };
export const dynamic = "force-dynamic";

function requestFromHeaders(headerStore: Headers) {
  const host = headerStore.get("host") ?? "localhost:3000";
  return new Request(`http://${host}/review`, {
    headers: {
      host,
      cookie: headerStore.get("cookie") ?? "",
      "x-forwarded-for": headerStore.get("x-forwarded-for") ?? "",
      "cf-connecting-ip": headerStore.get("cf-connecting-ip") ?? "",
    },
  });
}

export default async function ReviewPage() {
  if (!reviewModeEnabled()) notFound();
  const headerStore = await headers();
  const request = requestFromHeaders(headerStore);
  if (!canUseReview(request)) return <ReviewAccessGate />;
  return (
    <ImportReviewWorkbench
      reviewLabels={{
        self: process.env.REVIEW_SELF_LABEL || "我",
        partner: process.env.REVIEW_PARTNER_LABEL || "她",
      }}
    />
  );
}
