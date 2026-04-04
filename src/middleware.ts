import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const role = req.cookies.get("role")?.value || "SYSTEM";

  // Perform background auditing without blocking the main request
  const shouldAudit = 
    !pathname.startsWith("/_next") &&
    !pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js)$/) &&
    pathname !== "/api/audit" &&
    pathname !== "/api/auth/me";

  if (shouldAudit) {
    const isDataDownload = pathname.includes("/api/datasets/") && pathname.endsWith("/data") && req.method === "GET";
    const isApiAction = pathname.startsWith("/api") && (req.method !== "GET" || isDataDownload);
    const isPageVisit = !pathname.startsWith("/api") && req.method === "GET";
    const isLogin = pathname === "/api/auth/login" && req.method === "POST";

    if (isApiAction || isPageVisit || isLogin) {
      // Create a background promise for the audit log
      (async () => {
        try {
          const username = req.cookies.get("username")?.value || "Unknown";
          let actionType = isLogin ? "LOG_IN" : isApiAction ? `API ${req.method}` : "PAGE_VISIT";
          if (isDataDownload) actionType = "DATA_DOWNLOAD";

          let detailedDescription = "";
          
          // Only parse body if it's a small JSON request and useful for auditing
          // Avoid req.clone().json() on large file uploads or common data routes
          if (isApiAction && !isLogin && req.method !== "DELETE") {
             // Optional: can add specific high-value auditing here, 
             // but we'll keep it light for performance
          } else if (isDataDownload) {
             detailedDescription = `User downloaded dataset (ID: ${pathname.split('/')[3] || 'Unknown'})`;
          }

          // Fire and forget - do NOT await this in the main middleware flow
          fetch(new URL("/api/audit", req.url).toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: username,
              userRole: role,
              action: actionType,
              page: pathname,
              details: { method: req.method, description: detailedDescription || undefined }
            }),
          }).catch(err => console.error("Background audit log failed:", err));
        } catch (err) {
          // background errors shouldn't crash the request
        }
      })();
    }
  }

  // ALLOW LIST: api routes, login, and access-denied pages
  if (pathname.startsWith("/api") || pathname.startsWith("/login") || pathname === "/access-denied") {
    return NextResponse.next();
  }

  // Session check
  const isLoggedIn = req.cookies.get("loggedIn")?.value === "true";
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // RBAC checks
  if (pathname.startsWith("/admin") || pathname === "/audit-logs" || pathname === "/user-management") {
    if (role !== "ADMIN") {
      return NextResponse.redirect(new URL("/access-denied", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|public).*)"],
};
