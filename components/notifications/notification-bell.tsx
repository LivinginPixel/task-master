"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { format, formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"

interface NotificationItem {
  id: string
  taskId: string
  taskTitle: string
  type: string
  message: string
  timestamp: Date
  read: boolean
}

export function NotificationBell() {
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)

  // Listen for notifications from Service Worker and NotificationService
  useEffect(() => {
    // Only set up listeners if user is logged in
    if (!session?.user) return
    if (typeof window === 'undefined') return

    const handleNotificationFired = (data: {
      taskId: string
      notificationType: string
      title: string
      body: string
    }) => {
      const notification: NotificationItem = {
        id: `${data.taskId}-${data.notificationType}-${Date.now()}`,
        taskId: data.taskId,
        taskTitle: data.title || 'Task',
        type: data.notificationType,
        message: data.body || '',
        timestamp: new Date(),
        read: false,
      }

      setNotifications((prev) => {
        // Add to beginning, keep only last 50
        const updated = [notification, ...prev].slice(0, 50)
        return updated
      })
    }

    // Listen for Service Worker messages
    const swMessageHandler = (event: MessageEvent) => {
      if (event.data?.type === 'NOTIFICATION_FIRED') {
        handleNotificationFired(event.data)
      }
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', swMessageHandler)
    }

    // Listen for custom notification events (from NotificationService)
    const customEventHandler = (event: CustomEvent) => {
      if (event.detail?.type === 'NOTIFICATION_FIRED') {
        handleNotificationFired(event.detail)
      }
    }

    window.addEventListener('notification-fired', customEventHandler as EventListener)

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', swMessageHandler)
      }
      window.removeEventListener('notification-fired', customEventHandler as EventListener)
    }
  }, [session?.user])

  // Update unread count
  useEffect(() => {
    const unread = notifications.filter(n => !n.read).length
    setUnreadCount(unread)
  }, [notifications])

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true }))
    )
  }, [])

  // Mark single notification as read
  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }, [])

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  // Get notification icon color based on type
  const getNotificationColor = (type: string) => {
    if (type.includes('overdue')) return 'text-red-500'
    if (type.includes('due-now')) return 'text-orange-500'
    if (type.includes('start')) return 'text-blue-500'
    return 'text-emerald-500'
  }

  // Format notification time
  const formatTime = (timestamp: Date) => {
    const now = new Date()
    const diff = now.getTime() - timestamp.getTime()
    
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return formatDistanceToNow(timestamp, { addSuffix: true })
    if (isSameDay(timestamp, now)) return format(timestamp, 'h:mm a')
    return format(timestamp, 'MMM d, h:mm a')
  }

  const isSameDay = (date1: Date, date2: Date) => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    )
  }

  // Only show notification bell when user is logged in
  if (!session?.user) return null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 flex-shrink-0 min-w-[2.25rem] min-h-[2.25rem] flex items-center justify-center hover:scale-100 active:scale-100"
          aria-label="Notifications"
        >
          <Bell className="h-[1.2rem] w-[1.2rem]" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] font-semibold rounded-full"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[90vw] sm:w-96 p-0 z-[100] max-w-[calc(100vw-1rem)]"
        align="end"
        sideOffset={8}
        side="bottom"
        avoidCollisions={true}
        collisionPadding={16}
      >
        <div className="flex flex-col max-h-[80vh] sm:max-h-[600px]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold text-sm sm:text-base">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={markAllAsRead}
                >
                  Mark all read
                </Button>
              )}
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={clearAll}
                >
                  Clear all
                </Button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto max-h-[60vh] sm:max-h-[500px]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <Bell className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground font-medium">
                  No notifications
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  You'll see task reminders here
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => {
                      markAsRead(notification.id)
                      setOpen(false)
                      const taskId = notification.taskId
                      if (pathname === "/dashboard") {
                        // Already on dashboard — just open the task sheet
                        if (taskId) {
                          window.dispatchEvent(new CustomEvent("tm:open-task", { detail: { taskId } }))
                        }
                      } else {
                        // Navigate without reload, then open sheet after mount
                        router.push(taskId ? `/dashboard?task=${taskId}` : "/dashboard")
                      }
                    }}
                    className={cn(
                      "w-full text-left p-3 sm:p-4 hover:bg-muted/50 transition-colors active:bg-muted",
                      !notification.read && "bg-muted/30"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "mt-1 flex-shrink-0",
                          getNotificationColor(notification.type)
                        )}
                      >
                        <Bell className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-sm font-medium line-clamp-1">
                            {notification.taskTitle}
                          </p>
                          {!notification.read && (
                            <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mb-1.5">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(notification.timestamp)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
