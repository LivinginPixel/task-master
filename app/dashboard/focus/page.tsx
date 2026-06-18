import { redirect } from "next/navigation"
import { getValidatedSession } from "@/lib/validate-session"
import { FocusMode } from "@/components/focus/focus-mode"

export default async function FocusPage() {
  try {
    await getValidatedSession()
    return <FocusMode />
  } catch {
    redirect("/auth/signin")
  }
}
