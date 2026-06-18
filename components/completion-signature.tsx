"use client"

import { motion } from "framer-motion"
import { formatDistanceToNowStrict } from "date-fns"

interface CompletionSignatureProps {
  name?: string | null
  image?: string | null
  completedAt?: string | null
  /** "inline" = next to a subtask row; "footer" = task-level attribution block */
  variant?: "inline" | "footer"
}

function Avatar({ name, image, size }: { name?: string | null; image?: string | null; size: number }) {
  const initials = name
    ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "?"
  return image ? (
    <img
      src={image}
      alt={name ?? ""}
      width={size}
      height={size}
      className="rounded-full object-cover ring-1 ring-background flex-shrink-0"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="rounded-full bg-accent/20 text-accent font-bold flex items-center justify-center flex-shrink-0 leading-none"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {initials}
    </span>
  )
}

function relativeTime(iso: string) {
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: false })
  } catch {
    return null
  }
}

function exactTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit",
    })
  } catch {
    return null
  }
}

export function CompletionSignature({
  name,
  image,
  completedAt,
  variant = "inline",
}: CompletionSignatureProps) {
  if (!name) return null

  const firstName = name.split(" ")[0]
  const rel = completedAt ? relativeTime(completedAt) : null
  const exact = completedAt ? exactTime(completedAt) : null

  if (variant === "inline") {
    return (
      <motion.span
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        title={`Completed by ${name}${exact ? " · " + exact : ""}`}
        className="inline-flex items-center gap-1 text-muted-foreground select-none"
      >
        <Avatar name={name} image={image} size={16} />
        <span className="text-[11px] font-medium">{firstName}</span>
        {rel && (
          <span className="text-[10px] opacity-55">· {rel} ago</span>
        )}
      </motion.span>
    )
  }

  // footer variant — more prominent
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex items-center gap-2 px-4 py-3 rounded-xl bg-accent/6 border border-accent/15"
      title={exact ?? undefined}
    >
      <div className="w-4 h-4 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
        <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-accent-foreground" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2 6 5 9 10 3" />
        </svg>
      </div>
      <span className="text-xs text-muted-foreground">Completed by</span>
      <Avatar name={name} image={image} size={20} />
      <span className="text-xs font-semibold text-foreground">{firstName}</span>
      {exact && (
        <span className="text-[11px] text-muted-foreground ml-auto">
          {rel ? `${rel} ago` : exact}
        </span>
      )}
    </motion.div>
  )
}
