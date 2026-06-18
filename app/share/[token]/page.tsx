import { Suspense } from "react"
import { SharedTaskView } from "@/components/share/shared-task-view"

export default function SharePage({ params }: { params: { token: string } }) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin" /></div>}>
      <SharedTaskView token={params.token} />
    </Suspense>
  )
}
