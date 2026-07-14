import { Settings2 } from "lucide-react";
import { EmojiUsageProvider } from "@/components/emoji-usage-provider";
import { getSiteSettings } from "@/lib/data/settings";
import { SetupForm } from "./setup-form";

export const metadata = { title: "小星球设置" };

export default async function SetupPage() {
  const settings = await getSiteSettings();
  return (
    <main className="page-shell">
      <div className="mx-auto max-w-2xl">
        <span className="eyebrow"><Settings2 size={14} /> Couple settings</span>
        <h1 className="mt-3 font-heading text-4xl font-bold">小星球设置</h1>
        <p className="mt-3 leading-7 text-muted">
          这里决定首页标题、相识日期和两个人在网站中的名字。
        </p>

        <EmojiUsageProvider isDemo={settings.isDemo}>
          <SetupForm
            relationship={settings.relationship}
            profiles={settings.profiles}
            isDemo={settings.isDemo}
          />
        </EmojiUsageProvider>
      </div>
    </main>
  );
}
