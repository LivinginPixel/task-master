"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { NotificationService } from "@/lib/services/notifications"

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

async function subscribeToPush(registration: ServiceWorkerRegistration) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!publicKey) return

  try {
    const existing = await registration.pushManager.getSubscription()
    const sub = existing ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })

    // If user is not signed in, the endpoint returns 401 — that's fine, we just retry next visit
    await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    })
  } catch {
    // Push not supported or permission denied — graceful no-op
  }
}

export function ServiceWorkerRegister() {
  const router = useRouter()

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(async (reg) => {
        await subscribeToPush(reg)

        navigator.serviceWorker.addEventListener("message", (event) => {
          const { type, taskId, notificationType, navigateTo } = event.data || {}

          if (type === "NOTIFICATION_CLICK") {
            if (navigateTo) {
              router.push(navigateTo)
              setTimeout(() => {
                if (taskId) {
                  window.dispatchEvent(new CustomEvent("tm:open-task", { detail: { taskId } }))
                }
                window.dispatchEvent(new CustomEvent("tm:refresh-tasks"))
              }, 300)
            }
          }

          if (type === "NOTIFICATION_FIRED") {
            // Sync dedup state so the 5-min interval doesn't re-fire the same notification.
            // Do NOT dispatch tm:refresh-tasks here — that would toggle isLoading,
            // re-run startMonitoring, and fire overdue notifications again.
            if (taskId) {
              NotificationService.getInstance().markNotificationFired(taskId, notificationType)
            }
          }

          if (type === "PUSH_RECEIVED") {
            // A server-push arrived (collaborator event) — refresh the task list.
            // This is separate from NOTIFICATION_FIRED so we only refresh on real
            // data changes (collaborator actions), not on scheduled in-app alerts.
            window.dispatchEvent(new CustomEvent("tm:refresh-tasks"))
          }
        })

        // Page opened via notification click — ?task= param
        const taskIdFromUrl = new URLSearchParams(window.location.search).get("task")
        if (taskIdFromUrl) {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent("tm:open-task", { detail: { taskId: taskIdFromUrl } }))
          }, 800)
        }
      })
      .catch(() => {})
  }, [router])

  return null
}
