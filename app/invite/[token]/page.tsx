"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession, signIn } from "next-auth/react"
import { motion } from "framer-motion"
import { CheckCircle, XCircle, Loader2, Users, CheckSquare } from "lucide-react"
import Link from "next/link"

interface InviteData {
  invite: { id: string; invited_email: string; invite_status: string }
  task: { id: string; title: string; description?: string; priority: string; status: string }
  owner: { name: string; image: string }
}

export default function InvitePage({ params }: { params: { token: string } }) {
  const { status: authStatus } = useSession()
  const router = useRouter()
  const [data, setData] = useState<InviteData | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "accepted" | "error">("loading")
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch(`/api/invite/${params.token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setState("error") }
        else { setData(d); setState("ready") }
      })
      .catch(() => { setError("Failed to load invite"); setState("error") })
  }, [params.token])

  const accept = async () => {
    if (authStatus !== "authenticated") {
      signIn(undefined, { callbackUrl: `/invite/${params.token}` })
      return
    }
    setAccepting(true)
    const res = await fetch(`/api/invite/${params.token}`, { method: "POST" })
    const d = await res.json()
    if (d.success) {
      setState("accepted")
      setTimeout(() => router.push(`/dashboard?task=${d.taskId}`), 1800)
    } else {
      setAccepting(false)
      setError(d.error ?? "Failed to accept invite")
      setState("error")
    }
  }

  const decline = async () => {
    await fetch(`/api/invite/${params.token}`, { method: "DELETE" })
    router.push("/")
  }

  const PRIORITY_COLOR: Record<string, string> = {
    URGENT: "bg-red-100 text-red-700",
    HIGH: "bg-orange-100 text-orange-700",
    MEDIUM: "bg-blue-100 text-blue-700",
    LOW: "bg-gray-100 text-gray-500",
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Minimal nav — global header is suppressed on /invite/* */}
      <div className="border-b border-border/40 bg-background/95 backdrop-blur-xl">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center">
          <Link href="/" className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
            <CheckSquare className="h-4 w-4 text-accent" />
            <span className="font-bold text-sm">Task Master</span>
          </Link>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >

        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg">

          {/* State: loading */}
          {(state === "loading" || authStatus === "loading") && (
            <div className="p-12 flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
              <p className="text-sm text-muted-foreground">Loading invite…</p>
            </div>
          )}

          {/* State: error */}
          {state === "error" && (
            <div className="p-10 flex flex-col items-center gap-3 text-center">
              <XCircle className="h-10 w-10 text-destructive" />
              <h2 className="font-bold text-lg">Invite unavailable</h2>
              <p className="text-sm text-muted-foreground">{error}</p>
              <button onClick={() => router.push("/")} className="mt-2 text-sm text-accent underline">Go home</button>
            </div>
          )}

          {/* State: accepted */}
          {state === "accepted" && (
            <div className="p-10 flex flex-col items-center gap-3 text-center">
              <CheckCircle className="h-10 w-10 text-green-500" />
              <h2 className="font-bold text-lg">You're in!</h2>
              <p className="text-sm text-muted-foreground">Taking you to the task…</p>
            </div>
          )}

          {/* State: ready */}
          {state === "ready" && data && (
            <>
              {/* Purple header bar */}
              <div className="bg-accent px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white/80 text-xs font-medium">Collaboration invite from</p>
                    <p className="text-white font-bold text-sm">{data.owner.name}</p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wide mb-2">Task</p>

                {/* Task card */}
                <div className="border border-border rounded-xl p-4 mb-5">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-bold text-foreground leading-tight">{data.task.title}</h3>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${PRIORITY_COLOR[data.task.priority] ?? ""}`}>
                      {data.task.priority}
                    </span>
                  </div>
                  {data.task.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{data.task.description}</p>
                  )}
                </div>

                <p className="text-sm text-muted-foreground mb-5">
                  {authStatus === "authenticated"
                    ? `Accepting will add this task to your dashboard as a shared task.`
                    : `Sign in to accept this invite and add the task to your dashboard.`}
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={accept}
                    disabled={accepting}
                    className="flex-1 flex items-center justify-center gap-2 bg-accent text-accent-foreground font-bold py-2.5 px-4 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60"
                  >
                    {accepting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {authStatus !== "authenticated" ? "Sign in to accept" : "Accept invite"}
                  </button>
                  <button
                    onClick={decline}
                    className="px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
                  >
                    Decline
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
      </div>
    </div>
  )
}
