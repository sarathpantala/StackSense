"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  MessageSquare,
  Zap,
  Search,
  FileText,
  Bot,
  Lock,
  Mail,
  BarChart3,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: MessageSquare,
    title: "Chat with your documents",
    description: "Have natural conversations with your uploaded files",
  },
  {
    icon: Zap,
    title: "Instant AI-powered answers",
    description: "Get accurate responses in seconds, not minutes",
  },
  {
    icon: Search,
    title: "Smart search across knowledge",
    description: "Find exactly what you need from any document",
  },
];

const showcaseCards = [
  {
    type: "question" as const,
    label: "You",
    icon: MessageSquare,
    content: "What are the key findings from the Q4 report?",
  },
  {
    type: "answer" as const,
    label: "StackSense AI",
    icon: Bot,
    content:
      "Based on your documents, Q4 showed a 23% revenue increase, with the enterprise segment growing fastest at 31% YoY.",
  },
  {
    type: "insight" as const,
    label: "AI Insight",
    icon: TrendingUp,
    content: "3 related documents found with 94% confidence",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.15 + i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const cardFloat = (i: number) => ({
  y: [0, -8, 0],
  transition: {
    duration: 5 + i * 0.8,
    repeat: Infinity,
    ease: "easeInOut" as const,
    delay: i * 0.6,
  },
});

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login({ email, password });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-white dark:bg-zinc-950">
      {/* Left — Product Showcase (60%) */}
      <div className="relative hidden w-[60%] overflow-hidden lg:block">
        {/* Dark base background */}
        <div className="absolute inset-0 bg-[#0c0a1a]" />

        {/* Subtle gradient glows — low intensity, no blur overlap on text */}
        <div className="absolute -left-32 top-0 h-[500px] w-[500px] rounded-full bg-violet-600/[0.08] blur-[120px]" />
        <div className="absolute -bottom-20 right-0 h-[400px] w-[400px] rounded-full bg-indigo-500/[0.06] blur-[100px]" />

        {/* Fine grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Internal two-column split: text (left) + visuals (right) */}
        <div className="relative z-10 flex h-full">
          {/* Text content — stays clean, no overlap */}
          <div className="flex w-[55%] flex-col justify-center px-12 xl:px-16">
            <motion.div initial="hidden" animate="visible">
              {/* Branding */}
              <motion.div custom={0} variants={fadeUp} className="mb-8 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.06]">
                  <Sparkles className="h-5 w-5 text-violet-300" />
                </div>
                <span className="text-base font-bold text-white">StackSense</span>
              </motion.div>

              {/* Headline */}
              <motion.h1
                custom={1}
                variants={fadeUp}
                className="text-[2.5rem] font-bold leading-[1.1] tracking-tight text-white xl:text-5xl"
              >
                Turn your data
                <br />
                into{" "}
                <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                  answers
                </span>
              </motion.h1>

              {/* Sub-text */}
              <motion.p
                custom={2}
                variants={fadeUp}
                className="mt-5 max-w-sm text-[15px] leading-relaxed text-zinc-400"
              >
                Upload documents, ask questions, and get accurate answers powered by AI.
              </motion.p>

              {/* Feature Bullets */}
              <div className="mt-10 space-y-5">
                {features.map((feature, i) => (
                  <motion.div
                    key={feature.title}
                    custom={i + 3}
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    className="flex items-start gap-3.5"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.04]">
                      <feature.icon className="h-4 w-4 text-violet-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{feature.title}</p>
                      <p className="mt-0.5 text-[13px] text-zinc-500">{feature.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Social Proof */}
              <motion.div
                custom={7}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="mt-12 flex items-center gap-3"
              >
                <div className="flex -space-x-1.5">
                  {[
                    "bg-gradient-to-br from-rose-400 to-pink-500",
                    "bg-gradient-to-br from-amber-400 to-orange-500",
                    "bg-gradient-to-br from-emerald-400 to-teal-500",
                    "bg-gradient-to-br from-sky-400 to-blue-500",
                  ].map((bg, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#0c0a1a] text-[9px] font-bold text-white",
                        bg,
                      )}
                    >
                      {["A", "M", "S", "J"][i]}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-zinc-500">
                  <span className="font-semibold text-zinc-300">2,400+</span> teams trust StackSense
                </p>
              </motion.div>
            </motion.div>
          </div>

          {/* Animated visuals — right side of left panel, isolated from text */}
          <div className="relative flex w-[45%] items-center justify-center">
            {/* Glow behind cards */}
            <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/[0.07] blur-[80px]" />

            <div className="relative w-full max-w-[280px] space-y-4 py-8">
              {showcaseCards.map((card, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: 0.8 + i * 0.25,
                    duration: 0.6,
                    ease: [0.22, 1, 0.36, 1] as const,
                  }}
                >
                  <motion.div
                    animate={cardFloat(i)}
                    className={cn(
                      "rounded-2xl border px-4 py-3.5",
                      card.type === "answer"
                        ? "border-violet-500/[0.12] bg-violet-500/[0.06]"
                        : card.type === "insight"
                          ? "border-emerald-500/[0.12] bg-emerald-500/[0.04]"
                          : "border-white/[0.07] bg-white/[0.03]",
                    )}
                  >
                    <div className="mb-2 flex items-center gap-1.5">
                      <card.icon
                        className={cn(
                          "h-3 w-3",
                          card.type === "answer"
                            ? "text-violet-400"
                            : card.type === "insight"
                              ? "text-emerald-400"
                              : "text-zinc-500",
                        )}
                      />
                      <span
                        className={cn(
                          "text-[10px] font-medium",
                          card.type === "answer"
                            ? "text-violet-400/70"
                            : card.type === "insight"
                              ? "text-emerald-400/70"
                              : "text-zinc-600",
                        )}
                      >
                        {card.label}
                      </span>
                      {card.type === "insight" && (
                        <CheckCircle2 className="ml-auto h-3 w-3 text-emerald-500/60" />
                      )}
                    </div>
                    <p
                      className={cn(
                        "text-[13px] leading-relaxed",
                        card.type === "answer"
                          ? "text-zinc-300"
                          : card.type === "insight"
                            ? "text-emerald-300/80"
                            : "text-zinc-400",
                      )}
                    >
                      {card.content}
                    </p>
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right — Login Form (40%) */}
      <div className="flex w-full flex-col items-center justify-center px-6 lg:w-[40%] lg:px-12 xl:px-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="mb-10 flex flex-col items-center gap-3 lg:hidden">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/25">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">StackSense</h1>
          </div>

          {/* Header */}
          <div className="mb-8 lg:mb-10">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Sign in to continue to your workspace
            </p>
          </div>

          {/* Continue with Google */}
          <button
            type="button"
            className="group mb-6 flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 shadow-sm transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-zinc-400 dark:bg-zinc-950">
                or continue with email
              </span>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400"
              >
                {error}
              </motion.div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-12 w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 text-sm outline-none transition-all placeholder:text-zinc-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-violet-400 dark:focus:ring-violet-400/10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </label>
                <button
                  type="button"
                  className="text-xs font-medium text-violet-600 transition-colors hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-12 w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 text-sm outline-none transition-all placeholder:text-zinc-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-violet-400 dark:focus:ring-violet-400/10"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-xl hover:shadow-violet-500/30 hover:brightness-110 disabled:opacity-50 disabled:shadow-none"
            >
              {loading ? <Spinner size={18} /> : "Get Started"}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-semibold text-violet-600 transition-colors hover:text-violet-700 dark:text-violet-400"
            >
              Sign up for free
            </Link>
          </p>

          {/* Terms */}
          <p className="mt-6 text-center text-[11px] leading-relaxed text-zinc-400">
            By continuing, you agree to our{" "}
            <span className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-600 dark:decoration-zinc-700 dark:hover:text-zinc-300">
              Terms of Service
            </span>{" "}
            and{" "}
            <span className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-600 dark:decoration-zinc-700 dark:hover:text-zinc-300">
              Privacy Policy
            </span>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
