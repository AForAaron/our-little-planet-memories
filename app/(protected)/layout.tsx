import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ensureProfile } from "@/lib/auth/profile";
import { getCoupleUser } from "@/lib/auth/server";
import { assertLiveBackendConfigured, isLiveMode } from "@/lib/config/backend";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  assertLiveBackendConfigured();
  const live = isLiveMode();
  if (live) {
    const user = await getCoupleUser();
    if (!user) redirect("/login");
    await ensureProfile(user);
  }

  return (
    <>
      <SiteHeader isDemo={!live} />
      {children}
      <SiteFooter />
    </>
  );
}
