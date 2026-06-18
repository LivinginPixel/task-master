"use client";

import { useState } from "react";
import { User } from "next-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { Icons } from "@/components/ui/icons";
import { signOut } from "next-auth/react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, LogOut, Trash2 } from "lucide-react";

interface AccountSettingsProps {
  user: User;
}

export function AccountSettings({ user }: AccountSettingsProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut({ callbackUrl: "/" });
    } catch {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") {
      toast({
        title: "Invalid confirmation",
        description: "Please type 'DELETE' to confirm account deletion.",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch("/api/user/delete-account", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirmation: "DELETE" }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete account");
      }

      toast({
        title: "Account deleted",
        description: "Your account has been permanently deleted.",
      });

      // Sign out and redirect
      await signOut({ callbackUrl: "/" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete account. Please try again.",
        variant: "destructive",
      });
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Account Information */}
      <div className="space-y-6">
        <div className="space-y-1">
          <Label className="text-sm font-semibold">Account Information</Label>
          <p className="text-xs text-muted-foreground">
            View your account details and identification information.
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Email Address</Label>
            <div className="max-w-lg">
              <Input
                value={user.email || ""}
                disabled
                className="bg-muted/50 cursor-not-allowed"
                aria-label="Email address (read-only)"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Your email address is used for account identification and notifications.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Account ID</Label>
            <div className="max-w-lg">
              <Input
                value={user.id}
                disabled
                className="bg-muted/50 cursor-not-allowed font-mono text-xs"
                aria-label="Account ID (read-only)"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Your unique account identifier. Keep this private.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Separator className="my-8" />

      {/* Session Management */}
      <div className="space-y-4">
        <div className="space-y-1">
          <Label className="text-sm font-semibold">Session Management</Label>
          <p className="text-xs text-muted-foreground">
            Sign out of your account on this device.
          </p>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              disabled={isLoading}
              aria-label="Sign out of account"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sign out of your account?</AlertDialogTitle>
              <AlertDialogDescription>
                You will need to sign in again to access your account and tasks.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleSignOut}
                disabled={isLoading}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {isLoading ? (
                  <>
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                    Signing out...
                  </>
                ) : (
                  "Sign Out"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Separator className="my-8" />

      {/* Danger Zone */}
      <div className="space-y-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <Label className="text-sm font-semibold text-destructive">Danger Zone</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Irreversible and destructive actions. Proceed with caution.
          </p>
        </div>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              className="w-full sm:w-auto"
              disabled={isDeleting}
              aria-label="Delete account"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Delete Your Account
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-3 pt-2">
                <p>
                  This action cannot be undone. This will permanently delete your account and remove all of your data from our servers.
                </p>
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 space-y-1.5">
                  <p className="text-sm font-medium text-destructive">What will be deleted:</p>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside ml-1">
                    <li>Your profile and account information</li>
                    <li>All your tasks and subtasks</li>
                    <li>Your preferences and settings</li>
                    <li>All associated data</li>
                  </ul>
                </div>
                <div className="space-y-2 pt-2">
                  <Label htmlFor="delete-confirm" className="text-sm font-medium">
                    Type <span className="font-mono font-semibold text-destructive">DELETE</span> to confirm:
                  </Label>
                  <Input
                    id="delete-confirm"
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder="DELETE"
                    className="font-mono"
                    disabled={isDeleting}
                    aria-label="Type DELETE to confirm account deletion"
                  />
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setDeleteConfirmation("");
                  setShowDeleteDialog(false);
                }}
                disabled={isDeleting}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAccount}
                disabled={isDeleting || deleteConfirmation !== "DELETE"}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? (
                  <>
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Account
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
