import { redirect } from "next/navigation";
import { CompanionWidget } from "@/components/companion-widget";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCoupleUser } from "@/lib/auth/server";
import { assertLiveBackendConfigured, isLiveMode } from "@/lib/config/backend";
import { getSiteSettings } from "@/lib/data/settings";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  assertLiveBackendConfigured();
  const live = isLiveMode();
  if (live) {
    const user = await getCoupleUser();
    if (!user) redirect("/login");
  }
  const settings = await getSiteSettings();

  return (
    <>
      <SiteHeader isDemo={!live} title={settings.relationship.title} />
      {children}
      <CompanionWidget isDemo={!live} />
      <SiteFooter />
    </>
  );
}
