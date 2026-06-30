import { toast } from "@/components/ui/use-toast"
import type { Task } from "@/lib/types"
import { format } from "date-fns"
import { ServiceWorkerRegistration } from "./service-worker-registration"

// ─── Persistent dedup ─────────────────────────────────────────────────────────
// Every notification event is identified by (taskId, type, context).
// Context encodes WHEN the notification was supposed to fire, derived purely
// from task data — so it changes when the user changes the task's times,
// allowing a new notification to fire for the new schedule.
//   • time-based types  : epoch-minute of the computed fire time
//   • overdue           : today's date string  (one fire per day)
//
// Keys are stored in localStorage so dedup survives page reloads and is
// shared between the main-thread scheduler and the SW message handler.
// ─────────────────────────────────────────────────────────────────────────────

const DEDUP_NS = 'tm:nf:'
type NotifType = "start-5min-before" | "30min-before" | "15min-before" | "5min-before" | "due-now" | "overdue"

function dedupeKey(taskId: string, type: string, context: string): string {
  return `${DEDUP_NS}${taskId}:${type}:${context}`
}

function hasFired(taskId: string, type: string, context: string): boolean {
  if (typeof window === 'undefined') return false
  try { return !!localStorage.getItem(dedupeKey(taskId, type, context)) } catch { return false }
}

function setFired(taskId: string, type: string, context: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(dedupeKey(taskId, type, context), '1')
    pruneDedupeKeys()
  } catch {}
}

function clearTaskDedupeKeys(taskId: string): void {
  if (typeof window === 'undefined') return
  try {
    const prefix = `${DEDUP_NS}${taskId}:`
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(prefix)) toRemove.push(k)
    }
    toRemove.forEach(k => localStorage.removeItem(k))
  } catch {}
}

function pruneDedupeKeys(): void {
  // Cap at 500 entries to prevent unbounded growth
  if (typeof window === 'undefined') return
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(DEDUP_NS)) keys.push(k)
    }
    if (keys.length > 500) {
      keys.slice(0, keys.length - 500).forEach(k => localStorage.removeItem(k))
    }
  } catch {}
}

// Stable context derived from task data.
// Returns the same string for the same schedule — changes only when the
// user changes the task's times, which is exactly when we want re-fires.
function notifContext(type: NotifType, todo: Task): string {
  if (type === 'overdue') return new Date().toDateString()

  if (type === 'start-5min-before' && todo.startTime) {
    const ms = new Date(todo.startTime).getTime() - 5 * 60 * 1000
    return Math.floor(ms / 60000).toString()
  }

  if (todo.dueDate) {
    const d = new Date(todo.dueDate)
    if (todo.dueTime) {
      const [h, m] = todo.dueTime.split(':').map(Number)
      d.setHours(h, m, 0, 0)
    } else {
      d.setHours(23, 59, 59, 999)
    }
    const dueMs = d.getTime()
    const offsets: Record<string, number> = {
      '30min-before': -30 * 60 * 1000,
      '15min-before': -15 * 60 * 1000,
      '5min-before':   -5 * 60 * 1000,
      'due-now':        0,
    }
    return Math.floor((dueMs + (offsets[type] ?? 0)) / 60000).toString()
  }

  return ''
}

// ─────────────────────────────────────────────────────────────────────────────

export class NotificationService {
  private static instance: NotificationService
  private scheduled: Map<string, NodeJS.Timeout[]> = new Map()
  private currentTodos: Task[] = []
  private getFreshTodos: (() => Task[]) | null = null
  private swRegistration: ServiceWorkerRegistration | null = null
  private useServiceWorker: boolean = false

  private constructor() {
    if (typeof window !== 'undefined') {
      ServiceWorkerRegistration.getInstance()
        .then((sw) => {
          this.swRegistration = sw
          setTimeout(() => {
            this.useServiceWorker = sw.isSupported() && sw.isReady()
          }, 1000)
        })
        .catch(() => {
          this.useServiceWorker = false
        })
    }
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService()
    }
    return NotificationService.instance
  }

  private clearScheduled(taskId: string) {
    const timeouts = this.scheduled.get(taskId)
    if (timeouts) {
      timeouts.forEach(clearTimeout)
      this.scheduled.delete(taskId)
    }
    if (this.swRegistration && this.useServiceWorker) {
      const types: NotifType[] = ['start-5min-before', '30min-before', '15min-before', '5min-before', 'due-now', 'overdue']
      types.forEach(type => {
        this.swRegistration!.cancelNotification(taskId, type).catch(() => {})
      })
    }
  }

  private shouldSkipNotifications(todo: Task): boolean {
    if (todo.notificationsMuted) return true
    if (todo.snoozedUntil && new Date(todo.snoozedUntil) > new Date()) return true
    return false
  }

  private scheduleNotificationsForTask(todo: Task) {
    if (todo.status === 'COMPLETED' || todo.archived) return
    if (this.shouldSkipNotifications(todo)) return

    this.clearScheduled(todo.id)

    const now = new Date()
    const timeouts: NodeJS.Timeout[] = []

    // ── Start-time notification (5 min before start) ────────────────────────
    if (todo.startTime && todo.notifyOnStart !== false) {
      const startDate = new Date(todo.startTime)
      if (!isNaN(startDate.getTime())) {
        const timeToStart = startDate.getTime() - now.getTime()
        const timeTo5MinBefore = timeToStart - 5 * 60 * 1000

        if (timeTo5MinBefore > 0) {
          const scheduledTime = now.getTime() + timeTo5MinBefore
          if (this.useServiceWorker && this.swRegistration) {
            this.swRegistration.scheduleNotification(todo.id, 'start-5min-before', scheduledTime, todo)
          } else {
            timeouts.push(setTimeout(() => {
              const fresh = this.freshTask(todo.id) ?? todo
              if (!this.shouldSkipNotifications(fresh) && fresh.notifyOnStart !== false) {
                this.fire(fresh, 'start-5min-before')
              }
            }, timeTo5MinBefore))
          }
        } else if (timeToStart > 0) {
          // Already inside the 5-minute window — fire immediately (tracked so clearScheduled can cancel)
          timeouts.push(setTimeout(() => {
            const fresh = this.freshTask(todo.id) ?? todo
            if (!this.shouldSkipNotifications(fresh) && fresh.notifyOnStart !== false) {
              this.fire(fresh, 'start-5min-before')
            }
          }, 100))
        }
      }
    }

    // ── Due-time notifications ──────────────────────────────────────────────
    if (!todo.dueDate) {
      this.scheduled.set(todo.id, timeouts)
      return
    }

    const dueDate = new Date(todo.dueDate)
    if (isNaN(dueDate.getTime())) {
      this.scheduled.set(todo.id, timeouts)
      return
    }

    if (todo.dueTime) {
      const [h, m] = todo.dueTime.split(':').map(Number)
      dueDate.setHours(h, m, 0, 0)
    } else {
      dueDate.setHours(23, 59, 59, 999)
    }

    const timeToDue = dueDate.getTime() - now.getTime()

    const schedule = (type: NotifType, delay: number) => {
      if (delay <= 0) return
      const scheduledTime = now.getTime() + delay
      if (this.useServiceWorker && this.swRegistration) {
        this.swRegistration.scheduleNotification(todo.id, type, scheduledTime, todo)
      } else {
        timeouts.push(setTimeout(() => {
          const fresh = this.freshTask(todo.id) ?? todo
          if (!this.shouldSkipNotifications(fresh)) this.fire(fresh, type)
        }, delay))
      }
    }

    schedule('30min-before', timeToDue - 30 * 60 * 1000)
    schedule('15min-before', timeToDue - 15 * 60 * 1000)
    schedule('5min-before',  timeToDue -  5 * 60 * 1000)

    if (timeToDue > 0 && timeToDue < 5 * 60 * 1000) {
      // Inside the 5-minute window — fire immediately (tracked so clearScheduled can cancel)
      timeouts.push(setTimeout(() => {
        const fresh = this.freshTask(todo.id) ?? todo
        if (!this.shouldSkipNotifications(fresh)) this.fire(fresh, '5min-before')
      }, 100))
    }

    // due-now
    schedule('due-now', timeToDue)

    // overdue — fire once per day, 1 second after due
    if (timeToDue < 0) {
      // Task is already overdue — fire now if not fired today
      const fresh = this.freshTask(todo.id) ?? todo
      if (!this.shouldSkipNotifications(fresh)) {
        this.fire(fresh, 'overdue')
      }
    } else {
      schedule('overdue', timeToDue + 1000)
    }

    this.scheduled.set(todo.id, timeouts)
  }

  // Returns the freshest copy of a task from currentTodos / getFreshTodos
  private freshTask(taskId: string): Task | undefined {
    const cached = this.currentTodos.find(t => t.id === taskId)
    if (cached) return cached
    if (this.getFreshTodos) {
      return this.getFreshTodos().find(t => t.id === taskId)
    }
    return undefined
  }

  // Core notification emitter — idempotent thanks to persistent dedup.
  private fire(todo: Task, type: NotifType) {
    if (this.shouldSkipNotifications(todo)) return

    const context = notifContext(type, todo)
    if (hasFired(todo.id, type, context)) return
    setFired(todo.id, type, context)

    let title = ''
    let description = ''
    let variant: 'default' | 'destructive' = 'default'

    if (type === 'start-5min-before') {
      const startDate = todo.startTime ? new Date(todo.startTime) : null
      const fullStart = startDate
        ? `${format(startDate, 'MMM d, yyyy')} at ${format(startDate, 'h:mm a')}`
        : ''
      title = 'Task Starting Soon'
      description = `"${todo.title}" starts in 5 mins${fullStart ? ` (${fullStart})` : ''}`
    } else {
      const dueDateStr = todo.dueDate ? format(new Date(todo.dueDate), 'MMM d, yyyy') : ''
      const dueTimeStr = todo.dueTime ?? ''
      const fullDue = [dueDateStr, dueTimeStr ? `at ${dueTimeStr}` : ''].filter(Boolean).join(' ')

      if (type === '30min-before') {
        title = 'Task Due Soon'; description = `"${todo.title}" is due in 30 minutes${fullDue ? ` (${fullDue})` : ''}`
      } else if (type === '15min-before') {
        title = 'Task Due Soon'; description = `"${todo.title}" is due in 15 minutes${fullDue ? ` (${fullDue})` : ''}`
      } else if (type === '5min-before') {
        title = 'Task Due Soon'; description = `"${todo.title}" is due in 5 minutes${fullDue ? ` (${fullDue})` : ''}`
      } else if (type === 'due-now') {
        title = 'Task Due Now'; description = `"${todo.title}" is due now${fullDue ? ` (${fullDue})` : ''}`; variant = 'destructive'
      } else if (type === 'overdue') {
        title = 'Task Overdue'; description = `"${todo.title}" is past its deadline${fullDue ? ` (was due ${fullDue})` : ''}`; variant = 'destructive'
      }
    }

    // Bell
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notification-fired', {
        detail: { type: 'NOTIFICATION_FIRED', taskId: todo.id, notificationType: type, title, body: description }
      }))
    }

    // Toast
    toast({ title, description, variant })

    // Browser notification
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      const n = new Notification(title, {
        body: description,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: `${todo.id}-${type}`,
        requireInteraction: false,
        silent: false,
      })
      n.onclick = () => window.focus()
    }

    this.playSound()
  }

  private playSound() {
    try {
      const audio = new Audio('/notification.wav')
      audio.volume = 0.6
      audio.play().catch(() => {
        try {
          const fallback = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGWi77+efTRAMUKfj8LZjHAY4kdfyzHksBSR3x/DdkEAKFF606euoVRQKRp/g8r5sIQUrgc7y2Yk2CBlou+/nn00QDFCn4/C2YxwGOJHX8sx5LAUkd8fw3ZBACg==")
          fallback.volume = 0.5
          fallback.play().catch(() => {})
        } catch {}
      })
    } catch {}
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  public startMonitoring(todos: Task[] | (() => Task[])): void {
    // Cancel all pending in-browser timeouts
    this.scheduled.forEach(timeouts => timeouts.forEach(clearTimeout))
    this.scheduled.clear()

    if (this.swRegistration && this.useServiceWorker) {
      this.swRegistration.clearAllNotifications().catch(() => {})
    }

    if (typeof todos === 'function') {
      this.getFreshTodos = todos
      this.currentTodos = todos()
    } else {
      this.currentTodos = todos
      this.getFreshTodos = null
    }

    this.currentTodos.forEach(todo => this.scheduleNotificationsForTask(todo))
    // No polling interval — Supabase Realtime keeps todosRef live and
    // the dashboard calls syncNewTasks() whenever new tasks arrive.
  }

  // Called by the dashboard when Realtime delivers new tasks from other devices.
  // Only schedules tasks that aren't already tracked — never cancels existing timers.
  public syncNewTasks(todos: Task[]): void {
    const knownIds = new Set(this.currentTodos.map(t => t.id))
    for (const todo of todos) {
      if (!knownIds.has(todo.id)) {
        this.currentTodos.push(todo)
        if (todo.status !== 'COMPLETED' && !todo.archived) {
          this.scheduleNotificationsForTask(todo)
        }
      }
    }
  }

  // Re-schedule a single task after it was created or its times changed.
  // Also clears old dedup keys for that task so the new times fire correctly.
  public updateTaskNotifications(task: Task, timesChanged = false) {
    this.clearScheduled(task.id)

    const idx = this.currentTodos.findIndex(t => t.id === task.id)
    if (idx >= 0) this.currentTodos[idx] = task
    else this.currentTodos.push(task)

    // When the task's scheduled times change, clear old dedup keys so the
    // new schedule can fire (different context → different key → can fire).
    // Don't clear for mute/snooze changes — dedup should still suppress.
    if (timesChanged) clearTaskDedupeKeys(task.id)

    this.scheduleNotificationsForTask(task)
  }

  // Called by the SW message handler when a background notification fires.
  // Marks the notification as fired in localStorage so the 5-minute interval
  // doesn't re-fire it in the foreground.
  public markNotificationFired(taskId: string, type: string) {
    const todo = this.freshTask(taskId)
    const context = todo
      ? notifContext(type as NotifType, todo)
      : type === 'overdue' ? new Date().toDateString() : ''
    if (context) setFired(taskId, type, context)
  }

  public async requestNotificationPermission() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      return permission === 'granted'
    }
    return false
  }

  // ─── Dev helpers ────────────────────────────────────────────────────────────

  public getScheduledNotifications(): { taskId: string; count: number }[] {
    const result: { taskId: string; count: number }[] = []
    this.scheduled.forEach((timeouts, taskId) => result.push({ taskId, count: timeouts.length }))
    return result
  }

  public debugTriggerNotification(taskId: string, type: NotifType = 'start-5min-before') {
    const task = this.currentTodos.find(t => t.id === taskId)
    if (task) this.fire(task, type)
    else console.warn(`Task ${taskId} not found in currentTodos`)
  }
}
