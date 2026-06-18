"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Flame, X, Zap, Trash2, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Task } from "@/lib/types"

interface ProcrastinationShieldProps {
  task: Task
  onDismiss: () => void
  onAction: (action: "break-down" | "clarify" | "reschedule" | "deprioritize" | "delete") => void
}

const REASONS = [
  {
    id: "too-big",
    emoji: "😰",
    label: "It feels too big",
    sublabel: "Break it into smaller pieces",
    action: "break-down" as const,
    color: "border-orange-400/40 bg-orange-400/5 hover:bg-orange-400/10 hover:border-orange-400/60",
    iconColor: "text-orange-500",
    description: "We'll split this into bite-sized subtasks right now.",
  },
  {
    id: "not-clear",
    emoji: "🤔",
    label: "Not sure what to do",
    sublabel: "Make it clearer",
    action: "clarify" as const,
    color: "border-blue-400/40 bg-blue-400/5 hover:bg-blue-400/10 hover:border-blue-400/60",
    iconColor: "text-blue-500",
    description: "Open the task and define exactly what 'done' looks like.",
  },
  {
    id: "low-energy",
    emoji: "😴",
    label: "Wrong time / low energy",
    sublabel: "Reschedule it",
    action: "reschedule" as const,
    color: "border-accent/40 bg-accent/5 hover:bg-accent/10 hover:border-accent/60",
    iconColor: "text-accent",
    description: "Move it to when you're historically most productive.",
  },
  {
    id: "not-important",
    emoji: "🤷",
    label: "It's not that important",
    sublabel: "Lower priority or remove it",
    action: "deprioritize" as const,
    color: "border-gray-400/40 bg-gray-400/5 hover:bg-gray-400/10 hover:border-gray-400/60",
    iconColor: "text-gray-500",
    description: "Downgrade to LOW priority or delete it entirely.",
  },
]

export function ProcrastinationShield({ task, onDismiss, onAction }: ProcrastinationShieldProps) {
  const [selected, setSelected] = useState<string | null>(null)

  const handleSelect = (reason: typeof REASONS[0]) => {
    setSelected(reason.id)
    setTimeout(() => {
      onAction(reason.action)
    }, 600)
  }

  return (
    <AnimatePresence>
      <motion.div
        key="shield-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
        onClick={onDismiss}
      />
      <motion.div
        key="shield-modal"
        initial={{ opacity: 0, scale: 0.9, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="fixed inset-x-4 bottom-6 sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 z-[61] w-full sm:max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="rounded-3xl border border-orange-500/20 bg-card shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="relative px-5 pt-5 pb-4 bg-gradient-to-br from-orange-500/10 via-red-500/5 to-transparent">
            <button
              onClick={onDismiss}
              className="absolute top-4 right-4 h-7 w-7 rounded-full bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-orange-500/15 flex items-center justify-center shrink-0">
                <Flame className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-orange-500">
                  Procrastination Shield
                </p>
                <p className="text-base font-extrabold text-foreground leading-tight mt-0.5">
                  This task is stuck 🔥
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-start gap-2 p-3 rounded-2xl bg-background/60 border border-border/50">
              <Zap className="h-3.5 w-3.5 text-orange-500 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{task.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Deferred <span className="font-bold text-orange-500">{task.deferCount ?? 3} times</span> — let&apos;s fix this now
                </p>
              </div>
            </div>
          </div>

          {/* Reason selection */}
          <div className="px-5 py-4 space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              What&apos;s blocking you?
            </p>

            {REASONS.map(reason => (
              <motion.button
                key={reason.id}
                onClick={() => handleSelect(reason)}
                disabled={selected !== null}
                whileTap={{ scale: 0.97 }}
                className={cn(
                  "w-full flex items-center gap-3.5 p-3.5 rounded-2xl border text-left transition-all",
                  reason.color,
                  selected === reason.id && "ring-2 ring-accent/50 scale-[0.99]",
                  selected !== null && selected !== reason.id && "opacity-40",
                )}
              >
                <span className="text-2xl shrink-0">{reason.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{reason.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{reason.sublabel}</p>
                </div>
                <ChevronRight className={cn("h-4 w-4 shrink-0 transition-colors", reason.iconColor)} />
              </motion.button>
            ))}
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 flex items-center justify-between">
            <button
              onClick={() => onAction("delete")}
              className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-400 font-medium transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete task
            </button>
            <button
              onClick={onDismiss}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Remind me later
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
