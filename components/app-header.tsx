"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CheckSquare, Focus } from "lucide-react"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { UserNav } from "@/components/user-nav"
import { NotificationBell } from "@/components/notifications/notification-bell"

// Routes where the global nav should not appear — they have their own contextual header
const NO_HEADER_ROUTES = ["/share/", "/invite/"]

export function AppHeader() {
  const pathname = usePathname()
  const hidden = NO_HEADER_ROUTES.some(r => pathname.startsWith(r))
  if (hidden) return null

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 dark:bg-background/95 dark:supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="container flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-shrink-0">
          <CheckSquare className="h-6 w-6 text-primary flex-shrink-0" />
          <span className="font-semibold text-foreground">Task Master</span>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3 flex-shrink-0" aria-label="User menu">
          <Link
            href="/dashboard/focus"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-accent text-accent-foreground hover:opacity-90 transition-opacity"
          >
            <Focus className="h-3.5 w-3.5" />
            Focus
          </Link>
          <NotificationBell />
          <ThemeSwitcher />
          <UserNav />
        </nav>
      </div>
    </header>
  )
}
