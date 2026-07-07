import { notFound } from "next/navigation";
import { redirect } from "next/navigation";

export const metadata = { title: "本地记忆审核台" };
export const dynamic = "force-dynamic";

export default function ImportReviewPage() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.IMPORT_REVIEW_MODE !== "1"
  ) {
    notFound();
  }
  redirect("/review");
}
