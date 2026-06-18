"use client"

import { motion, AnimatePresence } from "framer-motion"
import { CheckCheck, Trash2, X, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Task } from "@/lib/types"

interface BulkActionBarProps {
  selectedCount: number
  onCompleteAll: () => void
  onDeleteAll: () => void
  onReprioritize: (priority: Task["priority"]) => void
  onCancel: () => void
}

export function BulkActionBar({
  selectedCount,
  onCompleteAll,
  onDeleteAll,
  onReprioritize,
  onCancel,
}: BulkActionBarProps) {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md"
        >
          <div className="flex items-center gap-2 bg-card border border-border shadow-2xl shadow-black/20 rounded-2xl px-4 py-3">
            {/* Count badge */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-bold shrink-0">
                {selectedCount}
              </span>
              <span className="text-sm font-medium text-foreground truncate">
                task{selectedCount !== 1 ? "s" : ""} selected
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Complete */}
              <Button
                size="sm"
                variant="ghost"
                onClick={onCompleteAll}
                className="h-8 gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Done</span>
              </Button>

              {/* Priority */}
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs font-medium">
                    Priority
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  {(["URGENT", "HIGH", "MEDIUM", "LOW"] as Task["priority"][]).map((p) => (
                    <DropdownMenuItem key={p} onClick={() => onReprioritize(p)} className="text-xs">
                      {p.charAt(0) + p.slice(1).toLowerCase()}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Delete */}
              <Button
                size="sm"
                variant="ghost"
                onClick={onDeleteAll}
                className="h-8 gap-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Delete</span>
              </Button>

              {/* Divider */}
              <div className="h-4 w-px bg-border mx-0.5" />

              {/* Cancel */}
              <Button
                size="icon"
                variant="ghost"
                onClick={onCancel}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
