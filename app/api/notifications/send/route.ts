import { NextResponse } from "next/server"
import { getValidatedSession } from "@/lib/validate-session"
import { sendTaskReminderEmail, sendTaskOverdueEmail } from "@/lib/services/email"
import { sendTaskPush } from "@/lib/services/push"
import { db } from "@/lib/db"
import { tasks, users } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { handleApiError } from "@/lib/errors"

// Internal endpoint to trigger notifications for a task
export async function POST(req: Request) {
  try {
    const session = await getValidatedSession()
    const { taskId, type } = await req.json()

    const [task] = await db.select().from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.user_id, session.user.id)))
      .limit(1)
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 })

    const [user] = await db.select({ name: users.name, email: users.email, notifications_enabled: users.notifications_enabled })
      .from(users).where(eq(users.id, session.user.id)).limit(1)

    if (!user?.notifications_enabled) return NextResponse.json({ skipped: true })

    // Push notification
    await sendTaskPush(session.user.id, type, task.title, task.id).catch(() => {})

    // Email notification
    if (user.email) {
      if (type === "due-soon") {
        await sendTaskReminderEmail({
          to: user.email,
          userName: user.name ?? "there",
          taskTitle: task.title,
          taskId: task.id,
          dueTime: task.due_time ?? "soon",
          minutesBefore: 30,
        }).catch(() => {})
      } else if (type === "overdue") {
        await sendTaskOverdueEmail({
          to: user.email,
          userName: user.name ?? "there",
          taskTitle: task.title,
          taskId: task.id,
        }).catch(() => {})
      }
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    return handleApiError(e)
  }
}
