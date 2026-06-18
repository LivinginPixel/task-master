import { NextResponse } from "next/server";
import { getValidatedSession } from "@/lib/validate-session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { handleApiError } from "@/lib/errors";

const preferencesSchema = z.object({
  notificationsEnabled: z.boolean().optional(),
  defaultView: z.enum(["list", "kanban", "calendar"]).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
});

export async function PATCH(req: Request) {
  try {
    const session = await getValidatedSession();

    const body = await req.json();
    const validatedData = preferencesSchema.parse(body);

    // Build typed partial update object matching the DB schema
    const updates: Partial<{
      notifications_enabled: boolean
      default_view: string
      theme: string
    }> = {}

    if (validatedData.notificationsEnabled !== undefined) {
      updates.notifications_enabled = validatedData.notificationsEnabled
    }
    if (validatedData.defaultView !== undefined) {
      updates.default_view = validatedData.defaultView
    }
    if (validatedData.theme !== undefined) {
      updates.theme = validatedData.theme
    }

    if (Object.keys(updates).length > 0) {
      await db
        .update(users)
        .set(updates)
        .where(eq(users.id, session.user.id));
    }

    return NextResponse.json(
      { message: "Preferences updated successfully" },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
