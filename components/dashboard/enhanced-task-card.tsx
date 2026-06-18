"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence, useMotionValue, useTransform, useDragControls } from "framer-motion"
import { format } from "date-fns"
import { Card } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Calendar,
  Clock,
  Pencil,
  Trash2,
  Copy,
  BellOff,
  Bell,
  Share2,
  CheckCheck,
  Clock3,
  MoreHorizontal,
  Check,
  ListChecks,
  Maximize2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Task } from "@/lib/types"
import { EnhancedSubtaskList } from "@/components/enhanced-subtask-list"
import { DeleteTaskDialog } from "./delete-task-dialog"
import { CompletionSignature } from "@/components/completion-signature"

interface EnhancedTaskCardProps {
  task: Task
  onUpdate: (id: string, updates: Partial<Task>, successMessage?: string) => void
  onDelete: (id: string) => void
  onEdit?: (task: Task) => void
  onDuplicate?: (task: Task) => void
  onOpenDetail?: (task: Task) => void
  selected?: boolean
  onSelect?: (id: string) => void
  selectionMode?: boolean
}

const priorityAccent: Record<Task["priority"], string> = {
  URGENT: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-blue-500",
  LOW: "bg-border",
}

export function EnhancedTaskCard({ task, onUpdate, onDelete, onEdit, onDuplicate, onOpenDetail, selected, onSelect, selectionMode }: EnhancedTaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isOverdue, setIsOverdue] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isSnoozed, setIsSnoozed] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const longPressRef = useState<ReturnType<typeof setTimeout> | null>(null)

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation()
    let token = task.shareToken
    if (!token) {
      const res = await fetch(`/api/tasks/${task.id}/share`, { method: "POST" })
      const data = await res.json()
      token = data.token
      onUpdate(task.id, { shareToken: token ?? undefined })
    }
    const url = `${window.location.origin}/share/${token}`
    await navigator.clipboard.writeText(url)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2500)
  }

  // Swipe gesture — dragControls lets us restrict drag to a specific zone
  const x = useMotionValue(0)
  const completeOpacity = useTransform(x, [0, 72], [0, 1])
  const deleteOpacity = useTransform(x, [-72, 0], [1, 0])
  const SWIPE_THRESHOLD = 72
  const dragControls = useDragControls()

  const subtasks = task.subtasks || []
  const completedSubtasks = subtasks.filter(st => st.completed).length
  const totalSubtasks = subtasks.length
  const isCompleted = task.status === "COMPLETED"

  useEffect(() => {
    if (!task.dueDate || task.status === "COMPLETED") {
      setIsOverdue(false)
      setIsSnoozed(false)
      return undefined
    }

    const dueDate = new Date(task.dueDate)
    if (task.dueTime) {
      const [hours, minutes] = task.dueTime.split(":").map(Number)
      dueDate.setHours(hours, minutes, 0, 0)
    } else {
      dueDate.setHours(23, 59, 59, 999)
    }

    const isOverdueNow = dueDate < new Date()
    setIsOverdue(task.status === "OVERDUE")

    if (task.snoozedUntil) {
      setIsSnoozed(new Date(task.snoozedUntil) > new Date())
    } else {
      setIsSnoozed(false)
    }

    if (isOverdueNow && task.status !== "OVERDUE") {
      const timeoutId = setTimeout(() => {
        onUpdate(task.id, { status: "OVERDUE", overdueAt: new Date().toISOString() }, undefined)
      }, 0)
      return () => clearTimeout(timeoutId)
    }

    return undefined
  }, [task.dueDate, task.dueTime, task.status, task.id, task.snoozedUntil, onUpdate])

  const handleQuickComplete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isCompleted) {
      onUpdate(task.id, { status: "PENDING" }, "Task reopened")
    } else {
      onUpdate(task.id, { status: "COMPLETED", completedAt: new Date().toISOString() }, "Task completed!")
    }
  }

  const handleSubtaskToggle = (subtaskId: string, completed: boolean) => {
    if (isOverdue && task.lockedAfterDue) return

    const updatedSubtasks = (task.subtasks || []).map(st =>
      st.id === subtaskId ? { ...st, completed, task_id: task.id } : { ...st, task_id: task.id }
    )
    const allCompleted = updatedSubtasks.length > 0 && updatedSubtasks.every(st => st.completed)
    const updates: Partial<Task> = { subtasks: updatedSubtasks }
    let message = completed ? "Subtask completed" : "Subtask reopened"

    if (allCompleted && task.status !== "COMPLETED") {
      updates.status = "COMPLETED"
      updates.completedAt = new Date().toISOString()
      message = "All subtasks done! Task marked complete"
    }

    onUpdate(task.id, updates, message)
  }

  const handleSubtaskAdd = (subtask: { id: string; title: string; completed: boolean }) => {
    onUpdate(task.id, {
      subtasks: [...(task.subtasks || []).map(st => ({ ...st, task_id: task.id })), { ...subtask, task_id: task.id }],
    }, "Subtask added")
  }

  const handleSubtaskDelete = (subtaskId: string) => {
    onUpdate(task.id, {
      subtasks: (task.subtasks || []).filter(st => st.id !== subtaskId),
    }, "Subtask deleted")
  }

  const handleEdit = () => {
    if (!isOverdue && onEdit) onEdit(task)
  }

  const handleDuplicate = () => {
    if (onDuplicate) onDuplicate(task)
  }

  const handleSnooze = () => {
    const snoozeUntil = new Date()
    snoozeUntil.setHours(snoozeUntil.getHours() + 24)
    onUpdate(task.id, { snoozedUntil: snoozeUntil.toISOString() }, "Snoozed for 1 day")
  }

  const handleUnsnooze = () => {
    onUpdate(task.id, { snoozedUntil: undefined }, "Snooze cleared")
  }

  const handleToggleMute = () => {
    const next = !task.notificationsMuted
    onUpdate(task.id, { notificationsMuted: next }, next ? "Notifications muted" : "Notifications unmuted")
  }

  const accentColor = isOverdue ? "bg-red-500" : priorityAccent[task.priority]

  const tags = task.tags?.filter(Boolean) ?? []
  const showChips = task.category || tags.length > 0
  const showMeta = task.dueDate || totalSubtasks > 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{
        layout: { duration: 0.28, ease: [0.4, 0, 0.2, 1] },
        opacity: { duration: 0.22 },
        y: { duration: 0.28, ease: [0.4, 0, 0.2, 1] },
        scale: { duration: 0.22 },
      }}
      className="relative"
    >
      {/* Swipe-reveal backgrounds */}
      <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
        {/* Right swipe → complete */}
        <motion.div
          style={{ opacity: completeOpacity }}
          className="absolute inset-0 flex items-center justify-start pl-5 bg-accent/20 rounded-xl"
        >
          <Check className="h-6 w-6 text-accent" strokeWidth={3} />
        </motion.div>
        {/* Left swipe → delete */}
        <motion.div
          style={{ opacity: deleteOpacity }}
          className="absolute inset-0 flex items-center justify-end pr-5 bg-red-500/15 rounded-xl"
        >
          <Trash2 className="h-6 w-6 text-red-500" strokeWidth={2.5} />
        </motion.div>
      </div>

      {/* Draggable card — dragListener=false means drag ONLY starts from onPointerDown={dragControls.start} */}
      <motion.div
        style={{ x }}
        drag="x"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ left: -110, right: 110 }}
        dragElastic={0.05}
        dragMomentum={false}
        dragSnapToOrigin
        onDragEnd={(_, info) => {
          if (info.offset.x > SWIPE_THRESHOLD && !isCompleted) {
            handleQuickComplete({ stopPropagation: () => {} } as React.MouseEvent)
          } else if (info.offset.x < -SWIPE_THRESHOLD) {
            setShowDeleteDialog(true)
          }
        }}
      >
      <Card
        className={cn(
          "relative overflow-hidden rounded-xl border transition-all duration-200 hover:shadow-md",
          isOverdue && "border-red-300/60 dark:border-red-800/60 bg-red-500/[0.03]",
          isCompleted && "opacity-60",
          task.partiallyResolved && "border-purple-300/50 dark:border-purple-700/50",
          !isOverdue && !isCompleted && !task.partiallyResolved && "border-border/70",
          selected && "border-accent/60 bg-accent/5 ring-1 ring-accent/30"
        )}
        onPointerDown={() => {
          if (!onSelect) return
          const timer = setTimeout(() => { onSelect(task.id) }, 500)
          longPressRef[0] = timer
          const cancel = () => { clearTimeout(timer); window.removeEventListener("pointerup", cancel); window.removeEventListener("pointermove", cancel) }
          window.addEventListener("pointerup", cancel)
          window.addEventListener("pointermove", cancel)
        }}
        onClick={() => { if (selectionMode && onSelect) { onSelect(task.id) } }}
      >
        {/* Priority / status accent bar */}
        <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl", accentColor)} />

        {/* Selection indicator */}
        <AnimatePresence>
          {selectionMode && (
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              className="absolute top-2.5 right-2.5 z-20"
            >
              <div className={cn(
                "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors",
                selected ? "border-accent bg-accent" : "border-border bg-background"
              )}>
                {selected && <Check className="h-3 w-3 text-accent-foreground" strokeWidth={3} />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="pl-4 pr-3 pt-3.5 pb-3">
            <div className="flex items-start gap-2.5">

              {/* Quick-complete checkbox */}
              <button
                type="button"
                onClick={handleQuickComplete}
                className="flex-shrink-0 mt-[3px] p-2 -m-2 rounded-full touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                aria-label={isCompleted ? "Mark as incomplete" : "Mark as complete"}
              >
                <motion.div
                  className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-150",
                    isCompleted
                      ? "bg-accent border-accent"
                      : "border-muted-foreground/35 hover:border-accent"
                  )}
                  whileTap={{ scale: 0.82 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                >
                  <AnimatePresence>
                    {isCompleted && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 600, damping: 28 }}
                      >
                        <Check className="h-[11px] w-[11px] text-accent-foreground" strokeWidth={3} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </button>

              {/* Tappable content area — CollapsibleTrigger. Also the swipe drag zone. */}
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  onPointerDown={(e) => dragControls.start(e)}
                  className="flex-1 min-w-0 text-left space-y-1.5 focus:outline-none touch-pan-y"
                >
                  {/* Title */}
                  <div className="flex items-center gap-2 pr-1">
                    <span
                      className={cn(
                        "font-semibold text-[15px] leading-snug text-foreground flex-1 min-w-0",
                        isCompleted && "line-through text-muted-foreground",
                        isOverdue && !isCompleted && "text-red-700 dark:text-red-400"
                      )}
                    >
                      {task.title}
                    </span>
                  </div>

                  {/* Who completed this task */}
                  {isCompleted && task.completedByName && (
                    <CompletionSignature
                      name={task.completedByName}
                      image={task.completedByImage}
                      completedAt={task.completedAt}
                      variant="inline"
                    />
                  )}

                  {/* Category + tag chips */}
                  {showChips && (
                    <div className="flex items-center flex-wrap gap-1">
                      {task.category && (
                        <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {task.category}
                        </span>
                      )}
                      {tags.slice(0, 3).map(tag => (
                        <span
                          key={tag}
                          className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-accent/10 text-accent"
                        >
                          #{tag}
                        </span>
                      ))}
                      {tags.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">+{tags.length - 3}</span>
                      )}
                      {isSnoozed && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          <Clock3 className="h-2.5 w-2.5" />
                          Snoozed
                        </span>
                      )}
                      {task.notificationsMuted && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                          <BellOff className="h-2.5 w-2.5" />
                          Muted
                        </span>
                      )}
                      {(task.deferCount ?? 0) >= 3 && task.status !== "COMPLETED" && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400">
                          🔥 Stuck
                        </span>
                      )}
                      {task.shareToken && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">
                          🔗 Shared
                        </span>
                      )}
                      {task.isCollaborated && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          👥 {task.ownerName ? `from ${task.ownerName.split(" ")[0]}` : "Shared with me"}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Metadata: due date + subtask count + recurrence */}
                  {showMeta && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {task.dueDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 flex-shrink-0" />
                          {format(new Date(task.dueDate), "MMM d")}
                          {task.dueTime && (
                            <>
                              <Clock className="h-3 w-3 flex-shrink-0 ml-0.5" />
                              <span className="font-medium">{task.dueTime}</span>
                            </>
                          )}
                        </span>
                      )}
                      {totalSubtasks > 0 && (
                        <span className="flex items-center gap-1">
                          <ListChecks className="h-3 w-3 flex-shrink-0" />
                          <span className="tabular-nums">{completedSubtasks}/{totalSubtasks}</span>
                        </span>
                      )}
                      {task.recurrenceType && (
                        <span className="flex items-center gap-1 text-accent" title={`Repeats ${task.recurrenceType}`}>
                          <svg className="h-3 w-3 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M13 2v4H9" /><path d="M3 14v-4h4" />
                            <path d="M13 6A6 6 0 0 0 3.5 4" /><path d="M3 10a6 6 0 0 0 9.5 2" />
                          </svg>
                          <span className="font-medium capitalize">{task.recurrenceType}</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Description */}
                  {task.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1 leading-relaxed">
                      {task.description}
                    </p>
                  )}
                </button>
              </CollapsibleTrigger>

              {/* Detail + ··· buttons */}
              <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
                {onOpenDetail && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); onOpenDetail(task) }}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors touch-manipulation focus:outline-none"
                    aria-label="View details"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                )}

                {/* ··· Action menu — modal=false prevents Radix scroll-lock which shifts page content */}
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      onClick={e => e.stopPropagation()}
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      aria-label="Task options"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    {onOpenDetail && (
                      <>
                        <DropdownMenuItem onClick={() => onOpenDetail(task)}>
                          <Maximize2 className="h-3.5 w-3.5 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem
                      onClick={handleEdit}
                      disabled={isOverdue}
                      className={cn(isOverdue && "opacity-40 cursor-not-allowed")}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDuplicate}>
                      <Copy className="h-3.5 w-3.5 mr-2" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleShare} className={shareCopied ? "text-accent focus:text-accent" : ""}>
                      {shareCopied
                        ? <><CheckCheck className="h-3.5 w-3.5 mr-2" />Link copied!</>
                        : <><Share2 className="h-3.5 w-3.5 mr-2" />{task.shareToken ? "Copy share link" : "Share task"}</>
                      }
                    </DropdownMenuItem>
                    {isOverdue && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={isSnoozed ? handleUnsnooze : handleSnooze}>
                          <Clock3 className="h-3.5 w-3.5 mr-2" />
                          {isSnoozed ? "Clear Snooze" : "Snooze 1 Day"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleToggleMute}>
                          {task.notificationsMuted
                            ? <Bell className="h-3.5 w-3.5 mr-2" />
                            : <BellOff className="h-3.5 w-3.5 mr-2" />
                          }
                          {task.notificationsMuted ? "Unmute Alerts" : "Mute Alerts"}
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Expandable subtasks */}
          <CollapsibleContent>
            <div className="px-4 pb-4 border-t border-border/50 pt-3">
              {isCompleted && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-muted/60 border border-border/60">
                  <p className="text-xs text-muted-foreground font-medium">
                    Task completed. Subtasks are read-only.
                  </p>
                </div>
              )}
              <EnhancedSubtaskList
                subtasks={subtasks}
                onToggle={handleSubtaskToggle}
                onAdd={handleSubtaskAdd}
                onDelete={handleSubtaskDelete}
                variant="premium-modern"
                disabled={isCompleted}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>
      </motion.div>

      <DeleteTaskDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        taskTitle={task.title}
        onConfirm={() => onDelete(task.id)}
      />
    </motion.div>
  )
}
