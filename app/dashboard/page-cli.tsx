"use client";

import { ComprehensiveDashboard } from "@/components/dashboard/comprehensive-dashboard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface DashboardClientProps {
  userName: string;
  dbConnected: boolean;
  defaultView?: "list" | "kanban";
}

export function DashboardClient({ userName, dbConnected, defaultView }: DashboardClientProps) {
  return (
    <>
      {!dbConnected && (
        <div className="container mx-auto px-4 pt-4">
          <Alert variant="destructive" className="animate-in slide-in-from-top-2 duration-500 text-sm">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs sm:text-sm">
              Database connection failed. Please check your DATABASE_URL in .env file.
              You can view the page, but data operations will not work.
            </AlertDescription>
          </Alert>
        </div>
      )}
      <ComprehensiveDashboard userName={userName} dbConnected={dbConnected} defaultView={defaultView} />
    </>
  );
}
