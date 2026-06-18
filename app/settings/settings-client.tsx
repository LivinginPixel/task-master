"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "next-auth";
import { ProfileForm } from "@/components/settings/profile-form";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { NotificationsForm } from "@/components/settings/notifications-form";
import { AccountSettings } from "@/components/settings/account-settings";
import { User as UserIcon, Bell, Palette, Shield, ChevronRight, ArrowLeft, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface SettingsClientProps {
  user: User;
  preferences: {
    notificationsEnabled: boolean;
    defaultView: "list" | "kanban" | "grid";
    theme: "light" | "dark" | "system";
  };
}

const settingsSections = [
  { id: "profile", label: "Profile", icon: UserIcon },
  { id: "preferences", label: "Preferences", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "account", label: "Account", icon: Shield },
] as const;

export function SettingsClient({ user, preferences }: SettingsClientProps) {
  const [activeSection, setActiveSection] = useState("profile");
  const router = useRouter();

  const activeIcon = settingsSections.find((s) => s.id === activeSection)?.icon || UserIcon;
  const ActiveIcon = activeIcon;
  const currentSectionIndex = settingsSections.findIndex((s) => s.id === activeSection);
  const hasPrevious = currentSectionIndex > 0;
  const hasNext = currentSectionIndex < settingsSections.length - 1;

  const handlePrevious = () => {
    if (hasPrevious) {
      setActiveSection(settingsSections[currentSectionIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      setActiveSection(settingsSections[currentSectionIndex + 1].id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Back Button and Breadcrumbs */}
      <div className="flex items-center justify-between gap-4">
        <motion.button
          onClick={() => router.back()}
          whileHover={{ x: -4, scale: 1.02 }}
          whileTap={{ scale: 0.98, x: -2 }}
          className="relative flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-foreground bg-muted/50 hover:bg-accent/10 border border-border/50 hover:border-accent/30 transition-all duration-200 group overflow-hidden"
        >
          {/* Animated background gradient */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-accent/5 via-accent/10 to-transparent opacity-0 group-hover:opacity-100"
            initial={false}
            transition={{ duration: 0.3 }}
          />
          
          {/* Icon with enhanced animation */}
          <motion.div
            className="relative z-10"
            animate={{
              x: [0, -2, 0],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "easeInOut"
            }}
          >
            <ArrowLeft className="h-4 w-4 relative z-10" />
          </motion.div>
          
          {/* Text with slide effect */}
          <motion.span
            className="relative z-10"
            initial={false}
            whileHover={{ x: -2 }}
            transition={{ duration: 0.2 }}
          >
            Back
          </motion.span>
          
          {/* Shine effect on hover */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full"
            transition={{ duration: 0.6, ease: "easeInOut" }}
          />
        </motion.button>

        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Settings</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-foreground">
            {settingsSections.find((s) => s.id === activeSection)?.label}
          </span>
        </nav>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-12rem)]">
        {/* Sidebar Navigation */}
        <aside className="w-full lg:w-64 shrink-0">
          <div className="sticky top-6">
            <div className="mb-6">
              <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                Manage your account and preferences
              </p>
            </div>
          
          <nav className="space-y-1" aria-label="Settings navigation">
            {settingsSections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setActiveSection(section.id);
                    }
                  }}
                  className={cn(
                    "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isActive
                      ? "bg-accent text-accent-foreground shadow-sm"
                      : "text-muted-foreground"
                  )}
                  aria-label={`${section.label} settings`}
                  aria-current={isActive ? "page" : undefined}
                  tabIndex={0}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={cn(
                      "h-4 w-4",
                      isActive ? "text-foreground" : "text-muted-foreground"
                    )} />
                    <span>{section.label}</span>
                  </div>
                  {isActive && (
                    <ChevronRight className="h-4 w-4 text-foreground" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="space-y-1 mb-6 pb-4 border-b">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <ActiveIcon className="h-5 w-5 text-accent" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold">
                  {settingsSections.find((s) => s.id === activeSection)?.label}
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {activeSection === "profile" && "Update your personal information and profile picture"}
                  {activeSection === "preferences" && "Customize your Task-Master experience and appearance"}
                  {activeSection === "notifications" && "Manage how you receive notifications and reminders"}
                  {activeSection === "account" && "Manage your account security and privacy settings"}
                </p>
              </div>
            </div>
          </div>

          <div className="max-w-3xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeSection === "profile" && <ProfileForm user={user} />}
                {activeSection === "preferences" && (
                  <PreferencesForm initialPreferences={preferences} />
                )}
                {activeSection === "notifications" && (
                  <NotificationsForm initialNotificationsEnabled={preferences.notificationsEnabled} />
                )}
                {activeSection === "account" && <AccountSettings user={user} />}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between gap-4 mt-8 pt-6 border-t">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={!hasPrevious}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Previous</span>
            </Button>

            {/* Section Indicators */}
            <div className="flex items-center gap-2">
              {settingsSections.map((section, index) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "h-2 rounded-full transition-all",
                    index === currentSectionIndex
                      ? "w-8 bg-accent"
                      : "w-2 bg-muted hover:bg-muted-foreground/50"
                  )}
                  aria-label={`Go to ${section.label}`}
                />
              ))}
            </div>

            <Button
              variant="outline"
              onClick={handleNext}
              disabled={!hasNext}
              className="flex items-center gap-2"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}
