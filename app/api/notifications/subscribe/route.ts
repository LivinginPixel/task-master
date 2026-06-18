import { NextResponse } from "next/server"
import { getValidatedSession } from "@/lib/validate-session"
import { db } from "@/lib/db"
import { sql } from "drizzle-orm"
import { handleApiError } from "@/lib/errors"

// POST — save a push subscription for the current user
export async function POST(req: Request) {
  try {
    const session = await getValidatedSession()
    const { endpoint, keys } = await req.json()
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 })
    }

    await db.execute(sql`
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
      VALUES (${session.user.id}, ${endpoint}, ${keys.p256dh}, ${keys.auth})
      ON CONFLICT (endpoint) DO UPDATE SET user_id = ${session.user.id}
    `)

    return NextResponse.json({ success: true })
  } catch (e) {
    return handleApiError(e)
  }
}

// DELETE — remove push subscription
export async function DELETE(req: Request) {
  try {
    const session = await getValidatedSession()
    const { endpoint } = await req.json()
    await db.execute(sql`
      DELETE FROM push_subscriptions WHERE user_id = ${session.user.id} AND endpoint = ${endpoint}
    `)
    return NextResponse.json({ success: true })
  } catch (e) {
    return handleApiError(e)
  }
}
