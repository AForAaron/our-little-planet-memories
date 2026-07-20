import { requireCoupleUser } from "@/lib/auth/server";
import { isLiveMode } from "@/lib/config/backend";

export default async function ProtectedTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  // App Router layouts persist across client navigation. Templates do not, so
  // this rechecks an allowlist removal before every protected page transition.
  if (isLiveMode()) {
    await requireCoupleUser();
  }

  return children;
}
