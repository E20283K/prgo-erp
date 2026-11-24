"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useTgSession } from "./TgSession";
import { TG_MODULES, canOpenModule } from "./modules";

export default function TgHome() {
  const { state } = useTgSession();
  if (state.status !== "ready") return null;
  const user = state.user;
  const modules = TG_MODULES.filter((m) => canOpenModule(user, m));

  return (
    <main className="mx-auto max-w-lg px-3 pb-6 pt-3">
      <header className="mb-3 flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-md border border-border bg-muted text-xs font-semibold">
          {user.initials}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{user.fullName}</div>
          <div className="truncate text-xs text-muted-foreground">{user.department || user.role}</div>
        </div>
      </header>

      {modules.length === 0 ? (
        <div className="rounded-md border border-border bg-card px-3 py-6 text-center text-xs text-muted-foreground">
          {"Ruxsat berilgan bo'lim yo'q"}
        </div>
      ) : (
        <nav className="overflow-hidden rounded-md border border-border bg-card">
          {modules.map((m) => (
            <Link
              key={m.key}
              href={m.href}
              className="flex h-11 items-center gap-2.5 border-b border-border px-3 last:border-b-0 active:bg-muted"
            >
              <m.icon className="size-4 text-muted-foreground" />
              <span className="flex-1 text-sm">{m.title}</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          ))}
        </nav>
      )}
    </main>
  );
}
