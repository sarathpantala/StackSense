"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  FileUp,
  LogOut,
  Zap,
  Plus,
  PanelLeftClose,
  Trash2,
  Clock,
  Search,
  ChevronDown,
  ChevronRight,
  Pin,
  PinOff,
  Layers,
  Settings,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useConversations, useDeleteConversation } from "@/hooks/use-conversations";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { CollectionStats } from "@/types";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function groupConversations(
  conversations: { id: string; title: string; created_at: string; updated_at: string }[],
) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: { label: string; items: typeof conversations }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "This Week", items: [] },
    { label: "Older", items: [] },
  ];

  for (const conv of conversations) {
    const d = new Date(conv.updated_at);
    if (d >= today) groups[0].items.push(conv);
    else if (d >= yesterday) groups[1].items.push(conv);
    else if (d >= weekAgo) groups[2].items.push(conv);
    else groups[3].items.push(conv);
  }

  return groups.filter((g) => g.items.length > 0);
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/documents", label: "Documents", icon: FileUp },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { data: conversations } = useConversations();
  const deleteConversation = useDeleteConversation();

  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("stacksense_pinned_chats");
        return saved ? new Set(JSON.parse(saved)) : new Set();
      } catch {
        return new Set();
      }
    }
    return new Set();
  });
  const [showWorkspaceSwitcher, setShowWorkspaceSwitcher] = useState(false);

  const stats = useQuery({
    queryKey: ["rag-stats"],
    queryFn: () => api.get<CollectionStats>("/rag/stats"),
    staleTime: 60000,
  });

  const activeConversationId = pathname === "/chat" ? searchParams.get("c") : null;

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? "?";

  const togglePin = useCallback((id: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("stacksense_pinned_chats", JSON.stringify([...next]));
      return next;
    });
  }, []);

  const pinnedConversations = useMemo(
    () => (conversations ?? []).filter((c) => pinnedIds.has(c.id)),
    [conversations, pinnedIds],
  );

  const unpinnedConversations = useMemo(
    () => (conversations ?? []).filter((c) => !pinnedIds.has(c.id)),
    [conversations, pinnedIds],
  );

  const allGroups = useMemo(
    () => groupConversations(unpinnedConversations.slice(0, 30)),
    [unpinnedConversations],
  );

  const groups = searchQuery
    ? allGroups
        .map((g) => ({
          ...g,
          items: g.items.filter((c) =>
            c.title.toLowerCase().includes(searchQuery.toLowerCase()),
          ),
        }))
        .filter((g) => g.items.length > 0)
    : allGroups;

  const filteredPinned = searchQuery
    ? pinnedConversations.filter((c) =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : pinnedConversations;

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-border bg-surface transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-72",
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between px-3">
        {!collapsed ? (
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 shadow-md shadow-violet-500/20">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="gradient-text text-sm font-bold tracking-tight">StackSense</span>
          </Link>
        ) : (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 shadow-md shadow-violet-500/20">
            <Zap className="h-4 w-4 text-white" />
          </div>
        )}
        {!collapsed && (
          <button
            onClick={onToggle}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-surface-hover hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Workspace Switcher */}
      {!collapsed && (
        <div className="mx-3 mb-3">
          <button
            onClick={() => setShowWorkspaceSwitcher(!showWorkspaceSwitcher)}
            className="group flex w-full items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2.5 transition-all duration-150 hover:border-accent/30 hover:shadow-sm"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/20">
              <Layers className="h-3.5 w-3.5 text-accent" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-xs font-semibold leading-tight">
                {user?.full_name ? `${user.full_name}'s Workspace` : "Personal Workspace"}
              </p>
              <p className="text-[10px] text-zinc-400">Free Plan</p>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 text-zinc-400 transition-colors group-hover:text-foreground" />
          </button>
          {showWorkspaceSwitcher && (
            <div className="mt-1.5 rounded-xl border border-border bg-background p-1.5 shadow-lg">
              <button className="flex w-full items-center gap-2.5 rounded-lg bg-accent-muted px-3 py-2 text-left">
                <Layers className="h-3.5 w-3.5 text-accent" />
                <span className="flex-1 text-xs font-medium">
                  {user?.full_name ? `${user.full_name}'s Workspace` : "Personal Workspace"}
                </span>
                <Check className="h-3.5 w-3.5 text-accent" />
              </button>
              <div className="my-1.5 border-t border-border" />
              <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs text-zinc-400 transition-colors hover:bg-surface-hover hover:text-foreground">
                <Plus className="h-3.5 w-3.5" />
                Create Workspace
              </button>
              <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs text-zinc-400 transition-colors hover:bg-surface-hover hover:text-foreground">
                <Settings className="h-3.5 w-3.5" />
                Workspace Settings
              </button>
            </div>
          )}
        </div>
      )}

      {/* New Chat Button */}
      <div className="px-3 pb-3">
        <Button
          onClick={() => router.push("/chat")}
          className={cn(
            "w-full justify-start gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/20 transition-all hover:shadow-lg hover:shadow-violet-500/30 hover:brightness-110",
            collapsed && "justify-center px-0",
          )}
        >
          <Plus className="h-4 w-4" />
          {!collapsed && <span className="text-sm font-medium">New Chat</span>}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="space-y-0.5 px-3 pb-3">
        {navItems.map((item) => {
          const isActive =
            item.href === "/chat"
              ? pathname === "/chat" && !activeConversationId
              : pathname === item.href || pathname.startsWith(item.href + "/");

          const badge =
            item.href === "/documents" && stats.data?.vectors_count
              ? stats.data.vectors_count
              : null;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                collapsed && "justify-center px-0",
                isActive
                  ? "bg-accent text-white shadow-sm shadow-accent/25"
                  : "text-zinc-500 hover:bg-surface-hover hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="flex-1">{item.label}</span>}
              {!collapsed && badge !== null && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
                  )}
                >
                  {badge > 999 ? "999+" : badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 border-t border-border" />

      {/* Chat History */}
      {!collapsed && (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pt-3">
          {/* Search */}
          <div className="relative mb-2.5">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-xs outline-none transition-all placeholder:text-zinc-400 focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>

          {/* Pinned Section */}
          {filteredPinned.length > 0 && (
            <div className="mb-2">
              <div className="mb-1 flex items-center gap-1.5 px-1">
                <Pin className="h-3 w-3 text-amber-500" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                  Pinned
                </span>
              </div>
              <div className="space-y-0.5">
                {filteredPinned.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conv={conv}
                    isActive={activeConversationId === conv.id}
                    isPinned
                    onNavigate={() => router.push(`/chat?c=${conv.id}`)}
                    onDelete={() =>
                      deleteConversation.mutate(conv.id, {
                        onSuccess: () => {
                          if (activeConversationId === conv.id) router.push("/chat");
                        },
                      })
                    }
                    onTogglePin={() => togglePin(conv.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Grouped History */}
          <div className="flex items-center justify-between px-1 pb-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
              History
            </p>
            {conversations && (
              <span className="text-[10px] text-zinc-400">{conversations.length}</span>
            )}
          </div>

          <div className="flex-1 space-y-0.5 overflow-y-auto pb-2">
            {groups.map((group) => {
              const isGrpCollapsed = collapsedGroups.has(group.label);
              return (
                <div key={group.label}>
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className="mb-0.5 flex w-full items-center gap-1 rounded px-1 py-1 text-left transition-colors hover:bg-surface-hover"
                  >
                    {isGrpCollapsed ? (
                      <ChevronRight className="h-3 w-3 text-zinc-400" />
                    ) : (
                      <ChevronDown className="h-3 w-3 text-zinc-400" />
                    )}
                    <span className="text-[10px] font-medium text-zinc-400/70">{group.label}</span>
                    <span className="ml-auto text-[10px] text-zinc-400/50">{group.items.length}</span>
                  </button>
                  {!isGrpCollapsed && (
                    <div className="space-y-0.5">
                      {group.items.map((conv) => (
                        <ConversationItem
                          key={conv.id}
                          conv={conv}
                          isActive={activeConversationId === conv.id}
                          isPinned={false}
                          onNavigate={() => router.push(`/chat?c=${conv.id}`)}
                          onDelete={() =>
                            deleteConversation.mutate(conv.id, {
                              onSuccess: () => {
                                if (activeConversationId === conv.id) router.push("/chat");
                              },
                            })
                          }
                          onTogglePin={() => togglePin(conv.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {searchQuery && groups.length === 0 && filteredPinned.length === 0 && (
              <div className="flex flex-col items-center py-6 text-center">
                <Search className="h-4 w-4 text-zinc-300 dark:text-zinc-700" />
                <p className="mt-2 text-xs text-zinc-400">
                  No chats matching &ldquo;{searchQuery}&rdquo;
                </p>
              </div>
            )}
            {!searchQuery && (!conversations || conversations.length === 0) && (
              <div className="flex flex-col items-center py-8 text-center">
                <MessageSquare className="h-5 w-5 text-zinc-300 dark:text-zinc-700" />
                <p className="mt-2 text-xs text-zinc-400">No conversations yet</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom section */}
      <div className="border-t border-border p-3">
        <div
          className={cn(
            "mb-2 flex items-center",
            collapsed ? "justify-center" : "justify-between px-1",
          )}
        >
          {!collapsed && <span className="text-[11px] text-zinc-400">Theme</span>}
          <ThemeToggle />
        </div>
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-surface-hover",
            collapsed && "justify-center px-0",
          )}
        >
          <Avatar className="h-8 w-8 shrink-0 ring-2 ring-accent/20">
            <AvatarFallback className="bg-gradient-to-br from-violet-500 to-indigo-500 text-[11px] font-semibold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <>
              <div className="flex-1 truncate">
                <p className="truncate text-sm font-medium leading-tight">
                  {user?.full_name || user?.email}
                </p>
                <p className="truncate text-[11px] text-zinc-500">{user?.email}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-zinc-400 hover:text-red-500"
                onClick={logout}
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

/* ─── Conversation Item ─── */

function ConversationItem({
  conv,
  isActive,
  isPinned,
  onNavigate,
  onDelete,
  onTogglePin,
}: {
  conv: { id: string; title: string; updated_at: string };
  isActive: boolean;
  isPinned: boolean;
  onNavigate: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-all duration-150",
        isActive
          ? "border-l-2 border-accent bg-accent-muted text-accent"
          : "text-zinc-500 hover:bg-surface-hover hover:text-foreground",
      )}
    >
      <MessageSquare className="h-3 w-3 shrink-0 opacity-40" />
      <button onClick={onNavigate} className="flex min-w-0 flex-1 flex-col text-left">
        <span className="truncate text-[13px] leading-tight">{conv.title}</span>
        <span className="flex items-center gap-1 text-[10px] text-zinc-400">
          <Clock className="h-2.5 w-2.5" />
          {timeAgo(conv.updated_at)}
        </span>
      </button>
      <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
        <button
          onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
          className="flex h-5 w-5 items-center justify-center rounded text-zinc-400 transition-colors hover:text-amber-500"
          title={isPinned ? "Unpin" : "Pin"}
        >
          {isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="flex h-5 w-5 items-center justify-center rounded text-zinc-400 transition-colors hover:text-red-500"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
