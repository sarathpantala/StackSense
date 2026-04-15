"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Send,
  StopCircle,
  Trash2,
  User,
  Sparkles,
  FileText,
  Search,
  HelpCircle,
  Paperclip,
  Command,
  ArrowUp,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Bug,
  BarChart3,
  Zap,
  Clock,
  Hash,
  Cpu,
  Lightbulb,
  AlertTriangle,
  Wrench,
  GitBranch,
  Activity,
  Brain,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import type { ChatMessage, SourceChunk, QueryInsights, StreamEvent } from "@/types";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight, oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useConversation, useCreateConversation, useAddMessage } from "@/hooks/use-conversations";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";

const suggestions = [
  { icon: Search, text: "Summarize the key points from my documents", label: "Summarize" },
  { icon: HelpCircle, text: "What topics are covered in my knowledge base?", label: "Explore" },
  { icon: Bug, text: "/debug Why is my Kubernetes pod in CrashLoopBackOff?", label: "Debug" },
  { icon: Lightbulb, text: "/explain How does circuit breaker pattern work?", label: "Explain" },
];

const commands = [
  { cmd: "/analyze", desc: "Deep structured analysis", icon: BarChart3 },
  { cmd: "/debug", desc: "Debug & troubleshoot", icon: Bug },
  { cmd: "/explain", desc: "Explain a concept clearly", icon: Lightbulb },
  { cmd: "/generate-fix", desc: "Generate a code/config fix", icon: Wrench },
  { cmd: "/search", desc: "Search documents", icon: Search },
  { cmd: "/rca", desc: "Root cause analysis on logs", icon: AlertTriangle },
  { cmd: "/workflow", desc: "Multi-step: analyze → summarize → recommend", icon: GitBranch },
];

function parseCommand(rawQuery: string): { command: string | null; input: string; isRCA: boolean; isWorkflow: boolean } {
  const cmdMatch = rawQuery.match(/^\/(\S+)\s+([\s\S]*)$/);
  if (!cmdMatch) return { command: null, input: rawQuery, isRCA: false, isWorkflow: false };

  const cmd = cmdMatch[1];
  const input = cmdMatch[2].trim();

  if (cmd === "rca") return { command: "rca", input, isRCA: true, isWorkflow: false };
  if (cmd === "workflow") return { command: "workflow", input, isRCA: false, isWorkflow: true };
  if (["debug", "analyze", "explain", "generate-fix", "search"].includes(cmd)) {
    return { command: cmd, input, isRCA: false, isWorkflow: false };
  }

  return { command: null, input: rawQuery, isRCA: false, isWorkflow: false };
}

export default function ChatPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const conversationId = searchParams.get("c");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCommands, setShowCommands] = useState(false);
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [tone, setTone] = useState<"simple" | "technical" | "expert">("technical");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeConversationId = useRef<string | null>(conversationId);
  const isStreamingRef = useRef(false);

  const createConversation = useCreateConversation();
  const addMessage = useAddMessage();
  const { data: conversationData } = useConversation(conversationId);

  // Sync conversation data from DB, but skip while actively streaming
  // to avoid overwriting the live-updating messages
  useEffect(() => {
    activeConversationId.current = conversationId;
    if (isStreamingRef.current) return;
    if (conversationData?.messages) {
      setMessages(
        conversationData.messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.created_at),
        })),
      );
    } else if (!conversationId) {
      setMessages([]);
    }
  }, [conversationId, conversationData]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeStep]);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "0";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }, [input]);

  useEffect(() => {
    setShowCommands(input.startsWith("/") && !input.includes(" "));
  }, [input]);

  const handleSend = useCallback(
    async (overrideQuery?: string) => {
      const rawQuery = (overrideQuery ?? input).trim();
      if (!rawQuery || isStreaming) return;

      setInput("");
      setError(null);
      setShowCommands(false);
      setActiveStep(null);

      const { command, input: cmdInput, isRCA, isWorkflow } = parseCommand(rawQuery);

      let convId = activeConversationId.current;
      if (!convId) {
        try {
          const title = rawQuery.length > 50 ? rawQuery.slice(0, 50) + "..." : rawQuery;
          const conv = await createConversation.mutateAsync(title);
          convId = conv.id;
          activeConversationId.current = convId;
          router.replace(`/chat?c=${convId}`);
        } catch {
          setError("Failed to create conversation");
          return;
        }
      }

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: rawQuery,
        timestamp: new Date(),
        command: command || undefined,
        isRCA,
      };

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        timestamp: new Date(),
        command: command || undefined,
        isRCA,
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsStreaming(true);
      isStreamingRef.current = true;

      addMessage.mutate({ conversationId: convId, role: "user", content: rawQuery });

      try {
        let endpoint = "/rag/query/stream";
        let body: Record<string, unknown> = { question: rawQuery, tone };

        if (isRCA) {
          endpoint = "/rag/rca/stream";
          body = { logs: cmdInput };
        } else if (isWorkflow) {
          endpoint = "/rag/workflow/stream";
          body = { question: cmdInput, steps: ["analyze", "summarize", "recommend"] };
        } else if (command) {
          endpoint = "/rag/command/stream";
          body = { command, input: cmdInput };
        }

        const stream = api.streamEvents(endpoint, body);
        let fullContent = "";
        let sources: SourceChunk[] = [];
        let insights: QueryInsights | undefined;

        for await (const event of stream) {
          switch (event.type) {
            case "sources":
              sources = event.sources;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessage.id ? { ...m, sources } : m,
                ),
              );
              break;
            case "token":
              fullContent += event.token;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessage.id
                    ? { ...m, content: fullContent, workflowStep: event.step }
                    : m,
                ),
              );
              break;
            case "step_start":
              setActiveStep(event.step);
              fullContent += `\n\n### ${stepLabel(event.step)} (${event.step_index + 1}/${event.total_steps})\n\n`;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessage.id ? { ...m, content: fullContent } : m,
                ),
              );
              break;
            case "step_end":
              setActiveStep(null);
              break;
            case "insights":
              insights = {
                latency_ms: event.latency_ms,
                retrieval_count: event.retrieval_count,
                retrieval_ms: event.retrieval_ms,
                generation_ms: event.generation_ms,
                prompt_tokens: event.prompt_tokens,
                completion_tokens: event.completion_tokens,
                total_tokens: event.total_tokens,
                model: event.model,
                workflow_steps: event.workflow_steps,
              };
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessage.id ? { ...m, insights } : m,
                ),
              );
              break;
            case "done":
              break;
          }
        }

        if (fullContent && convId) {
          addMessage.mutate({
            conversationId: convId,
            role: "assistant",
            content: fullContent,
          });
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
        }
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.detail);
        } else {
          setError("Failed to get response. Please try again.");
        }
        setMessages((prev) =>
          prev.filter((m) => !(m.id === assistantMessage.id && m.content === "")),
        );
      } finally {
        setIsStreaming(false);
        isStreamingRef.current = false;
        setActiveStep(null);
      }
    },
    [input, isStreaming, createConversation, addMessage, router, queryClient],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await api.uploadFile("/rag/ingest/file", file);
      setInput(`I just uploaded "${file.name}". Can you summarize its contents?`);
    } catch {
      setError("File upload failed. Please try again.");
    }
    e.target.value = "";
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
    activeConversationId.current = null;
    router.push("/chat");
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      {hasMessages && (
        <div className="flex items-center justify-between border-b border-border px-6 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 shadow-md shadow-violet-500/20">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">StackSense AI</h1>
              <p className="text-[11px] text-zinc-400">
                {isStreaming
                  ? activeStep
                    ? `Running: ${stepLabel(activeStep)}`
                    : "Generating..."
                  : "Ready"}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearChat}
            className="text-zinc-400 hover:text-red-500"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      )}

      {/* Messages / Empty State */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          <div className="flex h-full flex-col items-center justify-center px-4">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-2xl shadow-violet-500/30">
                <Sparkles className="h-9 w-9 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-emerald-500 shadow-sm">
                <Check className="h-3 w-3 text-white" />
              </div>
            </div>
            <h2 className="mt-8 text-2xl font-bold tracking-tight">
              What can I help you with?
            </h2>
            <p className="mt-2 max-w-md text-center text-sm text-zinc-500 dark:text-zinc-400">
              Your intelligent DevOps assistant. Ask questions, debug issues, analyze logs, or explore your knowledge base.
              Use{" "}
              <span className="rounded bg-accent-muted px-1.5 py-0.5 font-mono text-xs text-accent">
                /commands
              </span>{" "}
              for specialized actions.
            </p>
            <div className="mt-10 grid w-full max-w-2xl grid-cols-2 gap-3">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(s.text)}
                  className="group flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 text-left transition-all duration-200 hover:border-accent/30 hover:bg-accent-muted hover:shadow-md"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-muted text-accent transition-colors group-hover:bg-accent group-hover:text-white">
                    <s.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{s.label}</p>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{s.text}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl px-4 py-6">
            {messages.map((message, idx) => (
              <MessageBubble
                key={message.id}
                message={message}
                isLast={idx === messages.length - 1}
                isStreaming={isStreaming && idx === messages.length - 1 && message.role === "assistant"}
                theme={resolvedTheme}
              />
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-auto w-full max-w-3xl px-4">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
            {error}
          </div>
        </div>
      )}

      {/* Command palette */}
      {showCommands && (
        <div className="mx-auto w-full max-w-3xl px-4">
          <div className="rounded-xl border border-border bg-surface p-1 shadow-lg">
            {commands
              .filter((c) => c.cmd.startsWith(input))
              .map((c) => (
                <button
                  key={c.cmd}
                  onClick={() => setInput(c.cmd + " ")}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-surface-hover"
                >
                  <c.icon className="h-4 w-4 text-accent" />
                  <div>
                    <span className="font-medium font-mono text-xs">{c.cmd}</span>
                    <span className="ml-2 text-zinc-400">{c.desc}</span>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className={cn("px-4 pb-6", hasMessages ? "pt-3" : "pt-0")}>
        <div className="mx-auto max-w-3xl">
          <div className="group relative rounded-2xl border border-border bg-surface shadow-sm transition-all duration-200 focus-within:border-accent/50 focus-within:shadow-lg focus-within:shadow-accent-glow">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything... (type / for commands)"
              className="max-h-[200px] min-h-[52px] w-full resize-none bg-transparent px-4 pt-3.5 pb-12 text-sm outline-none placeholder:text-zinc-400"
              rows={1}
              disabled={isStreaming}
            />
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md,.csv,.json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-surface-hover hover:text-foreground"
                  title="Upload file"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setInput("/");
                    textareaRef.current?.focus();
                  }}
                  className="flex h-8 items-center gap-1 rounded-lg px-2 text-zinc-400 transition-colors hover:bg-surface-hover hover:text-foreground"
                  title="Commands"
                >
                  <Command className="h-3.5 w-3.5" />
                  <span className="text-[11px]">Commands</span>
                </button>
                <div className="flex h-8 items-center rounded-lg border border-border bg-surface-hover/50 p-0.5">
                  {(["simple", "technical", "expert"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTone(t)}
                      className={cn(
                        "rounded-md px-2 py-1 text-[10px] font-medium capitalize transition-all",
                        tone === t
                          ? "bg-accent text-white shadow-sm"
                          : "text-zinc-400 hover:text-foreground",
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <Button
                onClick={() => handleSend()}
                disabled={!input.trim() || isStreaming}
                size="icon"
                className="h-8 w-8 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/25 transition-all hover:shadow-lg hover:shadow-violet-500/30 hover:brightness-110 disabled:opacity-30 disabled:shadow-none"
              >
                {isStreaming ? (
                  <StopCircle className="h-4 w-4" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-zinc-400">
            StackSense may produce inaccurate information. Verify important facts.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Helper Components ─── */

function stepLabel(step: string): string {
  const labels: Record<string, string> = {
    analyze: "🔍 Analyzing",
    summarize: "📋 Summarizing",
    recommend: "💡 Recommending",
    analyzing: "🔬 Root Cause Analysis",
  };
  return labels[step] || step;
}

function MessageBubble({
  message,
  isLast,
  isStreaming,
  theme,
}: {
  message: ChatMessage;
  isLast: boolean;
  isStreaming: boolean;
  theme?: string;
}) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3 py-5", !isUser && "group")}>
      <Avatar className="mt-0.5 h-8 w-8 shrink-0 shadow-sm">
        <AvatarFallback
          className={cn(
            "text-xs",
            isUser
              ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              : "bg-gradient-to-br from-violet-500 to-indigo-500 text-white",
          )}
        >
          {isUser ? <User className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2">
          <p className="text-xs font-semibold">{isUser ? "You" : "StackSense AI"}</p>
          <span className="text-[10px] text-zinc-400">
            {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          {message.command && (
            <span className="rounded-full bg-accent-muted px-2 py-0.5 text-[10px] font-medium text-accent">
              /{message.command}
            </span>
          )}
          {message.isRCA && !message.command && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
              <AlertTriangle className="mr-0.5 inline h-2.5 w-2.5" />
              RCA
            </span>
          )}
          {!isUser && isStreaming && (
            <span className="flex items-center gap-1.5 rounded-full bg-accent-muted px-2 py-0.5 text-[10px] font-medium text-accent">
              <span className="typing-dot inline-block h-1 w-1 rounded-full bg-accent" />
              <span className="typing-dot inline-block h-1 w-1 rounded-full bg-accent" />
              <span className="typing-dot inline-block h-1 w-1 rounded-full bg-accent" />
              Streaming
            </span>
          )}
        </div>

        {isUser ? (
          <div className="inline-block rounded-2xl rounded-tl-sm bg-accent/10 px-4 py-2.5 text-sm">
            {message.content}
          </div>
        ) : (
          <div className="prose prose-sm prose-zinc max-w-none dark:prose-invert prose-p:leading-relaxed prose-pre:my-3 prose-pre:p-0 prose-pre:bg-transparent prose-pre:border-0">
            {message.content ? (
              <ReactMarkdown
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    const codeString = String(children).replace(/\n$/, "");
                    if (match) {
                      return <CodeBlock code={codeString} language={match[1]} theme={theme} />;
                    }
                    return (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            ) : (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <div className="flex gap-1">
                  <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                  <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                  <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                </div>
                {message.isRCA ? "Running root cause analysis..." : "Thinking..."}
              </div>
            )}
          </div>
        )}

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <SourcesSection sources={message.sources} />
        )}

        {/* Query Insights */}
        {!isUser && message.insights && !isStreaming && (
          <InsightsPanel insights={message.insights} />
        )}

        {/* Message actions */}
        {!isUser && message.content && !isStreaming && (
          <MessageActions content={message.content} />
        )}
      </div>
    </div>
  );
}

function InsightsPanel({ insights }: { insights: QueryInsights }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 transition-colors hover:text-foreground"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <Activity className="h-3.5 w-3.5" />
        Query Insights
      </button>
      {expanded && (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <InsightChip
            icon={<Clock className="h-3 w-3" />}
            label="Latency"
            value={`${insights.latency_ms}ms`}
            color="text-blue-600 dark:text-blue-400"
          />
          <InsightChip
            icon={<Hash className="h-3 w-3" />}
            label="Sources"
            value={String(insights.retrieval_count)}
            color="text-violet-600 dark:text-violet-400"
          />
          <InsightChip
            icon={<Zap className="h-3 w-3" />}
            label="Tokens"
            value={String(insights.total_tokens)}
            color="text-amber-600 dark:text-amber-400"
          />
          <InsightChip
            icon={<Cpu className="h-3 w-3" />}
            label="Model"
            value={insights.model.replace("llama", "L").replace("-", "").slice(0, 12)}
            color="text-emerald-600 dark:text-emerald-400"
          />
          {insights.retrieval_ms !== undefined && (
            <InsightChip
              icon={<Search className="h-3 w-3" />}
              label="Retrieval"
              value={`${insights.retrieval_ms}ms`}
              color="text-cyan-600 dark:text-cyan-400"
            />
          )}
          {insights.generation_ms !== undefined && (
            <InsightChip
              icon={<Brain className="h-3 w-3" />}
              label="Generation"
              value={`${insights.generation_ms}ms`}
              color="text-pink-600 dark:text-pink-400"
            />
          )}
          {insights.prompt_tokens > 0 && (
            <InsightChip
              icon={<ArrowUp className="h-3 w-3" />}
              label="Prompt"
              value={`${insights.prompt_tokens} tok`}
              color="text-orange-600 dark:text-orange-400"
            />
          )}
          {insights.completion_tokens > 0 && (
            <InsightChip
              icon={<ArrowUp className="h-3 w-3 rotate-180" />}
              label="Completion"
              value={`${insights.completion_tokens} tok`}
              color="text-teal-600 dark:text-teal-400"
            />
          )}
          {insights.workflow_steps && (
            <div className="col-span-full">
              <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                <GitBranch className="h-3 w-3" />
                Workflow: {insights.workflow_steps.join(" → ")}
              </div>
            </div>
          )}
        </div>
      )}
      {!expanded && (
        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-zinc-400">
          <span>{insights.latency_ms}ms</span>
          <span>·</span>
          <span>{insights.retrieval_count} sources</span>
          <span>·</span>
          <span>{insights.total_tokens} tokens</span>
        </div>
      )}
    </div>
  );
}

function InsightChip({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5">
      <span className={color}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[9px] uppercase tracking-wider text-zinc-400">{label}</p>
        <p className="truncate text-[11px] font-semibold">{value}</p>
      </div>
    </div>
  );
}

function CodeBlock({ code, language, theme }: { code: string; language: string; theme?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group/code relative my-3 overflow-hidden rounded-xl border border-border">
      <div className="flex items-center justify-between bg-surface px-4 py-2">
        <span className="text-[11px] font-medium text-zinc-500">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-500" />
              <span className="text-emerald-500">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy
            </>
          )}
        </button>
      </div>
      <SyntaxHighlighter
        style={theme === "dark" ? oneDark : oneLight}
        language={language}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: 0,
          padding: "1rem",
          fontSize: "0.8125rem",
          background: "transparent",
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

function SourcesSection({ sources }: { sources: SourceChunk[] }) {
  const [expanded, setExpanded] = useState(false);

  const isUrl = (s: string) => /^https?:\/\//.test(s);
  const displayUrl = (s: string) => {
    try {
      const u = new URL(s);
      return u.hostname + (u.pathname.length > 30 ? u.pathname.slice(0, 30) + "…" : u.pathname);
    } catch {
      return s;
    }
  };

  return (
    <div className="mt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 transition-colors hover:text-foreground"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <FileText className="h-3.5 w-3.5" />
        {sources.length} Source{sources.length !== 1 && "s"} Referenced
      </button>
      {expanded && (
        <div className="mt-2 space-y-2">
          {sources.map((source, i) => {
            const src = typeof source.metadata?.source === "string" ? source.metadata.source : "";
            const title = typeof source.metadata?.title === "string" ? source.metadata.title : "";
            const isWeb = source.metadata?.source_type === "web";
            const linkable = isUrl(src);

            return (
              <div
                key={i}
                className="rounded-xl border border-border bg-surface p-3 transition-colors hover:bg-surface-hover"
              >
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold",
                      isWeb
                        ? "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400"
                        : "bg-accent-muted text-accent",
                    )}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    {title && <p className="mb-1 text-xs font-medium text-foreground">{title}</p>}
                    <p className="line-clamp-3 text-xs text-zinc-600 dark:text-zinc-400">{source.text}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <ConfidenceBadge score={source.score} />
                      {isWeb && (
                        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                          Web
                        </span>
                      )}
                      {src &&
                        (linkable ? (
                          <a
                            href={src}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10px] text-accent hover:underline"
                          >
                            <ExternalLink className="h-2.5 w-2.5" />
                            {displayUrl(src)}
                          </a>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] text-zinc-400">
                            <FileText className="h-2.5 w-2.5" />
                            {src}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!expanded && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {sources.map((source, i) => {
            const src = typeof source.metadata?.source === "string" ? source.metadata.source : "";
            const isWeb = source.metadata?.source_type === "web";
            const linkable = isUrl(src);
            const label = typeof source.metadata?.title === "string" && source.metadata.title
              ? source.metadata.title
              : source.text;

            const inner = (
              <>
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold",
                    isWeb
                      ? "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400"
                      : "bg-accent-muted text-accent",
                  )}
                >
                  {i + 1}
                </span>
                <span className="max-w-[180px] truncate text-zinc-500">{label}</span>
                <ConfidenceBadge score={source.score} compact />
                {isWeb && <ExternalLink className="h-2.5 w-2.5 text-blue-500" />}
              </>
            );

            return linkable ? (
              <a
                key={i}
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] transition-colors hover:border-accent/30 hover:bg-surface-hover"
              >
                {inner}
              </a>
            ) : (
              <div
                key={i}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-[11px] transition-colors hover:bg-surface-hover"
              >
                {inner}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ConfidenceBadge({ score, compact }: { score: number; compact?: boolean }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 80
      ? "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/50"
      : pct >= 50
        ? "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/50"
        : "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/50";

  if (compact) {
    return (
      <span className={cn("rounded px-1 py-0.5 text-[9px] font-semibold", color)}>
        {pct}%
      </span>
    );
  }

  return (
    <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-semibold", color)}>
      {pct}% confidence
    </span>
  );
}

function MessageActions({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
      <button
        onClick={handleCopy}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:bg-surface-hover hover:text-foreground"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
