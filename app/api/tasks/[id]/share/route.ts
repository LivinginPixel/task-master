import { NextResponse } from "next/server"
import { getValidatedSession } from "@/lib/validate-session"
import { db } from "@/lib/db"
import { tasks } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { handleApiError } from "@/lib/errors"
import { randomUUID } from "crypto"

// POST /api/tasks/[id]/share — generate or return existing share token
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getValidatedSession()

    const [task] = await db.select({ id: tasks.id, share_token: tasks.share_token })
      .from(tasks)
      .where(and(eq(tasks.id, params.id), eq(tasks.user_id, session.user.id)))
      .limit(1)

    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 })

    // Return existing token or create a new one
    const token = task.share_token ?? randomUUID()

    if (!task.share_token) {
      await db.update(tasks)
        .set({ share_token: token, updated_at: new Date() })
        .where(eq(tasks.id, params.id))
    }

    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000"
    return NextResponse.json({ url: `${baseUrl}/share/${token}`, token })
  } catch (e) {
    return handleApiError(e)
  }
}

// DELETE /api/tasks/[id]/share — revoke share link
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getValidatedSession()
    await db.update(tasks)
      .set({ share_token: null, updated_at: new Date() })
      .where(and(eq(tasks.id, params.id), eq(tasks.user_id, session.user.id)))
    return NextResponse.json({ success: true })
  } catch (e) {
    return handleApiError(e)
  }
}
