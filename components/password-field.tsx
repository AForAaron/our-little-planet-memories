"use client";

import { Eye, EyeOff } from "lucide-react";
import { useMemo, useState } from "react";

type PasswordFieldProps = {
  name: string;
  label: string;
  autoComplete: string;
  placeholder?: string;
  required?: boolean;
  showHint?: boolean;
};

function passwordHint(password: string) {
  if (!password) return "建议使用只有你们知道、但不容易被猜到的密码。";
  const checks = [
    password.length >= 8,
    /[a-zA-Z]/.test(password),
    /\d/.test(password),
    /[^a-zA-Z0-9]/.test(password),
  ].filter(Boolean).length;
  if (checks <= 1) return "安全性偏弱：可以加长一点，混合数字或符号。";
  if (checks <= 2) return "安全性一般：如果这是长期账号，建议再复杂一点。";
  return "安全性不错：记得不要和其他网站共用。";
}

export function PasswordField({
  name,
  label,
  autoComplete,
  placeholder,
  required = true,
  showHint = false,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const [password, setPassword] = useState("");
  const hint = useMemo(() => passwordHint(password), [password]);

  return (
    <label className="label">
      {label}
      <span className="password-field">
        <input
          className="password-input"
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={required}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "隐藏密码" : "显示密码"}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
      {showHint && <span className="text-xs font-normal leading-5 text-muted">{hint}</span>}
    </label>
  );
}
