"use client";

import type { ReactNode } from "react";
import { signOut } from "next-auth/react";

export function SignOutButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-brand hover:text-brand"
      title="Вийти"
    >
      {children}
    </button>
  );
}
