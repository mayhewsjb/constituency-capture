"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Constituency {
  id: string;
  name: string;
  mpName: string | null;
  mpEmail: string | null;
  digestSendTime: string | null;
  _count: { submissions: number };
}

export default function ConstituenciesPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user?.role === "admin") {
          setAuthorized(true);
        } else {
          setAuthorized(false);
        }
      })
      .catch(() => setAuthorized(false));
  }, []);

  useEffect(() => {
    if (!authorized) return;
    fetch("/api/admin/constituencies")
      .then((r) => r.json())
      .then((d) => setConstituencies(d.constituencies || []));
  }, [authorized]);

  useEffect(() => {
    if (authorized === false) router.push("/auth/login");
  }, [authorized, router]);

  const filtered = constituencies.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.mpName?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  if (authorized === null) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center text-gray-500 animate-pulse">
        Loading…
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Constituencies</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {constituencies.length} total
            {filtered.length !== constituencies.length &&
              ` · ${filtered.length} shown`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-sm text-gray-500 hover:text-blue-700">
            ← Admin
          </Link>
        </div>
      </div>

      <input
        type="text"
        placeholder="Search by constituency or MP name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Constituency</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">MP</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700 hidden md:table-cell">MP Email</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-700">Submissions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  {search ? "No matches found." : "No constituencies yet. Use \u201cRefresh MP Data\u201d in the admin panel."}
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {c.mpName ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                    {c.mpEmail ? (
                      <a
                        href={`mailto:${c.mpEmail}`}
                        className="hover:text-blue-700 hover:underline"
                      >
                        {c.mpEmail}
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                    {c._count.submissions > 0 ? (
                      <span className="inline-flex items-center justify-center bg-blue-50 text-blue-700 font-medium px-2 py-0.5 rounded-full">
                        {c._count.submissions}
                      </span>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
