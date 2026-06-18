"use client"

import { useState, useRef } from "react"
import { motion } from "framer-motion"
import { Plus, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

interface QuickCaptureBarProps {
  onAdd: (title: string) => void
  disabled?: boolean
}

export function QuickCaptureBar({ onAdd, disabled }: QuickCaptureBarProps) {
  const [value, setValue] = useState("")
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setValue("")
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      submit()
    }
    if (e.key === "Escape") {
      setValue("")
      inputRef.current?.blur()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border-2 transition-all duration-200",
        isFocused
          ? "border-accent/50 bg-card shadow-sm shadow-accent/10"
          : "border-border/50 bg-card/50 hover:border-border hover:bg-card"
      )}
    >
      <motion.div
        animate={{ rotate: isFocused ? 45 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <Plus className={cn("h-4 w-4 flex-shrink-0 transition-colors", isFocused ? "text-accent" : "text-muted-foreground")} />
      </motion.div>

      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder="Add a task… press Enter to save"
        disabled={disabled}
        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none min-w-0"
        aria-label="Quick add task"
      />

      {value.trim() && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          type="button"
          onClick={submit}
          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent text-accent-foreground text-xs font-semibold touch-manipulation"
        >
          <Zap className="h-3 w-3" />
          Add
        </motion.button>
      )}
    </motion.div>
  )
}
