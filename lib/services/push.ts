import webpush from "web-push"
import { db } from "@/lib/db"
import { sql } from "drizzle-orm"

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT ?? "mailto:admin@taskmaster.app",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
  process.env.VAPID_PRIVATE_KEY ?? ""
)

interface PushPayload {
  title: string
  body: string
  taskId?: string
  type?: string
  icon?: string
}

// Send a push notification to all subscriptions for a user
export async function sendPushToUser(userId: string, payload: PushPayload) {
  const rows = await db.execute(sql`
    SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ${userId}
  `)

  const results = await Promise.allSettled(
    rows.rows.map((row: Record<string, unknown>) =>
      webpush.sendNotification(
        {
          endpoint: row.endpoint as string,
          keys: { p256dh: row.p256dh as string, auth: row.auth as string },
        },
        JSON.stringify(payload)
      ).catch(async (err) => {
        // 410 Gone = subscription expired, remove it
        if (err.statusCode === 410) {
          await db.execute(sql`DELETE FROM push_subscriptions WHERE endpoint = ${row.endpoint}`)
        }
        throw err
      })
    )
  )

  return results
}

// Send push for a task event
export async function sendTaskPush(
  userId: string,
  type: "due-soon" | "overdue" | "shared" | "completed",
  taskTitle: string,
  taskId: string
) {
  const messages = {
    "due-soon":  { title: "⏰ Task due soon",   body: `"${taskTitle}" is coming up` },
    "overdue":   { title: "⚠️ Task overdue",    body: `"${taskTitle}" is past its deadline` },
    "shared":    { title: "🔗 Task shared",     body: `Someone shared a task with you: "${taskTitle}"` },
    "completed": { title: "✅ Task complete",   body: `"${taskTitle}" was marked complete` },
  }
  const msg = messages[type]
  return sendPushToUser(userId, { ...msg, taskId, type })
}
