"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { format } from "date-fns"
import {
  X, Calendar, Clock, Tag, FolderOpen, FileText,
  StickyNote, ListChecks, ChevronDown, Check, Share2, Copy, CheckCheck, Users, Crown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Task } from "@/lib/types"
import { EnhancedSubtaskList } from "@/components/enhanced-subtask-list"
import { Badge } from "@/components/ui/badge"
import { CollaboratorPanel, CollaboratorAvatarGroup } from "@/components/collaboration/collaborator-panel"
import { CompletionSignature } from "@/components/completion-signature"
import { useSession } from "next-auth/react"

interface TaskDetailSheetProps {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: (id: string, updates: Partial<Task>, message?: string) => void
}

const PRIORITY_CONFIG = {
  URGENT: { label: "Urgent", color: "bg-red-500", text: "text-red-600 dark:text-red-400" },
  HIGH:   { label: "High",   color: "bg-orange-500", text: "text-orange-600 dark:text-orange-400" },
  MEDIUM: { label: "Medium", color: "bg-blue-500", text: "text-blue-600 dark:text-blue-400" },
  LOW:    { label: "Low",    color: "bg-gray-400", text: "text-gray-500 dark:text-gray-400" },
}

export function TaskDetailSheet({ task, open, onOpenChange, onUpdate }: TaskDetailSheetProps) {
  useSession()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [notes, setNotes] = useState("")
  const [category, setCategory] = useState("")
  const [priority, setPriority] = useState<Task["priority"]>("MEDIUM")
  const [showPriorityMenu, setShowPriorityMenu] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [showCollaborators, setShowCollaborators] = useState(false)
  const titleRef = useRef<HTMLTextAreaElement>(null)

  const handleShare = async () => {
    if (!task) return
    if (task.shareToken) {
      const url = `${window.location.origin}/share/${task.shareToken}`
      setShareUrl(url)
      return
    }
    setShareLoading(true)
    const res = await fetch(`/api/tasks/${task.id}/share`, { method: "POST" })
    const data = await res.json()
    setShareUrl(data.url)
    setShareLoading(false)
    onUpdate(task.id, { shareToken: data.token })
  }

  const handleCopyLink = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }

  useEffect(() => {
    if (task) {
      setTitle(task.title || "")
      setDescription(task.description || "")
      setNotes(task.notes || "")
      setCategory(task.category || "")
      setPriority(task.priority)
    }
  }, [task?.id])

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [open])

  const save = (field: keyof Task, value: unknown) => {
    if (!task) return
    if (task[field] === value) return
    onUpdate(task.id, { [field]: value } as Partial<Task>)
  }

  const handleSubtaskToggle = (subtaskId: string, completed: boolean) => {
    if (!task) return
    const updatedSubtasks = (task.subtasks || []).map(st =>
      st.id === subtaskId ? { ...st, completed, task_id: task.id } : { ...st, task_id: task.id }
    )
    const allDone = updatedSubtasks.length > 0 && updatedSubtasks.every(st => st.completed)
    onUpdate(task.id, {
      subtasks: updatedSubtasks,
      ...(allDone && task.status !== "COMPLETED" ? { status: "COMPLETED" as const, completedAt: new Date().toISOString() } : {}),
    })
  }

  const handleSubtaskAdd = (subtask: { id: string; title: string; completed: boolean }) => {
    if (!task) return
    onUpdate(task.id, {
      subtasks: [...(task.subtasks || []).map(st => ({ ...st, task_id: task.id })), { ...subtask, task_id: task.id }],
    })
  }

  const handleSubtaskDelete = (subtaskId: string) => {
    if (!task) return
    onUpdate(task.id, { subtasks: (task.subtasks || []).filter(st => st.id !== subtaskId) })
  }

  const tags = task?.tags?.filter(Boolean) ?? []
  const isCompleted = task?.status === "COMPLETED"
  const isOverdue = task?.status === "OVERDUE"

  return (
    <AnimatePresence>
      {open && task && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
            onClick={() => onOpenChange(false)}
          />

          {/* Sheet — bottom on mobile, right panel on md+ */}
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className={cn(
              "fixed z-50 bg-background flex flex-col",
              "bottom-0 left-0 right-0 h-[92vh] rounded-t-3xl border-t border-border/60",
              "md:bottom-0 md:right-0 md:top-0 md:left-auto md:h-full md:w-[480px] md:rounded-none md:border-t-0 md:border-l"
            )}
          >
            {/* Drag handle (mobile only) */}
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
              <div className="flex items-center gap-2">
                {/* Priority dot */}
                <button
                  type="button"
                  onClick={() => setShowPriorityMenu(v => !v)}
                  className="relative flex items-center gap-1.5 focus:outline-none"
                  aria-label="Change priority"
                >
                  <div className={cn("w-3 h-3 rounded-full", PRIORITY_CONFIG[priority].color)} />
                  <span className={cn("text-xs font-semibold hidden sm:inline", PRIORITY_CONFIG[priority].text)}>
                    {PRIORITY_CONFIG[priority].label}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />

                  <AnimatePresence>
                    {showPriorityMenu && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 mt-1.5 z-10 w-36 bg-popover border border-border rounded-xl shadow-lg overflow-hidden"
                        onClick={e => e.stopPropagation()}
                      >
                        {(["URGENT", "HIGH", "MEDIUM", "LOW"] as Task["priority"][]).map(p => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => {
                              setPriority(p)
                              save("priority", p)
                              setShowPriorityMenu(false)
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted transition-colors"
                          >
                            <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", PRIORITY_CONFIG[p].color)} />
                            <span className="font-medium">{PRIORITY_CONFIG[p].label}</span>
                            {priority === p && <Check className="h-3.5 w-3.5 ml-auto text-accent" />}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>

                {/* Status badge */}
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-semibold",
                    isCompleted && "bg-accent/10 text-accent border-accent/30",
                    isOverdue && "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
                    !isCompleted && !isOverdue && "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? "Done" : isOverdue ? "Overdue" : "Active"}
                </Badge>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleShare}
                  disabled={shareLoading}
                  className="h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-accent hover:bg-accent/10 transition-colors"
                  title="Share task"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{shareLoading ? "…" : task?.shareToken ? "Shared" : "Share"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors touch-manipulation"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-5 py-4 space-y-5">

                {/* Title */}
                <textarea
                  ref={titleRef}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onBlur={() => save("title", title)}
                  rows={2}
                  placeholder="Task title"
                  className={cn(
                    "w-full resize-none bg-transparent font-bold text-xl leading-snug text-foreground",
                    "placeholder:text-muted-foreground/40 outline-none border-none",
                    isCompleted && "line-through text-muted-foreground"
                  )}
                />

                {/* Share URL banner */}
                <AnimatePresence>
                  {shareUrl && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-accent/8 border border-accent/20">
                        <Share2 className="h-3.5 w-3.5 text-accent shrink-0" />
                        <p className="text-[11px] text-muted-foreground truncate flex-1">{shareUrl}</p>
                        <button
                          onClick={handleCopyLink}
                          className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-accent hover:text-accent/80 transition-colors"
                        >
                          {shareCopied ? <CheckCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          {shareCopied ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Due date (read-only display) */}
                {task.dueDate && !isNaN(new Date(task.dueDate).getTime()) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 flex-shrink-0" />
                    <span>{format(new Date(task.dueDate), "EEEE, MMM d, yyyy")}</span>
                    {task.dueTime && (
                      <>
                        <Clock className="h-4 w-4 flex-shrink-0" />
                        <span className="font-medium">{task.dueTime}</span>
                      </>
                    )}
                  </div>
                )}

                {/* Category */}
                <div className="flex items-start gap-3">
                  <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <input
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    onBlur={() => save("category", category)}
                    placeholder="Category"
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none border-b border-border/40 focus:border-accent/50 pb-1 transition-colors"
                  />
                </div>

                {/* Tags */}
                {tags.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    {tags.map(tag => (
                      <span key={tag} className="text-xs font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Divider */}
                <div className="h-px bg-border/40" />

                {/* Description */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <FileText className="h-3.5 w-3.5" />
                    Description
                  </div>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    onBlur={() => save("description", description)}
                    rows={3}
                    placeholder="Add a description…"
                    className="w-full resize-none bg-transparent text-sm text-foreground leading-relaxed placeholder:text-muted-foreground/40 outline-none"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <StickyNote className="h-3.5 w-3.5" />
                    Notes
                  </div>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    onBlur={() => save("notes", notes)}
                    rows={4}
                    placeholder="Add notes…"
                    className="w-full resize-none bg-muted/30 rounded-xl px-3 py-2.5 text-sm text-foreground leading-relaxed placeholder:text-muted-foreground/40 outline-none focus:bg-muted/50 transition-colors"
                  />
                </div>

                {/* Subtasks */}
                {(task.subtasks && task.subtasks.length > 0 || true) && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <ListChecks className="h-3.5 w-3.5" />
                      Subtasks
                      {task.subtasks && task.subtasks.length > 0 && (
                        <span className="font-bold text-foreground">
                          {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
                        </span>
                      )}
                    </div>
                    <EnhancedSubtaskList
                      subtasks={task.subtasks || []}
                      onToggle={handleSubtaskToggle}
                      onAdd={handleSubtaskAdd}
                      onDelete={handleSubtaskDelete}
                      variant="premium-modern"
                      disabled={isCompleted}
                    />
                  </div>
                )}

                {/* Collaborators section */}
                <div className="space-y-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowCollaborators(v => !v)}
                    className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-full hover:text-foreground transition-colors"
                  >
                    <Users className="h-3.5 w-3.5" />
                    Collaborators
                    {task.collaborators && task.collaborators.length > 0 && (
                      <CollaboratorAvatarGroup collaborators={task.collaborators} />
                    )}
                    {task.isCollaborated && task.ownerName && (
                      <span className="ml-auto flex items-center gap-1 text-[10px] font-normal text-muted-foreground normal-case tracking-normal">
                        <Crown className="h-3 w-3 text-amber-500" />
                        {task.ownerName}
                      </span>
                    )}
                    <ChevronDown className={cn("h-3.5 w-3.5 ml-auto transition-transform", showCollaborators && "rotate-180")} />
                  </button>

                  <AnimatePresence>
                    {showCollaborators && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <CollaboratorPanel
                          taskId={task.id}
                          ownerId={task.ownerId ?? task.id}
                          collaborators={task.collaborators ?? []}
                          onUpdate={() => onUpdate(task.id, {})}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Completion attribution footer */}
                {isCompleted && task.completedByName && (
                  <CompletionSignature
                    name={task.completedByName}
                    image={task.completedByImage}
                    completedAt={task.completedAt}
                    variant="footer"
                  />
                )}

                {/* Timestamps */}
                <div className="flex items-center gap-4 text-[11px] text-muted-foreground/60 pt-2 border-t border-border/30">
                  {task.createdAt && !isNaN(new Date(task.createdAt).getTime()) && (
                    <span>Created {format(new Date(task.createdAt), "MMM d, yyyy")}</span>
                  )}
                  {task.updatedAt && !isNaN(new Date(task.updatedAt).getTime()) && (
                    <span>Updated {format(new Date(task.updatedAt), "MMM d")}</span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
