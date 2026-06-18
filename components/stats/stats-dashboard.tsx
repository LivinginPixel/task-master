"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import { CheckCircle2, Flame, TrendingUp, Target, BarChart3, Tag } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDatabaseTodos } from "@/hooks/use-db-tasks"
import { format, subDays, isSameDay, startOfDay, eachDayOfInterval } from "date-fns"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

const PRIORITY_COLOR: Record<string, string> = {
  URGENT: "bg-red-500",
  HIGH: "bg-orange-400",
  MEDIUM: "bg-accent",
  LOW: "bg-emerald-400",
}

const PRIORITY_TEXT: Record<string, string> = {
  URGENT: "text-red-500",
  HIGH: "text-orange-400",
  MEDIUM: "text-accent",
  LOW: "text-emerald-500",
}

export function StatsDashboard() {
  const { todos, isLoading } = useDatabaseTodos()

  const stats = useMemo(() => {
    if (!todos) return null
    const now = new Date()

    const total = todos.length
    const completed = todos.filter(t => t.status === "COMPLETED")
    const completedCount = completed.length
    const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0

    // Last 7 days
    const last7 = eachDayOfInterval({ start: subDays(now, 6), end: now })
    const dailyCompletions = last7.map(day => ({
      label: format(day, "EEE"),
      date: day,
      count: completed.filter(t => t.completedAt && isSameDay(new Date(t.completedAt), day)).length,
    }))
    const maxDay = Math.max(...dailyCompletions.map(d => d.count), 1)

    // Streak: consecutive days ending today with >= 1 completion
    let streak = 0
    for (let i = 0; ; i++) {
      const day = startOfDay(subDays(now, i))
      const hasCompletion = completed.some(t => t.completedAt && isSameDay(new Date(t.completedAt), day))
      if (hasCompletion) streak++
      else break
    }

    // Best streak
    let bestStreak = 0
    let tempStreak = 0
    // Sort completedAt dates
    const completionDates = completed
      .filter(t => t.completedAt)
      .map(t => startOfDay(new Date(t.completedAt!)).getTime())
      .sort()
      .filter((d, i, arr) => arr.indexOf(d) === i)

    for (let i = 0; i < completionDates.length; i++) {
      if (i === 0 || completionDates[i] - completionDates[i - 1] === 86400000) {
        tempStreak++
        bestStreak = Math.max(bestStreak, tempStreak)
      } else {
        tempStreak = 1
      }
    }

    // By category
    const categoryMap = new Map<string, number>()
    for (const t of todos) {
      if (t.category) {
        categoryMap.set(t.category, (categoryMap.get(t.category) || 0) + 1)
      }
    }
    const categories = Array.from(categoryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    // By priority
    const priorityMap: Record<string, { total: number; done: number }> = {
      URGENT: { total: 0, done: 0 },
      HIGH: { total: 0, done: 0 },
      MEDIUM: { total: 0, done: 0 },
      LOW: { total: 0, done: 0 },
    }
    for (const t of todos) {
      if (priorityMap[t.priority]) {
        priorityMap[t.priority].total++
        if (t.status === "COMPLETED") priorityMap[t.priority].done++
      }
    }

    return { total, completedCount, completionRate, dailyCompletions, maxDay, streak, bestStreak, categories, priorityMap }
  }, [todos])

  if (isLoading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    )
  }

  const cards = [
    { icon: CheckCircle2, label: "Total Completed", value: stats.completedCount, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { icon: Target, label: "Completion Rate", value: `${stats.completionRate}%`, color: "text-accent", bg: "bg-accent/10" },
    { icon: Flame, label: "Current Streak", value: `${stats.streak}d`, color: "text-orange-400", bg: "bg-orange-400/10" },
    { icon: TrendingUp, label: "Best Streak", value: `${stats.bestStreak}d`, color: "text-blue-500", bg: "bg-blue-500/10" },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10">
      <div className="container mx-auto px-4 pt-24 pb-20 max-w-2xl space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Stats & Insights</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Your productivity at a glance</p>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 gap-3">
          {cards.map((card, i) => {
            const Icon = card.icon
            return (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="rounded-2xl border border-border/60 bg-card p-4 space-y-3"
              >
                <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", card.bg)}>
                  <Icon className={cn("h-5 w-5", card.color)} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{card.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Daily completions bar chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border border-border/60 bg-card p-5 space-y-4"
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-bold">Completions — Last 7 Days</h2>
          </div>
          <div className="flex items-end gap-2 h-28">
            {stats.dailyCompletions.map((day, i) => {
              const height = day.count === 0 ? 4 : Math.max(12, (day.count / stats.maxDay) * 100)
              const isToday = isSameDay(day.date, new Date())
              return (
                <div key={day.label} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-[10px] font-bold text-foreground">
                    {day.count > 0 ? day.count : ""}
                  </span>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ delay: 0.4 + i * 0.06, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                    className={cn(
                      "w-full rounded-lg",
                      isToday ? "bg-accent" : day.count > 0 ? "bg-accent/40" : "bg-muted/60"
                    )}
                    style={{ height: `${height}%` }}
                  />
                  <span className={cn("text-[10px] font-medium", isToday ? "text-accent" : "text-muted-foreground")}>
                    {day.label}
                  </span>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* Priority breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl border border-border/60 bg-card p-5 space-y-4"
        >
          <h2 className="text-sm font-bold">By Priority</h2>
          <div className="space-y-3">
            {(["URGENT", "HIGH", "MEDIUM", "LOW"] as const).map(p => {
              const data = stats.priorityMap[p]
              const pct = data.total > 0 ? Math.round((data.done / data.total) * 100) : 0
              return (
                <div key={p} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn("h-2 w-2 rounded-full", PRIORITY_COLOR[p])} />
                      <span className="text-xs font-medium capitalize">{p.toLowerCase()}</span>
                    </div>
                    <span className={cn("text-xs font-semibold", PRIORITY_TEXT[p])}>
                      {data.done}/{data.total} done
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.5, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                      className={cn("h-full rounded-full", PRIORITY_COLOR[p])}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* Category breakdown */}
        {stats.categories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="rounded-2xl border border-border/60 bg-card p-5 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-bold">Top Categories</h2>
            </div>
            <div className="space-y-2.5">
              {stats.categories.map(([cat, count], i) => {
                const pct = Math.round((count / stats.total) * 100)
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-medium capitalize">{cat}</span>
                      <span className="text-xs text-muted-foreground">{count} task{count > 1 ? "s" : ""}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.55 + i * 0.05, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                        className="h-full rounded-full bg-accent/70"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
