import { redirect } from "next/navigation"
import { getValidatedSession } from "@/lib/validate-session"
import { StatsDashboard } from "@/components/stats/stats-dashboard"

export default async function StatsPage() {
  try {
    await getValidatedSession()
    return <StatsDashboard />
  } catch {
    redirect("/auth/signin")
  }
}
