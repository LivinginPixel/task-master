"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Play, Pause, RotateCcw, SkipForward,
  CheckCircle2, ChevronRight, Coffee, Focus, ArrowLeft, Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { usePomodoro } from "@/hooks/use-pomodoro"
import { useDatabaseTodos } from "@/hooks/use-db-tasks"
import { isToday } from "date-fns"
import type { Task } from "@/lib/types"
import Link from "next/link"

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0")
  const s = (seconds % 60).toString().padStart(2, "0")
  return `${m}:${s}`
}

const RADIUS = 80
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const DURATION_OPTIONS = [
  { label: "15 min", value: 15 },
  { label: "25 min", value: 25 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "60 min", value: 60 },
]

export function FocusMode() {
  const { todos, updateTodo, deleteTodo, isLoading } = useDatabaseTodos()
  const [taskIndex, setTaskIndex] = useState(0)
  const [workMinutes, setWorkMinutes] = useState(25)

  const { phase, seconds, isRunning, sessionCount, start, pause, reset, skipBreak, progress } =
    usePomodoro(workMinutes)

  const todayTasks = useMemo(() => {
    if (!todos) return []
    return todos
      .filter(t => {
        if (t.status === "COMPLETED") return false
        const dateStr = t.startTime || t.dueDate
        if (!dateStr) return false
        return isToday(new Date(dateStr))
      })
      .sort((a, b) => {
        const order = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
        return order[a.priority] - order[b.priority]
      })
  }, [todos])

  const currentTask: Task | undefined = todayTasks[taskIndex]

  const handleComplete = async () => {
    if (!currentTask) return
    await updateTodo(currentTask.id, {
      status: "COMPLETED",
      completedAt: new Date().toISOString(),
    }, "Task completed!")
    if (taskIndex < todayTasks.length - 1) {
      setTaskIndex(i => i + 1)
    }
  }

  const handleSkipTask = () => {
    if (taskIndex < todayTasks.length - 1) {
      setTaskIndex(i => i + 1)
    }
  }

  const handleDeleteTask = async () => {
    if (!currentTask) return
    await deleteTodo(currentTask.id)
    if (taskIndex > 0) setTaskIndex(i => i - 1)
  }

  const handleDurationChange = (mins: number) => {
    setWorkMinutes(mins)
    reset()
  }

  const dashOffset = CIRCUMFERENCE * (1 - progress)
  const phaseColor = phase === "break" ? "text-emerald-500" : phase === "work" ? "text-accent" : "text-muted-foreground"
  const ringColor  = phase === "break" ? "stroke-emerald-500" : phase === "work" ? "stroke-accent" : "stroke-border"

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Focus className="h-4 w-4 text-accent" />
          <span className="text-sm font-semibold">Focus Mode</span>
        </div>
        {sessionCount > 0 ? (
          <span className="text-xs font-medium text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full">
            {sessionCount} session{sessionCount > 1 ? "s" : ""} done
          </span>
        ) : (
          <div className="w-24" />
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-6 max-w-lg mx-auto w-full">

        {/* Current task — fixed min height to prevent layout shift on load */}
        <div className="w-full text-center min-h-[80px] flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2 w-full"
              >
                <div className="h-3 w-24 mx-auto rounded bg-muted/60 animate-pulse" />
                <div className="h-6 w-64 mx-auto rounded bg-muted/60 animate-pulse" />
              </motion.div>
            ) : currentTask ? (
              <motion.div
                key={currentTask.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
                className="space-y-1.5"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {phase === "break" ? "On break — rest up!" : `Task ${taskIndex + 1} of ${todayTasks.length}`}
                </p>
                <h2 className={cn("text-2xl font-bold leading-tight", phase === "break" && "opacity-40")}>
                  {currentTask.title}
                </h2>
                {currentTask.description && (
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
                    {currentTask.description}
                  </p>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="done"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-2"
              >
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
                <h2 className="text-xl font-bold">All done for today!</h2>
                <p className="text-sm text-muted-foreground">Great work — you&apos;ve tackled all your tasks.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Timer ring */}
        <div className="relative flex items-center justify-center">
          <svg width={200} height={200} className="-rotate-90">
            <circle cx={100} cy={100} r={RADIUS} fill="none" stroke="currentColor" strokeWidth={8} className="text-border/60" />
            <motion.circle
              cx={100} cy={100} r={RADIUS}
              fill="none" strokeWidth={8} strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              className={ringColor}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ duration: 0.5, ease: "linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            {phase === "break" ? (
              <Coffee className="h-5 w-5 text-emerald-500 mb-0.5" />
            ) : (
              <Focus className={cn("h-5 w-5 mb-0.5", phaseColor)} />
            )}
            <span className={cn("text-4xl font-mono font-bold tabular-nums", phaseColor)}>
              {formatTime(seconds)}
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              {phase === "break" ? "Break" : phase === "work" ? "Focus" : "Ready"}
            </span>
          </div>
        </div>

        {/* Duration selector — only when idle and not running */}
        {phase === "idle" && !isRunning && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1.5"
          >
            {DURATION_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleDurationChange(opt.value)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all",
                  workMinutes === opt.value
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border/50 text-muted-foreground hover:border-accent/40 hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </motion.div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="h-11 w-11 rounded-xl border border-border/60 bg-background flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <Button
            onClick={isRunning ? pause : start}
            disabled={!currentTask && phase !== "break"}
            size="icon"
            className="h-14 w-14 rounded-2xl text-lg shadow-lg shadow-accent/20"
          >
            {isRunning ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
          </Button>

          {phase === "break" ? (
            <button
              type="button"
              onClick={skipBreak}
              className="h-11 w-11 rounded-xl border border-border/60 bg-background flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-colors"
            >
              <SkipForward className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSkipTask}
              disabled={!currentTask || taskIndex >= todayTasks.length - 1}
              className="h-11 w-11 rounded-xl border border-border/60 bg-background flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Task action buttons — plain <button> to avoid shadcn hover interference */}
        {currentTask && phase !== "break" && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleComplete}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-xl border border-emerald-500/40 bg-transparent text-emerald-600 dark:text-emerald-400 text-sm font-medium hover:bg-emerald-500/10 hover:border-emerald-500/70 transition-colors"
            >
              <CheckCircle2 className="h-4 w-4" />
              Mark as Complete
            </button>
            <button
              type="button"
              onClick={handleDeleteTask}
              title="Delete task"
              className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-red-400/30 bg-transparent text-red-500 hover:bg-red-500/10 hover:border-red-400/60 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Task queue */}
        {todayTasks.length > 1 && (
          <div className="w-full space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Up next</p>
            <div className="space-y-1.5">
              {todayTasks.slice(taskIndex + 1, taskIndex + 4).map((t, i) => (
                <div key={t.id} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/40 border border-border/40">
                  <span className="text-xs font-medium text-muted-foreground w-4 text-center">{taskIndex + i + 2}</span>
                  <div className={cn(
                    "h-1.5 w-1.5 rounded-full shrink-0",
                    t.priority === "URGENT" ? "bg-red-500" :
                    t.priority === "HIGH"   ? "bg-orange-400" :
                    t.priority === "MEDIUM" ? "bg-accent" : "bg-emerald-400"
                  )} />
                  <p className="text-xs text-muted-foreground truncate flex-1">{t.title}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
