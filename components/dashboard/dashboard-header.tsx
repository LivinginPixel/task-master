"use client"

import Link from "next/link"
import { useSession } from "next-auth/react"
import { usePathname } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Settings, Focus, BarChart3, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

const NAV_LINKS: { href: string; label: string; exact?: boolean; icon?: LucideIcon }[] = [
  { href: "/dashboard", label: "Tasks", exact: true },
  { href: "/dashboard/focus", label: "Focus", icon: Focus },
  { href: "/dashboard/stats", label: "Stats", icon: BarChart3 },
]

export function DashboardHeader() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const userInitials = session?.user?.name?.charAt(0).toUpperCase() || "U"

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-accent to-accent/60 flex items-center justify-center shadow-sm">
              <span className="text-accent-foreground text-xs font-black">TM</span>
            </div>
            <span className="text-sm font-bold tracking-tight hidden sm:block">TaskMaster</span>
          </Link>

          {/* Center nav */}
          <nav className="flex items-center gap-0.5">
            {NAV_LINKS.map(({ href, label, icon: Icon, exact }) => {
              const isActive = exact ? pathname === href : pathname.startsWith(href)
              const isFocus = href === "/dashboard/focus"

              if (isFocus) {
                return (
                  <Link key={href} href={href}>
                    <div className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold tracking-wide transition-all",
                      isActive
                        ? "bg-accent text-accent-foreground shadow-md shadow-accent/30"
                        : "bg-accent/15 text-accent hover:bg-accent hover:text-accent-foreground"
                    )}>
                      {Icon && <Icon className="h-3.5 w-3.5" />}
                      {label}
                    </div>
                  </Link>
                )
              }

              return (
                <Link key={href} href={href}>
                  <div className="relative px-3 py-1.5">
                    <span className={cn(
                      "flex items-center gap-1.5 text-sm font-medium transition-colors",
                      isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}>
                      {Icon && <Icon className="h-3.5 w-3.5" />}
                      {label}
                    </span>
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-accent"
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                  </div>
                </Link>
              )
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-1 shrink-0">
            <Link href="/settings">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings className="h-4 w-4" />
                <span className="sr-only">Settings</span>
              </Button>
            </Link>
            <Link href="/profile">
              <button className="h-8 w-8 rounded-full overflow-hidden ring-2 ring-border hover:ring-accent/50 transition-all">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={session?.user?.image || undefined} alt={session?.user?.name || "User"} />
                  <AvatarFallback className="bg-accent/10 text-accent text-xs font-bold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
