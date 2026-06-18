"use client"

import { useEffect, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { format } from "date-fns"
import {
  CheckCircle2, Circle, Calendar, Clock, Tag, Users,
  ExternalLink, UserPlus, Share2, ArrowRight, Loader2, CheckSquare,
} from "lucide-react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { CompletionSignature } from "@/components/completion-signature"
import Link from "next/link"

interface SubtaskRow {
  id: string
  title: string
  completed: boolean
  completed_by_name?: string | null
  completed_by_image?: string | null
  completed_at?: string | null
}

interface SharedTask {
  id: string
  title: string
  description: string | null
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  status: "PENDING" | "COMPLETED" | "OVERDUE"
  due_date: string | null
  due_time: string | null
  tags: string[] | null
  subtasks: SubtaskRow[]
  completed_by_name?: string | null
  completed_by_image?: string | null
  completed_at?: string | null
}

const PRIORITY_CONFIG = {
  URGENT: { label: "Urgent", color: "bg-red-500",    text: "text-red-600 dark:text-red-400",    border: "border-red-200 dark:border-red-800" },
  HIGH:   { label: "High",   color: "bg-orange-500", text: "text-orange-600 dark:text-orange-400", border: "border-orange-200 dark:border-orange-800" },
  MEDIUM: { label: "Medium", color: "bg-accent",     text: "text-accent",                       border: "border-accent/30" },
  LOW:    { label: "Low",    color: "bg-gray-400",   text: "text-gray-500",                     border: "border-gray-200 dark:border-gray-700" },
}

export function SharedTaskView({ token }: { token: string }) {
  const { data: session } = useSession()
  const router = useRouter()
  const [task, setTask] = useState<SharedTask | null>(null)
  const [owner, setOwner] = useState<{ name: string | null; image: string | null } | null>(null)
  const [collaboratorCount, setCollaboratorCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [joining, setJoining] = useState(false)

  const fetchTask = useCallback(async () => {
    const res = await fetch(`/api/share/${token}`)
    if (!res.ok) { setNotFound(true); setLoading(false); return }
    const data = await res.json()
    setTask(data.task)
    setOwner(data.owner)
    setCollaboratorCount(data.collaboratorCount)
    setLoading(false)
  }, [token])

  useEffect(() => { fetchTask() }, [fetchTask])

  const handleJoin = async () => {
    if (!session) return
    setJoining(true)
    const res = await fetch(`/api/share/${token}`, { method: "POST" })
    const data = await res.json()
    setJoining(false)
    if (data.taskId) {
      router.push(`/dashboard?task=${data.taskId}`)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
    </div>
  )

  if (notFound) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
      <Share2 className="h-12 w-12 text-muted-foreground/40" />
      <h1 className="text-xl font-bold">Link not found</h1>
      <p className="text-muted-foreground text-sm text-center">This share link may have been revoked or doesn&apos;t exist.</p>
      <Link href="/" className="text-sm text-accent underline underline-offset-4">Go home</Link>
    </div>
  )

  if (!task) return null

  const priority = PRIORITY_CONFIG[task.priority]
  const isCompleted = task.status === "COMPLETED"
  const subtasks = task.subtasks ?? []
  const completedSubs = subtasks.filter(s => s.completed).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 pb-16">
      {/* Minimal header — no global nav on this route */}
      <div className="sticky top-0 z-10 border-b border-border/40 bg-background/95 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-1.5 flex-shrink-0 hover:opacity-80 transition-opacity">
            <CheckSquare className="h-4 w-4 text-accent" />
            <span className="font-bold text-sm">Task Master</span>
          </Link>

          {!session ? (
            <Link
              href={`/auth/sign-in?callbackUrl=/share/${token}`}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-accent text-accent-foreground hover:opacity-90 transition-opacity"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Sign in to join
            </Link>
          ) : (
            <button
              onClick={handleJoin}
              disabled={joining}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-accent text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {joining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
              {joining ? "Opening…" : "Open on my dashboard"}
            </button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-8 space-y-6">
        {/* Shared by */}
        {owner && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-muted-foreground flex items-center gap-1.5"
          >
            {owner.image && <img src={owner.image} className="h-4 w-4 rounded-full" alt="" />}
            Shared by <span className="font-semibold text-foreground">{owner.name ?? "someone"}</span>
            {collaboratorCount > 0 && (
              <span className="ml-2 flex items-center gap-1">
                <Users className="h-3 w-3" />
                {collaboratorCount} collaborator{collaboratorCount > 1 ? "s" : ""}
              </span>
            )}
          </motion.p>
        )}

        {/* Task card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className={cn("rounded-3xl border bg-card p-6 space-y-5 shadow-sm", priority.border)}
        >
          {/* Priority + Status */}
          <div className="flex items-center gap-2">
            <div className={cn("h-2.5 w-2.5 rounded-full", priority.color)} />
            <span className={cn("text-xs font-bold uppercase tracking-wider", priority.text)}>{priority.label}</span>
            {isCompleted && (
              <span className="ml-auto text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Completed
              </span>
            )}
            {task.status === "OVERDUE" && !isCompleted && (
              <span className="ml-auto text-xs font-bold text-red-500">Overdue</span>
            )}
          </div>

          {/* Title */}
          <h1 className={cn("text-2xl font-extrabold leading-tight tracking-tight", isCompleted && "line-through text-muted-foreground")}>
            {task.title}
          </h1>

          {/* Task completion attribution */}
          {isCompleted && task.completed_by_name && (
            <CompletionSignature
              name={task.completed_by_name}
              image={task.completed_by_image}
              completedAt={task.completed_at ?? undefined}
              variant="footer"
            />
          )}

          {/* Description */}
          {task.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{task.description}</p>
          )}

          {/* Meta */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            {task.due_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {format(new Date(task.due_date), "EEE, MMM d, yyyy")}
              </span>
            )}
            {task.due_time && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {task.due_time}
              </span>
            )}
            {task.tags?.filter(Boolean).map(tag => (
              <span key={tag} className="flex items-center gap-1 text-accent">
                <Tag className="h-3 w-3" />#{tag}
              </span>
            ))}
          </div>

          {/* Subtasks — read-only preview with completer avatars */}
          {subtasks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subtasks</p>
                <span className="text-xs font-bold text-foreground">{completedSubs}/{subtasks.length}</span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-accent"
                  initial={{ width: 0 }}
                  animate={{ width: subtasks.length > 0 ? `${(completedSubs / subtasks.length) * 100}%` : "0%" }}
                  transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
                />
              </div>
              <div className="space-y-1 pt-1">
                {subtasks.map(sub => (
                  <div
                    key={sub.id}
                    className="flex items-start gap-3 p-2.5 rounded-xl"
                  >
                    <AnimatePresence mode="wait">
                      {sub.completed ? (
                        <motion.div key="done" initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="mt-0.5">
                          <CheckCircle2 className="h-4 w-4 text-accent shrink-0" />
                        </motion.div>
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5" />
                      )}
                    </AnimatePresence>
                    <div className="flex-1 min-w-0">
                      <span className={cn("text-sm block", sub.completed && "line-through text-muted-foreground")}>
                        {sub.title}
                      </span>
                      {sub.completed && sub.completed_by_name && (
                        <CompletionSignature
                          name={sub.completed_by_name}
                          image={sub.completed_by_image}
                          completedAt={sub.completed_at ?? undefined}
                          variant="inline"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Join CTA */}
          <AnimatePresence>
            {!isCompleted && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="pt-1"
              >
                {session ? (
                  <button
                    onClick={handleJoin}
                    disabled={joining}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-accent text-accent-foreground font-semibold text-sm hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50"
                  >
                    {joining ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                    {joining ? "Adding to your dashboard…" : "Join & manage on your dashboard"}
                  </button>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border p-5 text-center space-y-3">
                    <p className="text-sm font-semibold">{owner?.name ?? "Someone"} invited you to collaborate</p>
                    <p className="text-xs text-muted-foreground">Sign in to join this task. It will appear on your dashboard where you can mark subtasks, add notes, and track progress together.</p>
                    <Link
                      href={`/auth/sign-in?callbackUrl=/share/${token}`}
                      className="inline-flex items-center gap-1.5 mt-1 text-xs font-bold px-5 py-2.5 rounded-full bg-accent text-accent-foreground hover:opacity-90 transition-opacity"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Sign in to join
                    </Link>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {isCompleted && (
            <div className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              This task is complete
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
