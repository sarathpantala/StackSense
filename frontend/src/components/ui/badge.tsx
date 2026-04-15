import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "success" | "destructive";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
        {
          "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900": variant === "default",
          "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100": variant === "secondary",
          "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400": variant === "success",
          "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400": variant === "destructive",
        },
        className,
      )}
      {...props}
    />
  );
}
