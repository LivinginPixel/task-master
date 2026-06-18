import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { taskCollaborators, tasks, users } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { handleApiError } from "@/lib/errors"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { sendTaskPush } from "@/lib/services/push"

// GET — fetch invite details (public, for the invite page to show task info)
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  try {
    const [invite] = await db.select({
      id: taskCollaborators.id,
      task_id: taskCollaborators.task_id,
      invited_email: taskCollaborators.invited_email,
      invite_status: taskCollaborators.invite_status,
    }).from(taskCollaborators)
      .where(eq(taskCollaborators.invite_token, params.token))
      .limit(1)

    if (!invite) return NextResponse.json({ error: "Invalid or expired invite" }, { status: 404 })
    if (invite.invite_status === "accepted") return NextResponse.json({ error: "Already accepted" }, { status: 410 })

    const [task] = await db.select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      priority: tasks.priority,
      status: tasks.status,
      due_date: tasks.due_date,
      user_id: tasks.user_id,
    }).from(tasks).where(eq(tasks.id, invite.task_id)).limit(1)

    const [owner] = await db.select({ name: users.name, image: users.image })
      .from(users).where(eq(users.id, task.user_id)).limit(1)

    return NextResponse.json({ invite, task, owner })
  } catch (e) {
    return handleApiError(e)
  }
}

// POST — accept the invite (requires auth)
export async function POST(_req: Request, { params }: { params: { token: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sign in required", requiresAuth: true }, { status: 401 })
    }

    const [invite] = await db.select()
      .from(taskCollaborators)
      .where(eq(taskCollaborators.invite_token, params.token))
      .limit(1)

    if (!invite) return NextResponse.json({ error: "Invalid or expired invite" }, { status: 404 })
    if (invite.invite_status === "accepted") return NextResponse.json({ error: "Already accepted" }, { status: 410 })

    const [task] = await db.select({ id: tasks.id, title: tasks.title, user_id: tasks.user_id })
      .from(tasks).where(eq(tasks.id, invite.task_id)).limit(1)

    if (task.user_id === session.user.id) {
      return NextResponse.json({ error: "You own this task" }, { status: 400 })
    }

    // Check if this user already collaborates on this task via another route
    const [alreadyCollab] = await db.select({ id: taskCollaborators.id })
      .from(taskCollaborators)
      .where(and(
        eq(taskCollaborators.task_id, invite.task_id),
        eq(taskCollaborators.user_id, session.user.id)
      )).limit(1)

    if (alreadyCollab && alreadyCollab.id !== invite.id) {
      // Update the invite record to accepted and remove the duplicate
      await db.delete(taskCollaborators).where(eq(taskCollaborators.id, invite.id))
    } else {
      // Accept the invite — link to the actual user account
      await db.update(taskCollaborators)
        .set({
          user_id: session.user.id,
          invite_status: "accepted",
          accepted_at: new Date(),
        })
        .where(eq(taskCollaborators.invite_token, params.token))
    }

    // Notify task owner
    sendTaskPush(task.user_id, "shared", task.title, task.id).catch(() => {})

    return NextResponse.json({ success: true, taskId: task.id })
  } catch (e) {
    return handleApiError(e)
  }
}

// DELETE — decline the invite
export async function DELETE(_req: Request, { params }: { params: { token: string } }) {
  try {
    await db.update(taskCollaborators)
      .set({ invite_status: "declined" })
      .where(eq(taskCollaborators.invite_token, params.token))
    return NextResponse.json({ success: true })
  } catch (e) {
    return handleApiError(e)
  }
}
