"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "./ui";

// A password input with a show/hide eye.
//
// People cannot remember what they cannot see. Paul set a password he could not
// read, then could not sign in with it, and neither of us could tell whether he
// had mistyped it or the gate was broken (2026-08-20). The eye removes that
// whole class of support conversation.
//
// The only client component on these pages: without JS the input still renders
// masked and the form still posts, the eye simply does nothing.

type Props = {
  name: string;
  label: string;
  required?: boolean;
  minLength?: number;
  autoFocus?: boolean;
  autoComplete?: string;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
};

export function PasswordField({
  name,
  label,
  required,
  minLength,
  autoFocus,
  autoComplete = "current-password",
  placeholder = "••••••••",
  invalid,
  className,
}: Props) {
  const [shown, setShown] = useState(false);
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          // A revealed field must not be `type="password"`, and a masked one must
          // not be `type="text"` — the browser keys its manager off this.
          type={shown ? "text" : "password"}
          name={name}
          required={required}
          minLength={minLength}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={invalid ? true : undefined}
          className={cn(
            "h-11 w-full rounded-lg border border-white/10 bg-white/[0.04] pl-3 pr-11 text-sm text-foreground placeholder:text-subtle outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/40",
            className
          )}
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          title={shown ? "Hide password" : "Show password"}
          className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-gold/40"
        >
          {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
