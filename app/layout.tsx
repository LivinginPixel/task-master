import AuthSessionProvider from "@/components/session-provider";
import { ThemeProvider } from "@/components/theme-provider";
import './globals.css';
import Link from "next/link";
import { CheckSquare, Focus } from "lucide-react";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { UserNav } from "@/components/user-nav";
import { NotificationBell } from "@/components/notifications/notification-bell";
import type { Metadata } from 'next';
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import { LoadingScreen } from "@/components/loading-screen";
import { PageTransition } from "@/components/page-transition";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Task Master',
  description: 'A modern task management application',
  icons: {
    icon: [
      { url: '/logo.png', sizes: '32x32', type: 'image/png' },
      { url: '/logo.png', sizes: '16x16', type: 'image/png' },
    ],
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased min-h-screen bg-background text-foreground`} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LoadingScreen />
          <AuthSessionProvider>
            <header className="fixed top-0 left-0 right-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 dark:bg-background/95 dark:supports-[backdrop-filter]:bg-background/60 shadow-sm">
              <div className="container flex h-16 items-center justify-between px-4">
                <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-shrink-0">
                  <CheckSquare className="h-6 w-6 text-primary flex-shrink-0" />
                  <span className="font-semibold text-foreground">Task Master</span>
                </Link>
                <nav className="flex items-center gap-2 sm:gap-3 flex-shrink-0" aria-label="User menu">
                  <Link
                    href="/dashboard/focus"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-accent text-accent-foreground hover:opacity-90 transition-opacity"
                  >
                    <Focus className="h-3.5 w-3.5" />
                    Focus
                  </Link>
                  <NotificationBell />
                  <ThemeSwitcher />
                  <UserNav />
                </nav>
              </div>
            </header>
            <main className="w-full overflow-visible">
              <PageTransition>
                {children}
              </PageTransition>
            </main>
          </AuthSessionProvider>
        </ThemeProvider>
        <Toaster />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
