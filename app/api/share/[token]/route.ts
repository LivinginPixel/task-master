import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { tasks, taskCollaborators, users } from "@/lib/db/schema"
import { eq, count, and, sql } from "drizzle-orm"
import { handleApiError } from "@/lib/errors"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { sendTaskPush } from "@/lib/services/push"

// GET /api/share/[token] — public, returns task + subtasks with completer info
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  try {
    const [task] = await db.select().from(tasks).where(eq(tasks.share_token, params.token)).limit(1)
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const subs = await db.execute(sql`
      SELECT st.*, u.name as completed_by_name, u.image as completed_by_image
      FROM subtasks st
      LEFT JOIN users u ON u.id = st.completed_by
      WHERE st.task_id = ${task.id}
      ORDER BY st.position, st.created_at
    `)

    const [colCount] = await db.select({ count: count() }).from(taskCollaborators)
      .where(and(eq(taskCollaborators.task_id, task.id), eq(taskCollaborators.invite_status, "accepted")))
    const [owner] = await db.select({ name: users.name, image: users.image })
      .from(users).where(eq(users.id, task.user_id))

    return NextResponse.json({
      task: { ...task, subtasks: subs.rows },
      owner,
      collaboratorCount: Number(colCount?.count ?? 0),
    })
  } catch (e) {
    return handleApiError(e)
  }
}

// POST /api/share/[token] — auth required, join as accepted collaborator
export async function POST(_req: Request, { params }: { params: { token: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 })

    const [task] = await db.select().from(tasks).where(eq(tasks.share_token, params.token)).limit(1)
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (task.user_id === session.user.id) {
      return NextResponse.json({ alreadyOwner: true, taskId: task.id })
    }

    // Check if already a collaborator
    const existing = await db.select({ id: taskCollaborators.id, invite_status: taskCollaborators.invite_status })
      .from(taskCollaborators)
      .where(and(eq(taskCollaborators.task_id, task.id), eq(taskCollaborators.user_id, session.user.id)))
      .limit(1)

    if (existing.length > 0) {
      // Already joined — just redirect
      return NextResponse.json({ success: true, taskId: task.id, alreadyJoined: true })
    }

    // Create accepted collaborator record (no pending step — user actively clicked join)
    await db.insert(taskCollaborators).values({
      task_id: task.id,
      user_id: session.user.id,
      invited_email: session.user.email ?? null,
      invite_status: "accepted",
      accepted_at: new Date(),
      role: "collaborator",
    })

    // Notify owner
    sendTaskPush(task.user_id, "shared", task.title, task.id).catch(() => {})

    return NextResponse.json({ success: true, taskId: task.id })
  } catch (e) {
    return handleApiError(e)
  }
}
