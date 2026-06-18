"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Icons } from "@/components/ui/icons";
import { useToast } from "@/components/ui/use-toast";
import { useTheme } from "next-themes";
import { List, LayoutGrid, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const preferencesSchema = z.object({
  notificationsEnabled: z.boolean(),
  defaultView: z.enum(["list", "kanban"]),
  theme: z.enum(["light", "dark", "system"]),
});

type PreferencesFormValues = z.infer<typeof preferencesSchema>;

interface PreferencesFormProps {
  initialPreferences: {
    notificationsEnabled: boolean;
    defaultView: "list" | "kanban" | "grid"; // accept legacy "grid" value
    theme: "light" | "dark" | "system";
  };
}

export function PreferencesForm({ initialPreferences }: PreferencesFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { setTheme } = useTheme();
  const [isLoading, setIsLoading] = useState(false);

  // Normalize legacy "grid" value to "kanban"
  const normalizedView = initialPreferences.defaultView === "grid" ? "kanban" : initialPreferences.defaultView

  const form = useForm<PreferencesFormValues>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      notificationsEnabled: initialPreferences.notificationsEnabled,
      defaultView: normalizedView as "list" | "kanban",
      theme: initialPreferences.theme || "system",
    },
  });

  async function onSubmit(data: PreferencesFormValues) {
    setIsLoading(true);

    try {
      const response = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to update preferences");

      // Update theme
      setTheme(data.theme);

      toast({
        title: "Preferences updated",
        description: "Your preferences have been updated successfully.",
      });

      router.refresh();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update preferences. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
      <div className="space-y-8">
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-sm font-semibold">Default View</Label>
            <p className="text-xs text-muted-foreground">
              Choose how tasks are laid out when you open the dashboard.
            </p>
          </div>
          <div className="flex gap-3">
            {([
              {
                value: "list",
                label: "List",
                icon: List,
                description: "Tasks in a scrollable list with date groups",
              },
              {
                value: "kanban",
                label: "Kanban",
                icon: LayoutGrid,
                description: "Tasks in columns by status — drag to move",
              },
            ] as const).map(({ value, label, icon: Icon, description }) => {
              const selected = form.watch("defaultView") === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => form.setValue("defaultView", value)}
                  className={cn(
                    "relative flex-1 flex flex-col gap-2 p-4 rounded-xl border-2 text-left transition-all duration-200",
                    selected
                      ? "border-accent bg-accent/5 shadow-sm"
                      : "border-border/60 hover:border-accent/40 hover:bg-muted/40"
                  )}
                >
                  {selected && (
                    <span className="absolute top-2.5 right-2.5 h-5 w-5 rounded-full bg-accent flex items-center justify-center">
                      <Check className="h-3 w-3 text-accent-foreground" strokeWidth={3} />
                    </span>
                  )}
                  <Icon className={cn("h-5 w-5", selected ? "text-accent" : "text-muted-foreground")} />
                  <div>
                    <p className={cn("text-sm font-semibold", selected ? "text-foreground" : "text-muted-foreground")}>
                      {label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-sm font-semibold">Theme</Label>
            <p className="text-xs text-muted-foreground">
              Choose your preferred color theme.
            </p>
          </div>
          <RadioGroup
            value={form.watch("theme")}
            onValueChange={(value: "light" | "dark" | "system") =>
              form.setValue("theme", value)
            }
            className="flex gap-8"
            aria-label="Theme selection"
          >
            <div className="flex items-center space-x-2.5">
              <RadioGroupItem value="light" id="light" />
              <Label htmlFor="light" className="font-normal cursor-pointer text-sm">
                Light
              </Label>
            </div>
            <div className="flex items-center space-x-2.5">
              <RadioGroupItem value="dark" id="dark" />
              <Label htmlFor="dark" className="font-normal cursor-pointer text-sm">
                Dark
              </Label>
            </div>
            <div className="flex items-center space-x-2.5">
              <RadioGroupItem value="system" id="system" />
              <Label htmlFor="system" className="font-normal cursor-pointer text-sm">
                System
              </Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      <Separator className="my-8" />

      <div className="flex justify-end">
        <Button type="submit" disabled={isLoading} className="min-w-[120px]">
          {isLoading ? (
            <>
              <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Preferences"
          )}
        </Button>
      </div>
    </form>
  );
} 