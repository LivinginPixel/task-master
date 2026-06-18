import { NextResponse } from "next/server"
import { getValidatedSession } from "@/lib/validate-session"
import { db } from "@/lib/db"
import { subtasks, tasks, users } from "@/lib/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { handleApiError } from "@/lib/errors"
import { sendTaskPush } from "@/lib/services/push"

// PATCH /api/tasks/[id]/subtasks/[subtaskId] — update subtask (complete, assign, rename)
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; subtaskId: string } }
) {
  try {
    const session = await getValidatedSession()
    const body = await req.json()

    // Verify user is owner or accepted collaborator
    const access = await db.execute(sql`
      SELECT t.user_id, tc.user_id as collab_user_id
      FROM tasks t
      LEFT JOIN task_collaborators tc ON tc.task_id = t.id
        AND tc.user_id = ${session.user.id}
        AND tc.invite_status = 'accepted'
      WHERE t.id = ${params.id}
      LIMIT 1
    `)
    if (!access.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const row = access.rows[0] as { user_id: string; collab_user_id: string | null }
    const isOwner = row.user_id === session.user.id
    const isCollab = !!row.collab_user_id
    if (!isOwner && !isCollab) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const updateData: Partial<typeof subtasks.$inferInsert> = {
      updated_at: new Date(),
    }
    if (body.title !== undefined) updateData.title = body.title
    if (body.completed !== undefined) updateData.completed = body.completed
    if (body.assignedTo !== undefined) updateData.assigned_to = body.assignedTo || null

    await db.update(subtasks)
      .set(updateData)
      .where(and(eq(subtasks.id, params.subtaskId), eq(subtasks.task_id, params.id)))

    // If collaborator completed a subtask, notify owner
    if (!isOwner && body.completed) {
      const [task] = await db.select({ title: tasks.title, user_id: tasks.user_id })
        .from(tasks).where(eq(tasks.id, params.id)).limit(1)
      const [me] = await db.select({ name: users.name }).from(users)
        .where(eq(users.id, session.user.id)).limit(1)
      sendTaskPush(task.user_id, "completed", `${task.title} — subtask by ${me?.name ?? "collaborator"}`, params.id).catch(() => {})
    }

    // Return updated subtask with assignee info
    const updated = await db.execute(sql`
      SELECT st.*, u.name as assignee_name, u.image as assignee_image
      FROM subtasks st
      LEFT JOIN users u ON u.id = st.assigned_to
      WHERE st.id = ${params.subtaskId}
    `)

    return NextResponse.json(updated.rows[0])
  } catch (e) {
    return handleApiError(e)
  }
}

// DELETE /api/tasks/[id]/subtasks/[subtaskId]
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; subtaskId: string } }
) {
  try {
    const session = await getValidatedSession()

    const [task] = await db.select({ user_id: tasks.user_id })
      .from(tasks).where(eq(tasks.id, params.id)).limit(1)
    if (!task || task.user_id !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await db.delete(subtasks)
      .where(and(eq(subtasks.id, params.subtaskId), eq(subtasks.task_id, params.id)))

    return NextResponse.json({ success: true })
  } catch (e) {
    return handleApiError(e)
  }
}
