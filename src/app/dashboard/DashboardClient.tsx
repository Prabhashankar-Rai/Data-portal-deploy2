"use client";

import { useEffect, useState } from "react";

export default function DashboardClient() {
  const [user, setUser] = useState<{ name?: string; email?: string }>({});

  useEffect(() => {
    // Read cookies and extract user info
    const cookies = document.cookie.split(";").reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split("=");
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    setUser({
      name: cookies.name,
      email: cookies.email,
    });
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Welcome, {user.name || "User"}!</h1>
      <p>Your email: {user.email || "Not available"}</p>
      <p>This is your dashboard.</p>
    </div>
  );
}