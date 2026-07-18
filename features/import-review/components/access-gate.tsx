"use client";

import { LockKeyhole, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { readApiJson } from "@/lib/http/read-api-json";

export function ReviewAccessGate() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/import-review/access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        await readApiJson<{ ok?: boolean }>(response, "验证访问码失败。");
        window.location.reload();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "访问码不正确。");
      }
    });
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <form onSubmit={submit} className="surface w-full max-w-md p-7 sm:p-9">
        <LockKeyhole className="text-accent" size={34} />
        <h1 className="mt-4 font-heading text-2xl font-bold">进入记忆审核台</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          这是只给两个人临时协作使用的本机审核入口。请输入访问码后继续。
        </p>
        <label className="label mt-6">
          审核访问码
          <input
            className="field"
            type="password"
            autoComplete="current-password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="不要把访问码发到公开地方"
          />
        </label>
        {error && (
          <p className="mt-4 rounded-soft bg-[var(--color-accent-soft)] p-3 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}
        <button className="button-primary mt-6 w-full" type="submit" disabled={pending}>
          {pending ? <LoaderCircle size={16} className="animate-spin" /> : <LockKeyhole size={16} />}
          进入审核台
        </button>
      </form>
    </main>
  );
}
