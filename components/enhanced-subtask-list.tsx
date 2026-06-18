"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { Trash2, Plus, ChevronDown } from "lucide-react"
import type { Subtask } from "@/lib/types"
import { v4 as uuidv4 } from "uuid"
import { cn } from "@/lib/utils"
import type { TaskCardVariant } from "@/components/enhanced-task-card"
import { CompletionSignature } from "@/components/completion-signature"

interface EnhancedSubtaskListProps {
  subtasks: Subtask[]
  onToggle: (id: string, completed: boolean) => void
  onAdd: (subtask: Subtask) => void
  onDelete: (id: string) => void
  variant?: TaskCardVariant
  disabled?: boolean // Disable all interactions when task is locked
}

export function EnhancedSubtaskList({ 
  subtasks, 
  onToggle, 
  onAdd, 
  onDelete,
  variant = "premium-modern",
  disabled = false
}: EnhancedSubtaskListProps) {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("")
  const [isCompletedOpen, setIsCompletedOpen] = useState(false)

  const activeSubtasks = subtasks.filter(st => !st.completed)
  const completedSubtasks = subtasks.filter(st => st.completed)

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return

    onAdd({
      id: uuidv4(),
      title: newSubtaskTitle,
      completed: false,
    })

    setNewSubtaskTitle("")
  }

  // Variant-specific styles
  const getVariantStyles = () => {
    switch (variant) {
      case "ultra-minimal":
        return {
          subtaskItem: "py-1.5",
          input: "text-sm border-0 border-b border-border/30 rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-b-2",
        }
      case "premium-modern":
        return {
          subtaskItem: "py-2",
          input: "text-sm",
        }
      case "dark-mode":
        return {
          subtaskItem: "py-2",
          input: "text-sm",
        }
      default:
        return {
          subtaskItem: "py-2",
          input: "text-sm",
        }
    }
  }

  const variantStyles = getVariantStyles()

  return (
    <div className="space-y-3">
      {/* Active Subtasks */}
      {activeSubtasks.length > 0 && (
        <div className="space-y-2">
          {activeSubtasks.map((subtask) => (
            <div 
              key={subtask.id} 
              className={cn(
                "flex items-center gap-2 group",
                variantStyles.subtaskItem
              )}
            >
              <Checkbox
                checked={false}
                onCheckedChange={(checked) => {
                  if (!disabled) {
                    onToggle(subtask.id, !!checked)
                  }
                }}
                disabled={disabled}
                id={`subtask-${subtask.id}`}
                className="flex-shrink-0"
              />
              <label
                htmlFor={`subtask-${subtask.id}`}
                className={cn(
                  "flex-1 text-sm",
                  disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                )}
              >
                {subtask.title}
              </label>
              {!disabled && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => onDelete(subtask.id)} 
                  className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="sr-only">Delete</span>
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Completed Subtasks Accordion */}
      {completedSubtasks.length > 0 && (
        <Collapsible open={isCompletedOpen} onOpenChange={setIsCompletedOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "w-full justify-between text-xs text-muted-foreground hover:text-foreground h-8",
                variant === "ultra-minimal" && "px-0"
              )}
            >
              <span className="flex items-center gap-1.5">
                <motion.div
                  animate={{ rotate: isCompletedOpen ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </motion.div>
                <span>Completed Subtasks</span>
                <Badge variant="outline" className="ml-1 h-4 px-1.5 text-[10px]">
                  {completedSubtasks.length}
                </Badge>
              </span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <AnimatePresence>
              {isCompletedOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 pt-2">
                    {completedSubtasks.map((subtask) => (
                      <div
                        key={subtask.id}
                        className={cn(
                          "flex items-start gap-2 group",
                          variantStyles.subtaskItem
                        )}
                      >
                        <Checkbox
                          checked={true}
                          onCheckedChange={(checked) => onToggle(subtask.id, !!checked)}
                          id={`completed-subtask-${subtask.id}`}
                          className="flex-shrink-0 mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <label
                            htmlFor={`completed-subtask-${subtask.id}`}
                            className={cn(
                              "block text-sm cursor-pointer line-through text-muted-foreground",
                              "hover:text-foreground transition-colors"
                            )}
                          >
                            {subtask.title}
                          </label>
                          {subtask.completedByName && (
                            <CompletionSignature
                              name={subtask.completedByName}
                              image={subtask.completedByImage}
                              completedAt={subtask.completedAt ?? undefined}
                              variant="inline"
                            />
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(subtask.id)}
                          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Add New Subtask */}
      {!disabled && (
        <div className={cn(
          "flex gap-2",
          variant === "ultra-minimal" && "pt-2"
        )}>
          <Input
            value={newSubtaskTitle}
            onChange={(e) => setNewSubtaskTitle(e.target.value)}
            placeholder="Add a subtask"
            className={variantStyles.input}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleAddSubtask()
              }
            }}
          />
          <Button 
            type="button" 
            size="sm" 
            variant="outline" 
            onClick={handleAddSubtask} 
            disabled={!newSubtaskTitle.trim()}
            className={cn(
              "flex-shrink-0",
              variant === "ultra-minimal" && "border-0 border-b border-border/30 rounded-none bg-transparent"
            )}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}
