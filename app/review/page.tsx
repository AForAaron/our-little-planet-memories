import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ReviewAccessGate } from "@/features/import-review/components/access-gate";
import { ImportReviewWorkbench } from "@/features/import-review/components/workbench";
import { canUseReview, reviewModeEnabled } from "@/features/import-review/server/store";

export const metadata = { title: "记忆审核入口" };
export const dynamic = "force-dynamic";

function requestFromHeaders(headerStore: Headers) {
  return new Request("http://localhost/review", {
    headers: {
      cookie: headerStore.get("cookie") ?? "",
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
        self: process.env.REVIEW_SELF_LABEL || "张张",
        partner: process.env.REVIEW_PARTNER_LABEL || "沈沈",
      }}
    />
  );
}
