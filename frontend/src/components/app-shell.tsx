"use client";

import { Suspense, useState } from "react";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { Sidebar } from "@/components/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { PanelLeft } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useRequireAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Spinner size={32} />
          <p className="text-sm text-zinc-400">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Suspense>
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </Suspense>
      <div className="flex flex-1 flex-col overflow-hidden">
        {sidebarCollapsed && (
          <div className="flex h-12 items-center border-b border-border px-4">
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-all hover:bg-surface-hover hover:text-foreground"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          </div>
        )}
        <main className="flex-1 overflow-auto">
          <Suspense>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}
