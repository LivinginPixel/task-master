"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

export type FilterType = "all" | "today" | "upcoming" | "inProgress" | "completed" | "overdue"

export interface FilterCounts {
  all: number
  today: number
  upcoming: number
  inProgress: number
  completed: number
  overdue: number
}

interface PillFiltersProps {
  activeFilter: FilterType
  onFilterChange: (filter: FilterType) => void
  counts: FilterCounts
}

const filters: { id: FilterType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "inProgress", label: "In Progress" },
  { id: "completed", label: "Done" },
  { id: "overdue", label: "Overdue" },
]

export function PillFilters({ activeFilter, onFilterChange, counts }: PillFiltersProps) {
  return (
    <div className="overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
      <div className="flex gap-2 min-w-max">
        {filters.map((filter, index) => {
          const isActive = activeFilter === filter.id
          const count = counts[filter.id]
          const isDanger = filter.id === "overdue" && count > 0

          return (
            <motion.button
              key={filter.id}
              onClick={() => onFilterChange(filter.id)}
              className={cn(
                "relative flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold",
                "whitespace-nowrap transition-colors duration-200 touch-manipulation",
                isActive
                  ? "text-accent-foreground"
                  : isDanger
                  ? "text-red-600 dark:text-red-400 hover:text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.04, ease: [0.4, 0, 0.2, 1] }}
            >
              {isActive && (
                <motion.div
                  layoutId="activeFilter"
                  className="absolute inset-0 bg-accent rounded-full shadow-sm shadow-accent/20"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}

              <span className="relative z-10">{filter.label}</span>

              {count > 0 && (
                <span className={cn(
                  "relative z-10 text-[10px] font-bold tabular-nums",
                  "px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none",
                  isActive
                    ? "bg-white/25 text-accent-foreground"
                    : isDanger
                    ? "bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300"
                    : "bg-muted text-muted-foreground"
                )}>
                  {count}
                </span>
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
