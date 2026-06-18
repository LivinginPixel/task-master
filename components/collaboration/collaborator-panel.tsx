"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { UserPlus, Mail, X, Clock, CheckCircle2, Loader2, Crown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Collaborator } from "@/lib/types"
import { useSession } from "next-auth/react"

interface CollaboratorPanelProps {
  taskId: string
  ownerId: string
  collaborators: Collaborator[]
  onUpdate: () => void
}

export function CollaboratorPanel({ taskId, ownerId, collaborators, onUpdate }: CollaboratorPanelProps) {
  const { data: session } = useSession()
  const [email, setEmail] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const isOwner = session?.user?.id === ownerId

  const sendInvite = async () => {
    if (!email.trim()) return
    setSending(true)
    setError("")
    setSuccess("")

    const res = await fetch(`/api/tasks/${taskId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    })
    const data = await res.json()
    setSending(false)

    if (data.success) {
      setSuccess(`Invite sent to ${email}`)
      setEmail("")
      onUpdate()
    } else {
      setError(data.error ?? "Failed to send invite")
    }
  }

  const removeCollaborator = async (collaboratorId: string) => {
    await fetch(`/api/tasks/${taskId}/invite`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collaboratorId }),
    })
    onUpdate()
  }

  const accepted = collaborators.filter(c => c.inviteStatus === "accepted")
  const pending = collaborators.filter(c => c.inviteStatus === "pending")

  return (
    <div className="space-y-4">
      {/* Invite form — only owner can invite */}
      {isOwner && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                placeholder="Email address…"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(""); setSuccess("") }}
                onKeyDown={e => e.key === "Enter" && sendInvite()}
                className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
            <button
              onClick={sendInvite}
              disabled={sending || !email.trim()}
              className="flex items-center gap-1.5 px-3 py-2 bg-accent text-accent-foreground text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Invite
            </button>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-xs text-destructive">{error}</motion.p>
            )}
            {success && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-xs text-green-600 dark:text-green-400">{success}</motion.p>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Active collaborators */}
      {accepted.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Collaborators</p>
          {accepted.map(c => (
            <div key={c.id} className="flex items-center gap-2.5 py-1.5">
              <Avatar name={c.name} image={c.image} size={28} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{c.name ?? c.invitedEmail}</p>
                {c.name && c.invitedEmail && (
                  <p className="text-xs text-muted-foreground truncate">{c.invitedEmail}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                <span className="text-[11px] text-muted-foreground">Active</span>
              </div>
              {isOwner && (
                <button onClick={() => removeCollaborator(c.id)}
                  className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pending invites */}
      {pending.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Pending</p>
          {pending.map(c => (
            <div key={c.id} className="flex items-center gap-2.5 py-1.5 opacity-60">
              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{c.invitedEmail}</p>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-[11px] text-muted-foreground">Pending</span>
              </div>
              {isOwner && (
                <button onClick={() => removeCollaborator(c.id)}
                  className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {accepted.length === 0 && pending.length === 0 && !isOwner && (
        <p className="text-sm text-muted-foreground">No collaborators yet.</p>
      )}
    </div>
  )
}

function Avatar({ name, image, size = 32 }: { name?: string | null; image?: string | null; size?: number }) {
  const initials = name ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "?"
  return image ? (
    <img src={image} alt={name ?? ""} width={size} height={size}
      className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />
  ) : (
    <div className="rounded-full bg-accent/20 text-accent font-bold flex items-center justify-center flex-shrink-0 text-[11px]"
      style={{ width: size, height: size }}>
      {initials}
    </div>
  )
}

export function CollaboratorAvatarGroup({ collaborators, max = 3 }: { collaborators: Collaborator[]; max?: number }) {
  const accepted = collaborators.filter(c => c.inviteStatus === "accepted")
  if (accepted.length === 0) return null
  const visible = accepted.slice(0, max)
  const overflow = accepted.length - max

  return (
    <div className="flex items-center">
      {visible.map((c, i) => (
        <div key={c.id} className={cn("relative", i > 0 && "-ml-2")} style={{ zIndex: max - i }}>
          <Avatar name={c.name} image={c.image} size={20} />
        </div>
      ))}
      {overflow > 0 && (
        <div className="-ml-2 h-5 w-5 rounded-full bg-muted border border-background text-[10px] font-bold text-muted-foreground flex items-center justify-center">
          +{overflow}
        </div>
      )}
    </div>
  )
}

export function SubtaskAssignMenu({
  collaborators,
  ownerId,
  ownerName,
  ownerImage,
  currentAssigneeId,
  onAssign,
}: {
  collaborators: Collaborator[]
  ownerId: string
  ownerName?: string | null
  ownerImage?: string | null
  currentAssigneeId?: string | null
  onAssign: (userId: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const accepted = collaborators.filter(c => c.inviteStatus === "accepted" && c.userId)
  const people = [
    { userId: ownerId, name: ownerName ?? "Owner", image: ownerImage, isOwner: true },
    ...accepted.map(c => ({ userId: c.userId!, name: c.name ?? c.invitedEmail ?? "?", image: c.image, isOwner: false })),
  ]

  const current = people.find(p => p.userId === currentAssigneeId)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {current ? (
          <>
            <Avatar name={current.name} image={current.image} size={16} />
            <span className="max-w-[60px] truncate">{current.name?.split(" ")[0]}</span>
          </>
        ) : (
          <>
            <UserPlus className="h-3 w-3" />
            <span>Assign</span>
          </>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            className="absolute bottom-full left-0 mb-1 bg-popover border border-border rounded-xl shadow-lg p-1 z-50 min-w-[140px]"
          >
            <button
              onClick={() => { onAssign(null); setOpen(false) }}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted rounded-lg"
            >
              <X className="h-3 w-3" /> Unassign
            </button>
            {people.map(p => (
              <button
                key={p.userId}
                onClick={() => { onAssign(p.userId); setOpen(false) }}
                className={cn(
                  "flex items-center gap-2 w-full px-2 py-1.5 text-xs hover:bg-muted rounded-lg",
                  currentAssigneeId === p.userId && "bg-accent/10 text-accent font-semibold"
                )}
              >
                <Avatar name={p.name} image={p.image} size={18} />
                <span className="truncate">{p.name?.split(" ")[0]}</span>
                {p.isOwner && <Crown className="h-3 w-3 text-amber-500 ml-auto" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
