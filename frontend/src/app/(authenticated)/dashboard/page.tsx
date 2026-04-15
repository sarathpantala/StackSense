"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { CollectionStats } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  FileUp,
  Sparkles,
  Activity,
  Database,
  ArrowRight,
  ArrowUpRight,
  Clock,
  Zap,
  Shield,
  Server,
  BarChart3,
  TrendingUp,
  Timer,
  RefreshCw,
  Bug,
  Search,
  FileCode,
  Brain,
  Cpu,
  HardDrive,
  Wifi,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Gauge,
  Globe,
  Layers,
} from "lucide-react";
import Link from "next/link";
import { useConversations } from "@/hooks/use-conversations";
import { cn } from "@/lib/utils";

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

const quickActions = [
  {
    title: "Start a Chat",
    description: "Query your knowledge base with AI",
    href: "/chat",
    icon: MessageSquare,
    color: "text-indigo-500",
    bg: "bg-indigo-500/10 dark:bg-indigo-500/15",
    hoverGlow: "group-hover:shadow-indigo-500/20",
  },
  {
    title: "Upload Documents",
    description: "Ingest new knowledge sources",
    href: "/documents",
    icon: FileUp,
    color: "text-cyan-500",
    bg: "bg-cyan-500/10 dark:bg-cyan-500/15",
    hoverGlow: "group-hover:shadow-cyan-500/20",
  },
  {
    title: "Debug Incident",
    description: "AI-powered root cause analysis",
    href: "/chat",
    icon: Bug,
    color: "text-rose-500",
    bg: "bg-rose-500/10 dark:bg-rose-500/15",
    hoverGlow: "group-hover:shadow-rose-500/20",
  },
  {
    title: "Analyze Logs",
    description: "Deep dive into system logs",
    href: "/chat",
    icon: Search,
    color: "text-sky-500",
    bg: "bg-sky-500/10 dark:bg-sky-500/15",
    hoverGlow: "group-hover:shadow-sky-500/20",
  },
  {
    title: "Explain Config",
    description: "Understand configuration files",
    href: "/chat",
    icon: FileCode,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10 dark:bg-emerald-500/15",
    hoverGlow: "group-hover:shadow-emerald-500/20",
  },
  {
    title: "Knowledge Search",
    description: "Semantic search across docs",
    href: "/chat",
    icon: Brain,
    color: "text-purple-500",
    bg: "bg-purple-500/10 dark:bg-purple-500/15",
    hoverGlow: "group-hover:shadow-purple-500/20",
  },
];

interface HealthData {
  status: string;
  postgres: string;
  redis: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [healthLatency, setHealthLatency] = useState<number | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [latencyHistory, setLatencyHistory] = useState<number[]>([]);
  const [errorCount, setErrorCount] = useState(0);
  const [healthCheckCount, setHealthCheckCount] = useState(0);

  const stats = useQuery({
    queryKey: ["rag-stats"],
    queryFn: () => api.get<CollectionStats>("/rag/stats"),
    refetchInterval: 60000,
  });

  const health = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const start = performance.now();
      try {
        const data = await api.get<HealthData>("/health");
        const latency = Math.round(performance.now() - start);
        setHealthLatency(latency);
        setLastChecked(new Date());
        setHealthCheckCount((c) => c + 1);
        setLatencyHistory((prev) => [...prev.slice(-19), latency]);
        return data;
      } catch {
        setErrorCount((c) => c + 1);
        setHealthCheckCount((c) => c + 1);
        throw new Error("Health check failed");
      }
    },
    refetchInterval: 30000,
  });

  const { data: conversations } = useConversations();

  const recentChats = conversations?.slice(0, 5) ?? [];
  const errorRate = healthCheckCount > 0 ? ((errorCount / healthCheckCount) * 100).toFixed(1) : "0.0";
  const uptimePct = healthCheckCount > 0 ? (((healthCheckCount - errorCount) / healthCheckCount) * 100).toFixed(1) : "100.0";

  const docCount = stats.data?.vectors_count
    ? Math.max(1, Math.floor(stats.data.vectors_count / 15))
    : 0;

  const avgLatency = latencyHistory.length > 0
    ? Math.round(latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length)
    : null;

  const daysInMonth = 30;
  const dayOfMonth = new Date().getDate();
  const forecastConversations = conversations?.length
    ? Math.round((conversations.length / dayOfMonth) * daysInMonth)
    : 0;
  const forecastCost = (
    (stats.data?.vectors_count ?? 0) * 0.0001 +
    forecastConversations * 0.003
  ).toFixed(2);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  const allHealthy = health.data?.status === "healthy" &&
    health.data?.postgres === "ok" &&
    health.data?.redis === "ok" &&
    stats.data?.status === "green";

  const healthyServiceCount = [
    health.data?.status === "healthy",
    health.data?.postgres === "ok",
    health.data?.redis === "ok",
    stats.data?.status === "green",
  ].filter(Boolean).length;

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="gradient-primary flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg shadow-indigo-500/20">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {greeting}{user?.full_name ? `, ${user.full_name}` : ""}
              </h1>
              <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                Here&apos;s your infrastructure overview &middot;{" "}
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            {lastChecked && (
              <span className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-zinc-400">
                <RefreshCw className="h-3 w-3" />
                {lastChecked.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs">
              <span className={cn(
                "h-2 w-2 rounded-full",
                allHealthy ? "bg-emerald-500 animate-status-ring" : "bg-zinc-400",
              )} />
              <span className="text-zinc-500">{allHealthy ? "All systems operational" : "Checking..."}</span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Insight Banner */}
      <div className="mb-8 overflow-hidden rounded-2xl border border-indigo-200/50 bg-gradient-to-r from-indigo-50 via-white to-cyan-50 dark:border-indigo-500/10 dark:from-indigo-950/30 dark:via-background dark:to-cyan-950/20">
        <div className="flex items-center gap-4 px-6 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-md shadow-indigo-500/20">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">System Intelligence</p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {allHealthy
                ? `All ${healthyServiceCount} services operational. Avg response time ${avgLatency ?? "—"}ms. ${stats.data?.vectors_count?.toLocaleString() ?? 0} vectors indexed across ~${docCount} documents.`
                : healthyServiceCount > 0
                  ? `${healthyServiceCount}/4 services online. ${4 - healthyServiceCount} service(s) need attention.`
                  : "Initializing health checks across your infrastructure..."}
            </p>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            {avgLatency !== null && avgLatency < 200 && (
              <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400">
                <Zap className="h-3 w-3" />
                Fast
              </span>
            )}
            <span className="flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-600 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-400">
              <Globe className="h-3 w-3" />
              {uptimePct}% uptime
            </span>
          </div>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={<Activity className="h-4 w-4" />}
          iconBg="bg-emerald-500/10 dark:bg-emerald-500/15"
          iconColor="text-emerald-500"
          label="System Status"
          value={
            <div className="flex items-center gap-2.5">
              <span className={cn(
                "h-2.5 w-2.5 rounded-full",
                allHealthy ? "bg-emerald-500 animate-status-ring" : "bg-zinc-400",
              )} />
              <span className="text-lg font-bold">
                {allHealthy ? "Healthy" : "Degraded"}
              </span>
            </div>
          }
          detail={
            <div className="mt-3 flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-zinc-400">
                <Timer className="h-3 w-3" />
                {healthLatency !== null ? `${healthLatency}ms` : "—"}
              </span>
              <span className="text-zinc-200 dark:text-zinc-800">|</span>
              <span className="text-zinc-400">{healthyServiceCount}/4 services</span>
            </div>
          }
          sparkline={latencyHistory}
          sparklineColor={avgLatency && avgLatency < 200 ? "#10b981" : "#f59e0b"}
          priority
        />
        <MetricCard
          icon={<Database className="h-4 w-4" />}
          iconBg="bg-sky-500/10 dark:bg-sky-500/15"
          iconColor="text-sky-500"
          label="Knowledge Base"
          value={
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tabular-nums tracking-tight">
                {stats.data?.vectors_count?.toLocaleString() ?? "0"}
              </span>
              <span className="text-xs text-zinc-400">vectors</span>
            </div>
          }
          detail={
            <div className="mt-3 flex items-center gap-3 text-[11px]">
              <span className="text-zinc-400">~{docCount} documents</span>
              <span className="text-zinc-200 dark:text-zinc-800">|</span>
              <span className="text-zinc-400">{stats.data?.collection ?? "—"}</span>
            </div>
          }
        />
        <MetricCard
          icon={<MessageSquare className="h-4 w-4" />}
          iconBg="bg-indigo-500/10 dark:bg-indigo-500/15"
          iconColor="text-indigo-500"
          label="Conversations"
          value={
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tabular-nums tracking-tight">
                {conversations?.length ?? 0}
              </span>
              <span className="text-xs text-zinc-400">total</span>
            </div>
          }
          detail={
            <div className="mt-3 flex items-center gap-2 text-[11px]">
              <span className="flex items-center gap-1 text-emerald-500">
                <ArrowUpRight className="h-3 w-3" />
                ~{forecastConversations}/mo forecast
              </span>
            </div>
          }
        />
        <MetricCard
          icon={<Gauge className="h-4 w-4" />}
          iconBg="bg-amber-500/10 dark:bg-amber-500/15"
          iconColor="text-amber-500"
          label="Avg Latency"
          value={
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold tabular-nums tracking-tight">
                {avgLatency ?? "—"}
              </span>
              {avgLatency !== null && <span className="text-xs text-zinc-400">ms</span>}
            </div>
          }
          detail={
            <div className="mt-3 flex items-center gap-3 text-[11px]">
              <span className="text-zinc-400">{errorRate}% error rate</span>
              <span className="text-zinc-200 dark:text-zinc-800">|</span>
              <span className="text-zinc-400">{healthCheckCount} checks</span>
            </div>
          }
          sparkline={latencyHistory}
          sparklineColor="#f59e0b"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-8">
          {/* Quick Actions */}
          <section>
            <SectionHeader icon={<Zap className="h-3.5 w-3.5" />} title="Quick Actions" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {quickActions.map((action) => (
                <Link key={action.title} href={action.href}>
                  <Card className={cn(
                    "glow-hover group cursor-pointer border border-transparent bg-surface transition-all duration-250 hover:border-border hover:shadow-xl",
                    action.hoverGlow,
                  )}>
                    <CardContent className="p-4">
                      <div className={cn(
                        "mb-3 flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110",
                        action.bg,
                      )}>
                        <action.icon className={cn("h-5 w-5", action.color)} />
                      </div>
                      <p className="text-sm font-semibold">{action.title}</p>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {action.description}
                      </p>
                      <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-accent opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100">
                        Open <ArrowRight className="h-3 w-3" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>

          {/* System Health */}
          <section>
            <SectionHeader icon={<Shield className="h-3.5 w-3.5" />} title="System Health" />
            <Card className="overflow-hidden border">
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  <HealthRow
                    icon={<Server className="h-4 w-4" />}
                    label="API Server"
                    status={health.data?.status === "healthy"}
                    latency={healthLatency}
                    detail="FastAPI Backend"
                    sparkline={latencyHistory}
                  />
                  <HealthRow
                    icon={<HardDrive className="h-4 w-4" />}
                    label="PostgreSQL"
                    status={health.data?.postgres === "ok"}
                    detail="Primary Database"
                  />
                  <HealthRow
                    icon={<Wifi className="h-4 w-4" />}
                    label="Redis"
                    status={health.data?.redis === "ok"}
                    detail="Cache & Rate Limiting"
                  />
                  <HealthRow
                    icon={<Database className="h-4 w-4" />}
                    label="Qdrant"
                    status={stats.data?.status === "green"}
                    detail={
                      stats.data
                        ? `${stats.data.vectors_count.toLocaleString()} vectors`
                        : "Vector Database"
                    }
                  />
                </div>
                {/* Summary Footer */}
                <div className="flex items-center justify-between border-t border-border bg-surface/80 px-5 py-3">
                  <div className="flex items-center gap-4 text-[11px]">
                    <span className="flex items-center gap-1.5 text-emerald-500">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {uptimePct}% uptime
                    </span>
                    <span className="flex items-center gap-1.5 text-zinc-400">
                      <Timer className="h-3.5 w-3.5" />
                      Avg {avgLatency ?? "—"}ms
                    </span>
                    <span className="flex items-center gap-1.5 text-zinc-400">
                      {Number(errorRate) > 0 ? (
                        <XCircle className="h-3.5 w-3.5 text-red-400" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      )}
                      {errorRate}% errors
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400">
                    {lastChecked
                      ? `Last checked ${lastChecked.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                      : "Waiting..."}
                  </span>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-6 lg:col-span-4">
          {/* Infrastructure */}
          <section>
            <SectionHeader icon={<Cpu className="h-3.5 w-3.5" />} title="Infrastructure" />
            <Card className="border">
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-3">
                  <ServiceCard
                    label="API"
                    ok={health.data?.status === "healthy"}
                    detail="FastAPI"
                    latency={healthLatency}
                  />
                  <ServiceCard
                    label="PostgreSQL"
                    ok={health.data?.postgres === "ok"}
                    detail="Database"
                  />
                  <ServiceCard
                    label="Redis"
                    ok={health.data?.redis === "ok"}
                    detail="Cache"
                  />
                  <ServiceCard
                    label="Qdrant"
                    ok={stats.data?.status === "green"}
                    detail={stats.data ? `${stats.data.vectors_count.toLocaleString()} vec` : "Vectors"}
                  />
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Recent Activity */}
          <section>
            <SectionHeader icon={<Clock className="h-3.5 w-3.5" />} title="Recent Activity" />
            <Card className="border">
              <CardContent className="p-0">
                {recentChats.length > 0 ? (
                  <div className="divide-y divide-border">
                    {recentChats.map((conv, i) => (
                      <Link
                        key={conv.id}
                        href={`/chat?c=${conv.id}`}
                        className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover"
                      >
                        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-muted">
                          <MessageSquare className="h-3.5 w-3.5 text-accent" />
                          {i === 0 && (
                            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-background bg-cyan-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium leading-tight">
                            {conv.title}
                          </p>
                          <p className="mt-0.5 text-[11px] text-zinc-400">
                            {timeAgo(conv.updated_at)}
                          </p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-accent dark:text-zinc-700" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-10 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface">
                      <BarChart3 className="h-5 w-5 text-zinc-400" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-zinc-500">No activity yet</p>
                    <p className="mt-1 text-xs text-zinc-400">Start a chat to see activity here.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Usage & Forecast */}
          <section>
            <SectionHeader icon={<TrendingUp className="h-3.5 w-3.5" />} title="Usage & Forecast" />
            <Card className="border">
              <CardContent className="space-y-4 p-5">
                <UsageRow
                  icon={<HardDrive className="h-3.5 w-3.5 text-sky-500" />}
                  label="Vector Storage"
                  value={stats.data?.vectors_count ?? 0}
                  max={10000}
                  unit="vectors"
                  estimate={`~$${((stats.data?.vectors_count ?? 0) * 0.0001).toFixed(2)}/mo`}
                />
                <UsageRow
                  icon={<MessageSquare className="h-3.5 w-3.5 text-indigo-500" />}
                  label="Conversations"
                  value={conversations?.length ?? 0}
                  max={1000}
                  unit="chats"
                />
                <UsageRow
                  icon={<Brain className="h-3.5 w-3.5 text-purple-500" />}
                  label="LLM Queries"
                  value={conversations?.length ?? 0}
                  max={500}
                  unit="queries"
                  estimate={`~$${((conversations?.length ?? 0) * 0.003).toFixed(2)}/mo`}
                />

                {/* Forecast Card */}
                <div className="relative overflow-hidden rounded-xl border border-indigo-200/50 bg-gradient-to-br from-indigo-50/80 via-white to-cyan-50/80 p-4 dark:border-indigo-500/10 dark:from-indigo-950/40 dark:via-background dark:to-cyan-950/30">
                  <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-gradient-to-br from-indigo-400/10 to-cyan-400/10 blur-2xl" />
                  <div className="relative">
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                      Monthly Forecast
                    </div>
                    <p className="mt-2 text-3xl font-bold tracking-tight">
                      <span className="gradient-text">${forecastCost}</span>
                    </p>
                    <p className="mt-1.5 text-[11px] text-zinc-400">
                      Based on ~{forecastConversations} projected conversations
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                        {stats.data?.vectors_count?.toLocaleString() ?? 0} vectors
                      </span>
                      <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-medium text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-400">
                        {conversations?.length ?? 0} queries
                      </span>
                    </div>
                  </div>
                </div>

                {/* Usage Alerts */}
                <UsageAlerts
                  vectorPct={((stats.data?.vectors_count ?? 0) / 10000) * 100}
                  queryPct={((conversations?.length ?? 0) / 500) * 100}
                />
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ---- Sub-components ---- */

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
      {icon}
      {title}
    </h2>
  );
}

function Sparkline({
  data,
  width = 80,
  height = 28,
  color = "#6366F1",
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - padding * 2) + padding;
    const y = height - padding - ((v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`sparkGrad-${color.replace('#', '')}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points.join(" ")}
        className="sparkline-path"
      />
      <polygon
        fill={`url(#sparkGrad-${color.replace('#', '')})`}
        points={`${padding},${height - padding} ${points.join(" ")} ${width - padding},${height - padding}`}
        opacity="0.5"
      />
    </svg>
  );
}

function MetricCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  detail,
  sparkline,
  sparklineColor,
  priority,
}: {
  icon: React.ReactNode;
  iconBg?: string;
  iconColor: string;
  label: string;
  value: React.ReactNode;
  detail: React.ReactNode;
  sparkline?: number[];
  sparklineColor?: string;
  priority?: boolean;
}) {
  return (
    <Card className={cn(
      "card-hover overflow-hidden border transition-shadow",
      priority && "ring-1 ring-emerald-500/20 dark:ring-emerald-500/10",
    )}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
            <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", iconBg)}>
              <span className={iconColor}>{icon}</span>
            </span>
            {label}
          </div>
          {sparkline && sparkline.length >= 2 && (
            <Sparkline data={sparkline} color={sparklineColor} />
          )}
        </div>
        <div className="mt-3">{value}</div>
        {detail}
      </CardContent>
    </Card>
  );
}

function ServiceCard({ label, ok, detail, latency }: { label: string; ok?: boolean; detail: string; latency?: number | null }) {
  return (
    <div className={cn(
      "rounded-xl border p-3 transition-all duration-200",
      ok
        ? "border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20"
        : ok === false
          ? "border-red-200/60 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/20"
          : "border-border bg-surface",
    )}>
      <div className="flex items-center gap-2">
        <span className={cn(
          "h-2 w-2 rounded-full",
          ok ? "bg-emerald-500 animate-status-ring" : ok === false ? "bg-red-400 animate-pulse" : "bg-zinc-300 dark:bg-zinc-600",
        )} />
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <p className="text-[10px] text-zinc-400">{detail}</p>
        {latency !== undefined && latency !== null && (
          <span className={cn(
            "text-[10px] font-semibold tabular-nums",
            latency < 200 ? "text-emerald-500" : "text-amber-500",
          )}>
            {latency}ms
          </span>
        )}
      </div>
    </div>
  );
}

function HealthRow({
  icon,
  label,
  status,
  latency,
  detail,
  sparkline,
}: {
  icon: React.ReactNode;
  label: string;
  status?: boolean;
  latency?: number | null;
  detail: string;
  sparkline?: number[];
}) {
  return (
    <div className="flex items-center gap-3.5 px-5 py-4 transition-colors hover:bg-surface-hover/50">
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
          status
            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
            : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800",
        )}
      >
        {icon}
      </span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          <Badge
            variant={status ? "success" : status === false ? "destructive" : "secondary"}
            className="text-[10px]"
          >
            {status ? "Healthy" : status === false ? "Down" : "..."}
          </Badge>
        </div>
        <p className="text-[11px] text-zinc-400">{detail}</p>
      </div>
      <div className="flex items-center gap-3">
        {sparkline && sparkline.length >= 2 && (
          <Sparkline data={sparkline} width={60} height={24} color={latency && latency < 200 ? "#10b981" : "#f59e0b"} />
        )}
        {latency !== undefined && latency !== null && (
          <p className={cn(
            "text-sm font-semibold tabular-nums",
            latency < 200
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-amber-600 dark:text-amber-400",
          )}>
            {latency}ms
          </p>
        )}
      </div>
    </div>
  );
}

function UsageRow({
  icon,
  label,
  value,
  max,
  unit,
  estimate,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  max: number;
  unit: string;
  estimate?: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  const pctColor =
    pct > 80
      ? "from-red-500 to-rose-500"
      : pct > 50
        ? "from-amber-500 to-orange-500"
        : "from-indigo-500 to-cyan-500";

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs tabular-nums text-zinc-500">
            {value.toLocaleString()} / {max.toLocaleString()} {unit}
          </span>
          <span
            className={cn(
              "rounded px-1 py-0.5 text-[10px] font-semibold tabular-nums",
              pct > 80
                ? "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400"
                : pct > 50
                  ? "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400"
                  : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400",
            )}
          >
            {pct.toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out", pctColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {estimate && (
        <p className="mt-1 text-right text-[10px] text-zinc-400">{estimate}</p>
      )}
    </div>
  );
}

function UsageAlerts({ vectorPct, queryPct }: { vectorPct: number; queryPct: number }) {
  const alerts: { message: string; severity: "warn" | "info" }[] = [];

  if (vectorPct > 80) {
    alerts.push({ message: "Vector storage approaching limit (>80%)", severity: "warn" });
  }
  if (queryPct > 80) {
    alerts.push({ message: "LLM query usage approaching limit (>80%)", severity: "warn" });
  }
  if (vectorPct > 50 && vectorPct <= 80) {
    alerts.push({ message: "Vector storage at moderate usage", severity: "info" });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Alerts</p>
      {alerts.map((alert, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
            alert.severity === "warn"
              ? "border-amber-200 bg-amber-50/50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-400"
              : "border-blue-200 bg-blue-50/50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-400",
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {alert.message}
        </div>
      ))}
    </div>
  );
}
