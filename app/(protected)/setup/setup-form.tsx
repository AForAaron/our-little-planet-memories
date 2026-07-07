"use client";

import { Save, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

type SetupFormProps = {
  relationship: {
    title: string | null;
    together_since: string | null;
    first_met_on?: string | null;
  };
  profiles: {
    id: string;
    displayName: string;
  }[];
  isDemo: boolean;
};

type SetupDraft = {
  title: string;
  together_since: string;
  first_met_on: string;
  profileNames: Record<string, string>;
};

function initialDraft({
  relationship,
  profiles,
}: Pick<SetupFormProps, "relationship" | "profiles">): SetupDraft {
  return {
    title: relationship.title ?? "我们的小星球",
    together_since: relationship.together_since ?? "",
    first_met_on: relationship.first_met_on ?? "",
    profileNames: Object.fromEntries(
      profiles.map((profile) => [profile.id, profile.displayName]),
    ),
  };
}

export function SetupForm({ relationship, profiles, isDemo }: SetupFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const draftKey = "little-planet-setup-draft";
  const [draft, setDraft] = useState<SetupDraft>(() =>
    initialDraft({ relationship, profiles }),
  );

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<SetupDraft>;
        setDraft((current) => ({
          ...current,
          ...parsed,
          profileNames: {
            ...current.profileNames,
            ...(parsed.profileNames ?? {}),
          },
        }));
      }
    } catch {
      // Local draft restore is best-effort.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      // Local draft persistence is best-effort.
    }
  }, [draft]);

  function updateProfileName(id: string, value: string) {
    setDraft((current) => ({
      ...current,
      profileNames: { ...current.profileNames, [id]: value },
    }));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const response = await fetch("/api/settings", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json().catch(() => ({
        error:
          response.redirected || response.status === 0
            ? "登录状态异常，请刷新页面或重新登录后再保存。"
            : `保存失败：服务器返回了 ${response.status}。`,
      }))) as {
        error?: string;
      };
      if (!response.ok) {
        setError(result.error ?? "保存失败，请稍后重试。");
        return;
      }
      window.localStorage.removeItem(draftKey);
      setMessage("设置已保存。");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="surface mt-8 grid gap-5 p-6 sm:p-8">
      <label className="label">
        网站标题
        <input
          className="field"
          name="title"
          value={draft.title}
          onChange={(event) =>
            setDraft((current) => ({ ...current, title: event.target.value }))
          }
          required
        />
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="label">
          在一起的日期
          <input
            className="field"
            name="together_since"
            type="date"
            value={draft.together_since}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                together_since: event.target.value,
              }))
            }
          />
        </label>
        <label className="label">
          第一次见面
          <input
            className="field"
            name="first_met_on"
            type="date"
            value={draft.first_met_on}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                first_met_on: event.target.value,
              }))
            }
          />
        </label>
      </div>
      {profiles.map((profile, index) => (
        <label className="label" key={profile.id}>
          {index === 0 ? "第一个人的显示名字" : "第二个人的显示名字"}
          <input
            className="field"
            name={`profile_${profile.id}`}
            value={draft.profileNames[profile.id] ?? ""}
            onChange={(event) => updateProfileName(profile.id, event.target.value)}
          />
        </label>
      ))}
      <p className="text-xs leading-5 text-muted">
        设置会自动保存到这台电脑的本地草稿；刷新或保存失败后可以继续编辑。
      </p>
      {profiles.length < 2 && !isDemo && (
        <p className="rounded-soft border border-line bg-[var(--color-surface-soft)] p-4 text-sm leading-6 text-muted">
          目前只检测到 {profiles.length} 个已登录过的白名单账号。第二个人注册并进入网站后，这里会出现第二个人的显示名字。
        </p>
      )}
      {isDemo && (
        <p className="rounded-soft bg-[var(--color-amber-soft)] p-4 text-sm text-[var(--color-amber)]">
          当前为演示模式，完成 Neon 配置后才能保存。
        </p>
      )}
      {error && (
        <p className="rounded-soft bg-[var(--color-accent-soft)] p-4 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-soft border border-line bg-[var(--color-surface-soft)] p-4 text-sm text-accent">
          {message}
        </p>
      )}
      <button className="button-primary justify-self-end" type="submit" disabled={isDemo || pending}>
        {pending ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
        保存设置
      </button>
    </form>
  );
}
