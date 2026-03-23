"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

interface Constituency {
  id: string;
  name: string;
  mpName: string | null;
  mpEmail: string | null;
  mpParty: string | null;
  mpPhotoUrl: string | null;
  lastSyncedAt: string | null;
  _count: { submissions: number };
}

interface SyncResult {
  success: boolean;
  created: number;
  updated: number;
  unchanged: number;
  total: number;
  syncedAt: string;
  warnings: string[];
  error?: string;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ConstituenciesPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user?.role === "admin") setAuthorized(true);
        else setAuthorized(false);
      })
      .catch(() => setAuthorized(false));
  }, []);

  useEffect(() => {
    if (!authorized) return;
    loadConstituencies();
  }, [authorized]);

  useEffect(() => {
    if (authorized === false) router.push("/auth/login");
  }, [authorized, router]);

  const loadConstituencies = () => {
    fetch("/api/admin/constituencies")
      .then((r) => r.json())
      .then((d) => setConstituencies(d.constituencies || []));
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const res = await fetch("/api/admin/refresh-mp-data", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSyncError(data.error || "Sync failed");
      } else {
        setSyncResult(data as SyncResult);
        loadConstituencies();
      }
    } catch {
      setSyncError("Request failed — could not reach the server.");
    } finally {
      setRefreshing(false);
    }
  };

  const filtered = constituencies.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.mpName?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (c.mpParty?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  const lastSync = constituencies.find((c) => c.lastSyncedAt)?.lastSyncedAt;

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
            {filtered.length !== constituencies.length && ` · ${filtered.length} shown`}
            {lastSync && ` · last synced ${formatDate(lastSync)}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 disabled:opacity-60 transition-colors"
          >
            {refreshing ? "Syncing…" : "Refresh MP Data"}
          </button>
          <Link href="/admin" className="text-sm text-gray-500 hover:text-blue-700">
            ← Admin
          </Link>
        </div>
      </div>

      {syncError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <strong>Sync failed:</strong> {syncError}
        </div>
      )}

      {syncResult && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 flex flex-wrap gap-4 text-sm text-gray-700">
          <span><span className="font-semibold text-green-700">{syncResult.created}</span> created</span>
          <span><span className="font-semibold text-blue-700">{syncResult.updated}</span> updated</span>
          <span><span className="font-semibold text-gray-500">{syncResult.unchanged}</span> unchanged</span>
          <span className="text-gray-400">{syncResult.total} total</span>
          {syncResult.warnings.map((w, i) => (
            <span key={i} className="text-amber-700">⚠ {w}</span>
          ))}
        </div>
      )}

      <input
        type="text"
        placeholder="Search by constituency, MP name, or party…"
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
              <th className="text-left px-4 py-3 font-semibold text-gray-700 hidden lg:table-cell">Party</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700 hidden md:table-cell">Email</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-700">Submissions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  {search
                    ? "No matches found."
                    : "No constituencies yet. Use \u201cRefresh MP Data\u201d to populate."}
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/admin/constituencies/${c.id}`)}
                  className="hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {c.mpName ? (
                      <div className="flex items-center gap-2">
                        {c.mpPhotoUrl && (
                          <Image
                            src={c.mpPhotoUrl}
                            alt={c.mpName}
                            width={28}
                            height={28}
                            className="rounded-full object-cover shrink-0"
                            unoptimized
                          />
                        )}
                        {c.mpName}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">
                    {c.mpParty ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                    {c.mpEmail ? (
                      <a
                        href={`mailto:${c.mpEmail}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-blue-700 hover:underline"
                      >
                        {c.mpEmail}
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
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
