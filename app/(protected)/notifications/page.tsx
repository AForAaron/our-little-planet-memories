import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "通知" };

export default function NotificationsPage() {
  redirect("/footprints#inbox");
}
