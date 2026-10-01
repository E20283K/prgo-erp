"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { useWorkspaceStore } from "@/store/workspaceStore";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const { isAuthenticated } = useWorkspaceStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        suppressHydrationWarning
        className="min-h-screen w-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950"
      />
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <AppLayout>
      {null}
    </AppLayout>
  );
}

