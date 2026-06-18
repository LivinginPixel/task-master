import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const protectedRoutes = ["/dashboard"];

export default withAuth(
  async function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Skip NextAuth API routes entirely
    if (pathname.startsWith("/api/auth")) {
      return NextResponse.next();
    }

    const isAuthPage = pathname.startsWith("/auth");
    const isAuthenticated = !!token;

    // Redirect logged-in users away from login/signup pages
    if (isAuthenticated && isAuthPage) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // Redirect unauthenticated users trying to access protected routes
    const requiresAuth = protectedRoutes.some((route) => pathname.startsWith(route));
    if (!isAuthenticated && requiresAuth) {
      return NextResponse.redirect(new URL("/auth/signin", req.url));
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/auth/signin",
    },
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;
        const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));
        if (isProtected) return !!token;
        return true; // allow public pages
      },
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/auth/:path*",
  ],
};
