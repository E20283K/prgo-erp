"use client";

import * as React from "react";
import { Link2Off, Loader2, TriangleAlert } from "lucide-react";
import { useTgSession } from "./TgSession";

function Notice({ icon: Icon, title, text }: { icon: typeof Link2Off; title: string; text: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
      <Icon className="size-5 text-muted-foreground" />
      <div className="text-sm font-medium">{title}</div>
      <div className="max-w-xs text-xs text-muted-foreground">{text}</div>
    </div>
  );
}

/** Renders the Mini App only once the Telegram user is signed in as an ERP user. */
export function TgGate({ children }: { children: React.ReactNode }) {
  const { state } = useTgSession();
  if (state.status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (state.status === "not_linked") {
    return (
      <Notice
        icon={Link2Off}
        title="Akkaunt bog'lanmagan"
        text="ERP'dagi foydalanuvchi profilingizdan Telegram havolasini oling va botda Start bosing."
      />
    );
  }
  if (state.status === "error") {
    return <Notice icon={TriangleAlert} title="Kirib bo'lmadi" text={state.message} />;
  }
  return <>{children}</>;
}
