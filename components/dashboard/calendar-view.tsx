"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, isToday, isSameMonth } from "date-fns"
import type { Task } from "@/lib/types"

interface CalendarViewProps {
  tasks: Task[]
  onAddTask: () => void
  onOpenDetail: (task: Task) => void
}

const PRIORITY_DOT: Record<string, string> = {
  URGENT: "bg-red-500",
  HIGH: "bg-orange-400",
  MEDIUM: "bg-accent",
  LOW: "bg-emerald-400",
}

export function CalendarView({ tasks, onAddTask, onOpenDetail }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of tasks) {
      const dateStr = task.dueDate || task.startTime
      if (!dateStr) continue
      const key = format(new Date(dateStr), "yyyy-MM-dd")
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(task)
    }
    return map
  }, [tasks])

  const selectedTasks = useMemo(() => {
    if (!selectedDate) return []
    const key = format(selectedDate, "yyyy-MM-dd")
    return tasksByDate.get(key) || []
  }, [selectedDate, tasksByDate])

  const prevMonth = () => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1))
  const nextMonth = () => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1))

  return (
    <div className="space-y-4">
      {/* Calendar Card */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <button
            onClick={prevMonth}
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="text-base font-bold tracking-tight">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <button
            onClick={nextMonth}
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border/40">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
            <div key={d} className="py-2 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, i) => {
            const key = format(day, "yyyy-MM-dd")
            const dayTasks = tasksByDate.get(key) || []
            const isCurrentMonth = isSameMonth(day, currentMonth)
            const isSelected = selectedDate && isSameDay(day, selectedDate)
            const todayDay = isToday(day)
            const visibleDots = dayTasks.slice(0, 3)
            const hasMore = dayTasks.length > 3

            return (
              <motion.button
                key={key}
                whileTap={{ scale: 0.93 }}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "relative flex flex-col items-center pt-2 pb-1.5 min-h-[60px] border-b border-r border-border/20 transition-colors",
                  i % 7 === 6 && "border-r-0",
                  !isCurrentMonth && "opacity-35",
                  isSelected && "bg-accent/10",
                  !isSelected && "hover:bg-muted/50"
                )}
              >
                {/* Date number */}
                <span
                  className={cn(
                    "h-6 w-6 flex items-center justify-center rounded-full text-xs font-semibold transition-colors",
                    todayDay && !isSelected && "bg-accent text-accent-foreground",
                    isSelected && !todayDay && "bg-accent/80 text-accent-foreground",
                    isSelected && todayDay && "bg-accent text-accent-foreground",
                    !todayDay && !isSelected && "text-foreground"
                  )}
                >
                  {format(day, "d")}
                </span>

                {/* Task dots */}
                {visibleDots.length > 0 && (
                  <div className="flex gap-0.5 mt-1 items-center">
                    {visibleDots.map((t, di) => (
                      <span
                        key={di}
                        className={cn("h-1.5 w-1.5 rounded-full", PRIORITY_DOT[t.priority] || "bg-muted-foreground")}
                      />
                    ))}
                    {hasMore && (
                      <span className="text-[9px] text-muted-foreground font-bold leading-none">+</span>
                    )}
                  </div>
                )}
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Selected Date Task List */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedDate ? format(selectedDate, "yyyy-MM-dd") : "none"}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">
              {selectedDate ? format(selectedDate, "EEEE, MMMM d") : "Select a date"}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {selectedTasks.length > 0 ? `${selectedTasks.length} task${selectedTasks.length > 1 ? "s" : ""}` : "No tasks"}
              </span>
            </h3>
            <button
              onClick={onAddTask}
              className="flex items-center gap-1 text-xs font-medium text-accent hover:text-accent/80 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Task
            </button>
          </div>

          {selectedTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 py-10 text-center text-sm text-muted-foreground">
              No tasks on this day
            </div>
          ) : (
            <div className="space-y-2">
              {selectedTasks.map(task => (
                <motion.button
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => onOpenDetail(task)}
                  className="w-full text-left rounded-xl border border-border/60 bg-card px-4 py-3 hover:border-accent/40 hover:bg-accent/5 transition-all group"
                >
                  <div className="flex items-start gap-3">
                    {/* Priority bar */}
                    <div className={cn(
                      "h-full w-0.5 rounded-full self-stretch min-h-[20px] shrink-0",
                      task.priority === "URGENT" ? "bg-red-500" :
                      task.priority === "HIGH" ? "bg-orange-400" :
                      task.priority === "MEDIUM" ? "bg-accent" : "bg-emerald-400"
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium leading-tight",
                        task.status === "COMPLETED" && "line-through text-muted-foreground"
                      )}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {task.dueTime && (
                          <span className="text-xs text-muted-foreground">{task.dueTime}</span>
                        )}
                        {task.category && (
                          <span className="text-xs text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full">{task.category}</span>
                        )}
                        <span className={cn(
                          "text-xs font-medium px-1.5 py-0.5 rounded-full",
                          task.status === "COMPLETED" ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300" :
                          task.status === "OVERDUE" ? "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300" :
                          "bg-muted text-muted-foreground"
                        )}>
                          {task.status.charAt(0) + task.status.slice(1).toLowerCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
