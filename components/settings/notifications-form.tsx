"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Icons } from "@/components/ui/icons";
import { useToast } from "@/components/ui/use-toast";

const notificationsSchema = z.object({
  notificationsEnabled: z.boolean(),
});

type NotificationsFormValues = z.infer<typeof notificationsSchema>;

interface NotificationsFormProps {
  initialNotificationsEnabled: boolean;
}

export function NotificationsForm({ initialNotificationsEnabled }: NotificationsFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<NotificationsFormValues>({
    resolver: zodResolver(notificationsSchema),
    defaultValues: {
      notificationsEnabled: initialNotificationsEnabled,
    },
  });

  const handleSubmit = async (data: NotificationsFormValues) => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notificationsEnabled: data.notificationsEnabled,
        }),
      });

      if (!response.ok) throw new Error("Failed to update notifications");

      toast({
        title: "Notifications updated",
        description: "Your notification preferences have been saved.",
      });

      router.refresh();
    } catch {
      toast({
        title: "Error",
        description: "Failed to update notifications. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
      <div className="space-y-8">
        <div className="flex items-start justify-between gap-4 py-2">
          <div className="space-y-1 flex-1">
            <Label htmlFor="notifications" className="text-sm font-semibold">
              Email Notifications
            </Label>
            <p className="text-xs text-muted-foreground">
              Receive email notifications for task reminders, due dates, and important updates.
            </p>
          </div>
          <Switch
            id="notifications"
            checked={form.watch("notificationsEnabled")}
            onCheckedChange={(checked: boolean) =>
              form.setValue("notificationsEnabled", checked)
            }
            aria-label="Enable email notifications"
            className="shrink-0"
          />
        </div>

        <Separator />

        <div className="rounded-lg border bg-muted/30 p-5 space-y-3">
          <div className="space-y-1">
            <Label className="text-sm font-semibold">Notification Types</Label>
            <p className="text-xs text-muted-foreground">
              You will receive email notifications for the following:
            </p>
          </div>
          <ul className="text-sm text-muted-foreground space-y-2 list-none">
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span>Task due date reminders</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span>Overdue task alerts</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span>Task completion confirmations</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span>Account security updates</span>
            </li>
          </ul>
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
            "Save Changes"
          )}
        </Button>
      </div>
    </form>
  );
}
