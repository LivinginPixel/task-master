import { NextResponse } from "next/server"
import { sendTaskReminderEmail, sendTaskOverdueEmail, sendSharedTaskEmail } from "@/lib/services/email"
import { sendPushToUser } from "@/lib/services/push"
import { handleApiError } from "@/lib/errors"

// Only available in development
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 })
  }

  try {
    const { type, email, userId, name: bodyName } = await req.json()
    const to = email || "luckyarchibong.e+claude@gmail.com"
    const name = bodyName || "James"
    const fakeTaskId = "00000000-0000-0000-0000-000000000001"

    if (type === "push") {
      if (!userId) return NextResponse.json({ error: "userId required for push test" }, { status: 400 })
      await sendPushToUser(userId, {
        title: "🔔 Test notification",
        body: "This is a test push from TaskMaster",
        taskId: fakeTaskId,
        type: "due-soon",
      })
      return NextResponse.json({ ok: true, sent: "push" })
    }

    if (type === "email-reminder") {
      const result = await sendTaskReminderEmail({
        to,
        userName: name,
        taskTitle: "Complete project proposal",
        taskId: fakeTaskId,
        dueTime: "3:00 PM",
        minutesBefore: 30,
      })
      return NextResponse.json({ ok: true, sent: "email-reminder", id: result.data?.id, error: result.error })
    }

    if (type === "email-overdue") {
      const result = await sendTaskOverdueEmail({
        to,
        userName: name,
        taskTitle: "Submit quarterly report",
        taskId: fakeTaskId,
      })
      return NextResponse.json({ ok: true, sent: "email-overdue", id: result.data?.id, error: result.error })
    }

    if (type === "email-shared") {
      const result = await sendSharedTaskEmail({
        to,
        recipientName: name,
        senderName: "Alex Chen",
        taskTitle: "Design new landing page",
        taskDescription: "Create mockups for the Q3 campaign",
        shareToken: "test-token-123",
      })
      return NextResponse.json({ ok: true, sent: "email-shared", id: result.data?.id, error: result.error })
    }

    return NextResponse.json({ error: "Unknown type. Use: push | email-reminder | email-overdue | email-shared" }, { status: 400 })
  } catch (e) {
    return handleApiError(e)
  }
}
