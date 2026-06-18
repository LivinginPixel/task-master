import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { tasks, subtasks, taskCollaborators, users } from "@/lib/db/schema"
import { eq, count } from "drizzle-orm"
import { handleApiError } from "@/lib/errors"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { sendTaskPush } from "@/lib/services/push"

// GET /api/share/[token] — public, returns task data
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  try {
    const [task] = await db.select().from(tasks).where(eq(tasks.share_token, params.token)).limit(1)
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const subs = await db.select().from(subtasks).where(eq(subtasks.task_id, task.id))
    const [colCount] = await db.select({ count: count() }).from(taskCollaborators).where(eq(taskCollaborators.task_id, task.id))
    const [owner] = await db.select({ name: users.name, image: users.image }).from(users).where(eq(users.id, task.user_id))

    return NextResponse.json({
      task: { ...task, subtasks: subs },
      owner,
      collaboratorCount: Number(colCount?.count ?? 0),
    })
  } catch (e) {
    return handleApiError(e)
  }
}

// PATCH /api/share/[token] — auth required, update task (collaborator or owner)
export async function PATCH(req: Request, { params }: { params: { token: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in to update this task" }, { status: 401 })

    const [task] = await db.select().from(tasks).where(eq(tasks.share_token, params.token)).limit(1)
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const body = await req.json()
    const now = new Date()

    await db.update(tasks)
      .set({ ...body, updated_at: now })
      .where(eq(tasks.id, task.id))

    // Track collaborator (user other than owner)
    if (session.user.id !== task.user_id) {
      await db.insert(taskCollaborators)
        .values({ task_id: task.id, user_id: session.user.id })
        .onConflictDoNothing()
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    return handleApiError(e)
  }
}

// POST /api/share/[token] — auth required, join as collaborator + copy to dashboard
export async function POST(_req: Request, { params }: { params: { token: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 })

    const [task] = await db.select().from(tasks).where(eq(tasks.share_token, params.token)).limit(1)
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (task.user_id === session.user.id) {
      return NextResponse.json({ error: "You own this task" }, { status: 400 })
    }

    await db.insert(taskCollaborators)
      .values({ task_id: task.id, user_id: session.user.id })
      .onConflictDoNothing()

    // Notify task owner via push
    const [joiner] = await db.select({ name: users.name }).from(users).where(eq(users.id, session.user.id)).limit(1)
    sendTaskPush(task.user_id, "shared", task.title, task.id).catch(() => {})
    void joiner // referenced to avoid lint warning

    return NextResponse.json({ success: true, taskId: task.id })
  } catch (e) {
    return handleApiError(e)
  }
}
