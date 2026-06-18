"use client"

import { useState, useEffect, useMemo } from "react"
import { motion } from "framer-motion"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface WelcomeMessageProps {
  userName: string
  taskStats?: { total: number; completed: number; dueToday: number }
  className?: string
}

const quotes = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Done is better than perfect.", author: "Sheryl Sandberg" },
  { text: "Focus on progress, not perfection.", author: null },
  { text: "One task at a time. That's all it takes.", author: null },
  { text: "Small steps every day lead to big changes.", author: null },
  { text: "What you do today can improve all your tomorrows.", author: "Ralph Marston" },
  { text: "The only way out is through.", author: "Robert Frost" },
]

function getGreeting() {
  const h = new Date().getHours()
  if (h >= 5  && h < 12) return "Good morning"
  if (h >= 12 && h < 17) return "Good afternoon"
  if (h >= 17 && h < 21) return "Good evening"
  return "Good night"
}

export function WelcomeMessage({ userName, taskStats, className }: WelcomeMessageProps) {
  const [mounted, setMounted] = useState(false)
  const [quote] = useState(() => quotes[Math.floor(Math.random() * quotes.length)])
  const greeting = useMemo(() => getGreeting(), [])

  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return <div className="h-24" />

  const firstName = (userName || "there").split(" ")[0]
  const dueToday   = taskStats?.dueToday   ?? 0
  const total      = taskStats?.total      ?? 0
  const completed  = taskStats?.completed  ?? 0

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn("space-y-1", className)}
    >
      {/* Date line */}
      <p className="text-[13px] font-medium text-muted-foreground tracking-wide">
        {format(new Date(), "EEEE, MMMM d")}
      </p>

      {/* Greeting */}
      <div className="flex items-baseline gap-2.5">
        <h1 className="text-[2.4rem] sm:text-[2.8rem] font-extrabold tracking-[-0.03em] leading-none text-foreground">
          {greeting},
        </h1>
        <motion.span
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.35 }}
          className="text-[2.4rem] sm:text-[2.8rem] font-extrabold tracking-[-0.03em] leading-none text-accent"
        >
          {firstName}.
        </motion.span>
      </div>

      {/* Stats line */}
      {total > 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.18 }}
          className="text-[13px] text-muted-foreground pt-0.5"
        >
          {dueToday > 0 && (
            <span className="font-semibold text-foreground">{dueToday} due today</span>
          )}
          {dueToday > 0 && total > 0 && <span className="mx-1.5 opacity-30">·</span>}
          {completed}/{total} complete
        </motion.p>
      )}

      {/* Divider */}
      <motion.div
        initial={{ scaleX: 0, originX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.24, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="h-px bg-border/60 mt-4"
      />

      {/* Quote */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="pt-1"
      >
        <p className="text-sm font-medium text-foreground/90 italic leading-relaxed">
          &ldquo;{quote.text}&rdquo;
        </p>
        {quote.author && (
          <p className="text-xs font-semibold text-muted-foreground mt-1 not-italic">
            — {quote.author}
          </p>
        )}
      </motion.div>
    </motion.div>
  )
}
