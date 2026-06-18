import { NextResponse } from "next/server"
import { getValidatedSession } from "@/lib/validate-session"
import { db } from "@/lib/db"
import { tasks, taskCollaborators, users } from "@/lib/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { handleApiError } from "@/lib/errors"
import { sendCollaboratorInviteEmail } from "@/lib/services/email"
import { randomUUID } from "crypto"

// POST /api/tasks/[id]/invite — invite someone by email
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getValidatedSession()
    const { email } = await req.json()

    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 })

    // Only the task owner can invite
    const [task] = await db.select().from(tasks)
      .where(and(eq(tasks.id, params.id), eq(tasks.user_id, session.user.id)))
      .limit(1)
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 })

    // Don't invite yourself
    if (email.toLowerCase() === session.user.email?.toLowerCase()) {
      return NextResponse.json({ error: "You cannot invite yourself" }, { status: 400 })
    }

    // Check if already invited / collaborating
    const existing = await db.execute(sql`
      SELECT tc.id, tc.invite_status, u.email
      FROM task_collaborators tc
      LEFT JOIN users u ON u.id = tc.user_id
      WHERE tc.task_id = ${params.id}
        AND (u.email = ${email} OR tc.invited_email = ${email})
      LIMIT 1
    `)
    if (existing.rows.length > 0) {
      const row = existing.rows[0] as { invite_status: string }
      if (row.invite_status === "accepted") {
        return NextResponse.json({ error: "This person is already a collaborator" }, { status: 400 })
      }
      if (row.invite_status === "pending") {
        return NextResponse.json({ error: "Invite already sent to this email" }, { status: 400 })
      }
    }

    // Check if the email belongs to an existing user
    const [existingUser] = await db.select({ id: users.id, name: users.name })
      .from(users).where(eq(users.email, email)).limit(1)

    const inviteToken = randomUUID()

    await db.insert(taskCollaborators).values({
      task_id: params.id,
      user_id: existingUser?.id ?? null,
      invited_email: email,
      invite_token: inviteToken,
      invite_status: "pending",
      role: "collaborator",
    })

    // Send invite email
    const appUrl = process.env.NEXTAUTH_URL ?? "https://task-master-quick.vercel.app"
    await sendCollaboratorInviteEmail({
      to: email,
      recipientName: existingUser?.name ?? undefined,
      senderName: session.user.name ?? "Someone",
      taskTitle: task.title,
      taskDescription: task.description ?? undefined,
      inviteUrl: `${appUrl}/invite/${inviteToken}`,
      hasAccount: !!existingUser,
    })

    return NextResponse.json({ success: true, invited: email })
  } catch (e) {
    return handleApiError(e)
  }
}

// GET /api/tasks/[id]/invite — list all collaborators for a task
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getValidatedSession()

    // Must be owner or collaborator
    const [task] = await db.select({ id: tasks.id, user_id: tasks.user_id })
      .from(tasks).where(eq(tasks.id, params.id)).limit(1)
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const isOwner = task.user_id === session.user.id
    if (!isOwner) {
      const [collab] = await db.select({ id: taskCollaborators.id })
        .from(taskCollaborators)
        .where(and(
          eq(taskCollaborators.task_id, params.id),
          eq(taskCollaborators.user_id, session.user.id)
        )).limit(1)
      if (!collab) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const collabs = await db.execute(sql`
      SELECT tc.id, tc.user_id, tc.invited_email, tc.invite_status, tc.role, tc.accepted_at,
             u.name, u.image, u.email
      FROM task_collaborators tc
      LEFT JOIN users u ON u.id = tc.user_id
      WHERE tc.task_id = ${params.id}
      ORDER BY tc.invited_at
    `)

    return NextResponse.json(collabs.rows)
  } catch (e) {
    return handleApiError(e)
  }
}

// DELETE /api/tasks/[id]/invite — remove a collaborator
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getValidatedSession()
    const { collaboratorId } = await req.json()

    const [task] = await db.select({ user_id: tasks.user_id })
      .from(tasks).where(eq(tasks.id, params.id)).limit(1)
    if (!task || task.user_id !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await db.delete(taskCollaborators)
      .where(and(
        eq(taskCollaborators.id, collaboratorId),
        eq(taskCollaborators.task_id, params.id)
      ))

    return NextResponse.json({ success: true })
  } catch (e) {
    return handleApiError(e)
  }
}
