import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const role = req.cookies.get("role")?.value || "SYSTEM";

  // Fire and forget audit log for all requests (non GET = Action; GET non-api = Page Visit)
  if (
    !pathname.startsWith("/_next") &&
    !pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js)$/) &&
    pathname !== "/api/audit" &&
    pathname !== "/api/auth/me" // too noisy
  ) {
    const isDataDownload = pathname.includes("/api/datasets/") && pathname.endsWith("/data") && req.method === "GET";
    const isApiAction = pathname.startsWith("/api") && (req.method !== "GET" || isDataDownload);
    const isPageVisit = !pathname.startsWith("/api") && req.method === "GET";
    
    // Always log login attempts
    const isLogin = pathname === "/api/auth/login" && req.method === "POST";
    
    if (isApiAction || isPageVisit || isLogin) {
      let actionType = isLogin ? "LOG_IN" : isApiAction ? `API ${req.method}` : "PAGE_VISIT";
      if (isDataDownload) actionType = "DATA_DOWNLOAD";

      let detailedDescription = "";
      
    const contentType = req.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const isMultipart = contentType.includes("multipart/form-data");
    
    if (isApiAction && req.method !== "DELETE" && !isLogin && isJson && !isMultipart) {
        try {
          const body = await req.clone().json();
          if (pathname === "/api/module-access") {
            detailedDescription = `Modified module access for a group (action: ${body.action})`;
          } else if (pathname === "/api/users" && req.method === "POST") {
            detailedDescription = `Created user ${body.user_name || body.user_email || ""}`;
          } else if (pathname === "/api/groups") {
            detailedDescription = `Created group ${body.group_name || ""}`;
          } else if (pathname.includes("/user-access-filters")) {
            detailedDescription = `Modified access filters for a dataset`;
          } else if (pathname === "/api/app-actions") {
             detailedDescription = `Modified app actions (Dataset access)`;
          } else if (pathname.includes("/groups")) {
             detailedDescription = `Assigned user to group`;
          }
        } catch (e) {
             // ignore parse errors
        }
      } else if (isDataDownload) {
          detailedDescription = `User downloaded dataset (ID: ${pathname.split('/')[3] || 'Unknown'})`;
      }

      try {
        const username = req.cookies.get("username")?.value || "Unknown";
        
        // Await the fetch so that Next.js Edge runtime does not cancel it prematurely
        await fetch(new URL("/api/audit", req.url).toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: username,
            userRole: role,
            action: actionType,
            page: pathname,
            details: { method: req.method, description: detailedDescription || undefined }
          }),
        });
      } catch (err) {
        console.error("Audit log failed to save in middleware:", err);
      }
    }
  }

  // Allow api routes, login and access-denied pages without restriction
  if (pathname.startsWith("/api") || pathname.startsWith("/login") || pathname === "/access-denied") {
    return NextResponse.next();
  }

  // Check if user has a session cookie
  const isLoggedIn = req.cookies.get("loggedIn")?.value === "true";

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Check role for admin and audit-logs access
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
