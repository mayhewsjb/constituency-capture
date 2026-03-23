"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

interface User {
  userId: string;
  email: string;
  role: string;
}

export function NavBar() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  if (pathname === "/") return null;

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setUser(data.user);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/");
    router.refresh();
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-blue-700">
            Constituency Capture
          </span>
        </Link>

        <div className="flex items-center gap-4 text-sm">
          {!loading && (
            <>
              {user ? (
                <>
                  <span className="text-gray-600 hidden sm:inline">
                    {user.email}
                  </span>
                  <Link
                    href="/submissions"
                    className="text-gray-600 hover:text-blue-700"
                  >
                    My Submissions
                  </Link>
                  {user.role === "admin" && (
                    <>
                      <Link
                        href="/admin"
                        className="text-gray-600 hover:text-blue-700"
                      >
                        Admin
                      </Link>
                      <Link
                        href="/admin/constituencies"
                        className="text-gray-600 hover:text-blue-700"
                      >
                        Constituencies
                      </Link>
                    </>
                  )}
                  <button
                    onClick={handleLogout}
                    className="text-gray-600 hover:text-red-600"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    className="text-gray-600 hover:text-blue-700"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/auth/register"
                    className="bg-blue-700 text-white px-3 py-1.5 rounded-md hover:bg-blue-800 transition-colors"
                  >
                    Register
                  </Link>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
