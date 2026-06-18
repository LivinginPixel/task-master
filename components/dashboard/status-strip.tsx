"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import { Calendar, AlertCircle, CheckCircle2, TrendingUp, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Task } from "@/lib/types"
import { isSameDay } from "date-fns"

interface StatusStripProps {
  tasks: Task[]
  onToggleAnalytics: () => void
  showAnalytics: boolean
}

export function StatusStrip({ tasks, onToggleAnalytics, showAnalytics }: StatusStripProps) {
  const stats = useMemo(() => {
    const now = new Date()
    const total = tasks.length
    const completed = tasks.filter(t => t.status === "COMPLETED").length

    const overdue = tasks.filter(t => {
      if (!t.dueDate || t.status === "COMPLETED") return false
      const d = new Date(t.dueDate)
      if (t.dueTime) {
        const [h, m] = t.dueTime.split(":").map(Number)
        d.setHours(h, m, 0, 0)
      } else {
        d.setHours(23, 59, 59, 999)
      }
      return d < now
    }).length

    const dueToday = tasks.filter(t => {
      if (!t.dueDate || t.status === "COMPLETED") return false
      return isSameDay(new Date(t.dueDate), new Date())
    }).length

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

    return { total, completed, overdue, dueToday, completionRate }
  }, [tasks])

  return (
    <motion.button
      onClick={onToggleAnalytics}
      className="w-full rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm px-4 py-3.5 text-left hover:border-accent/30 hover:bg-card/80 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 sm:gap-5 min-w-0 overflow-hidden">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Calendar className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
            <span className="text-sm font-bold text-foreground tabular-nums">{stats.dueToday}</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">today</span>
          </div>

          <div className="h-3 w-px bg-border/70 flex-shrink-0" />

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <AlertCircle className={cn(
              "h-3.5 w-3.5 flex-shrink-0",
              stats.overdue > 0 ? "text-red-500" : "text-muted-foreground/40"
            )} />
            <span className={cn(
              "text-sm font-bold tabular-nums",
              stats.overdue > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
            )}>{stats.overdue}</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">overdue</span>
          </div>

          <div className="h-3 w-px bg-border/70 flex-shrink-0" />

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <CheckCircle2 className="h-3.5 w-3.5 text-accent flex-shrink-0" />
            <span className="text-sm font-bold text-foreground tabular-nums">{stats.completionRate}%</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">done</span>
          </div>

          <div className="h-3 w-px bg-border/70 flex-shrink-0 hidden sm:block" />

          <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-bold text-foreground tabular-nums">{stats.total}</span>
            <span className="text-xs text-muted-foreground">tasks</span>
          </div>
        </div>

        <motion.div
          animate={{ rotate: showAnalytics ? 180 : 0 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="flex-shrink-0 text-muted-foreground"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.div>
      </div>

      <div className="mt-3 h-1 w-full bg-muted/50 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${stats.completionRate}%` }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.15 }}
          className="h-full bg-gradient-to-r from-accent to-accent/70 rounded-full"
        />
      </div>
    </motion.button>
  )
}
