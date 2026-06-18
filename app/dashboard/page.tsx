import { redirect } from "next/navigation";
import { DashboardClient } from "./page-cli";
import { getValidatedSession } from "@/lib/validate-session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export default async function DashboardPage() {
  try {
    const session = await getValidatedSession();

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { default_view: true },
    })

    // Normalize legacy "grid" → "kanban"
    const raw = user?.default_view ?? "list"
    const defaultView = raw === "grid" ? "kanban" : raw as "list" | "kanban"

    return (
      <DashboardClient
        userName={session.user?.name || "User"}
        dbConnected={true}
        defaultView={defaultView}
      />
    );
  } catch {
    redirect("/auth/signin");
  }
}