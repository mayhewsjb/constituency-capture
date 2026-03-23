"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Submission {
  id: string;
  textContent: string | null;
  voiceMemoPath: string | null;
  photoPath: string | null;
  locationStatus: string;
  postcode: string | null;
  anonymised: boolean;
  createdAt: string;
  constituency: { name: string } | null;
  user: { email: string } | null;
}

interface PendingUser {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

interface Pagination {
  page: number;
  pages: number;
  total: number;
}

interface AdminSettings {
  id: string;
  digestFrequency: string | null;
  digestDay: string | null;
  digestTime: string | null;
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

export default function AdminPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [digestFrequency, setDigestFrequency] = useState("weekly");
  const [digestDay, setDigestDay] = useState("monday");
  const [digestTime, setDigestTime] = useState("08:00");
  const [digestSaving, setDigestSaving] = useState(false);
  const [digestSaved, setDigestSaved] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [userActionMsg, setUserActionMsg] = useState<string | null>(null);
  const [firstBootSync, setFirstBootSync] = useState(false);

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
    fetchSubmissions(currentPage);
    fetchPendingUsers();
    fetchSettings();
    checkAndAutoSync();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, currentPage]);

  const fetchSubmissions = async (page: number) => {
    const res = await fetch(`/api/admin/submissions?page=${page}&limit=20`);
    const data = await res.json();
    setSubmissions(data.submissions || []);
    setPagination(data.pagination);
  };

  const fetchPendingUsers = async () => {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setPendingUsers(data.users || []);
  };

  const fetchSettings = async () => {
    const res = await fetch("/api/admin/settings");
    const data = await res.json();
    if (data.settings) {
      setSettings(data.settings);
      setDigestFrequency(data.settings.digestFrequency || "weekly");
      setDigestDay(data.settings.digestDay || "monday");
      setDigestTime(data.settings.digestTime || "08:00");
    }
  };

  const checkAndAutoSync = async () => {
    const res = await fetch("/api/admin/constituencies?countOnly=true");
    const data = await res.json();
    if (data.count === 0) {
      setFirstBootSync(true);
      const result = await runSync();
      if (result) setSyncResult(result);
    }
  };

  const runSync = async (): Promise<SyncResult | null> => {
    setRefreshing(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const res = await fetch("/api/admin/refresh-mp-data", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSyncError(data.error || "Sync failed");
        return null;
      }
      return data as SyncResult;
    } catch {
      setSyncError("Request failed — could not reach the server.");
      return null;
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefreshMPs = async () => {
    const result = await runSync();
    if (result) setSyncResult(result);
  };

  const handleUserAction = async (userId: string, action: "approve" | "reject") => {
    setUserActionMsg(null);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action }),
    });
    const data = await res.json();
    if (data.success) {
      setUserActionMsg(`User ${action}d successfully.`);
      fetchPendingUsers();
    }
  };

  const handleSaveDigest = async () => {
    setDigestSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digestFrequency, digestDay, digestTime }),
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        setDigestSaved(true);
        setTimeout(() => setDigestSaved(false), 2000);
      }
    } finally {
      setDigestSaving(false);
    }
  };

  if (authorized === null) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center text-gray-500 animate-pulse">
        Loading…
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
        <p className="text-gray-600 mb-6">You must be an admin to access this page.</p>
        <button
          onClick={() => router.push("/auth/login")}
          className="bg-blue-700 text-white px-5 py-2 rounded-lg hover:bg-blue-800"
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <Link href="/admin/constituencies" className="text-sm text-blue-700 hover:underline">
          View constituencies & MPs →
        </Link>
      </div>

      {/* First-boot banner */}
      {firstBootSync && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 text-sm text-blue-800">
          <strong>Initial data sync ran on first load.</strong> Constituency and MP data has been
          populated from the UK Parliament Members API.
        </div>
      )}

      {/* Settings section */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Settings</h2>

        <div className="space-y-4">
          {/* Digest schedule */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Default digest schedule
            </label>

            {/* Frequency picker */}
            <div className="flex gap-2">
              {(["daily", "weekly", "monthly"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    setDigestFrequency(f);
                    if (f === "weekly") setDigestDay("monday");
                    if (f === "monthly") setDigestDay("1");
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${
                    digestFrequency === f
                      ? "bg-blue-700 text-white border-blue-700"
                      : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Day picker — weekly */}
              {digestFrequency === "weekly" && (
                <select
                  value={digestDay}
                  onChange={(e) => setDigestDay(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].map((d) => (
                    <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                  ))}
                </select>
              )}

              {/* Day picker — monthly */}
              {digestFrequency === "monthly" && (
                <select
                  value={digestDay}
                  onChange={(e) => setDigestDay(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Array.from({ length: 28 }, (_, i) => String(i + 1)).map((d) => (
                    <option key={d} value={d}>
                      {d}{["1","21"].includes(d) ? "st" : ["2","22"].includes(d) ? "nd" : ["3","23"].includes(d) ? "rd" : "th"} of the month
                    </option>
                  ))}
                </select>
              )}

              {/* Time picker — always shown */}
              <input
                type="time"
                value={digestTime}
                onChange={(e) => setDigestTime(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <button
                onClick={handleSaveDigest}
                disabled={digestSaving}
                className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-800 disabled:opacity-60 transition-colors"
              >
                {digestSaved ? "Saved!" : digestSaving ? "Saving…" : "Save"}
              </button>
            </div>

            {settings && (
              <p className="text-xs text-gray-400">
                Current:{" "}
                {settings.digestFrequency === "daily" && `Daily at ${settings.digestTime}`}
                {settings.digestFrequency === "weekly" && `Every ${settings.digestDay?.charAt(0).toUpperCase()}${settings.digestDay?.slice(1)} at ${settings.digestTime}`}
                {settings.digestFrequency === "monthly" && `${settings.digestDay}${["1","21"].includes(settings.digestDay ?? "") ? "st" : ["2","22"].includes(settings.digestDay ?? "") ? "nd" : ["3","23"].includes(settings.digestDay ?? "") ? "rd" : "th"} of the month at ${settings.digestTime}`}
              </p>
            )}
          </div>
        </div>

          {/* Refresh MP data */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              MP data (UK Parliament Members API)
            </label>
            <button
              onClick={handleRefreshMPs}
              disabled={refreshing}
              className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 disabled:opacity-60 transition-colors"
            >
              {refreshing ? "Syncing…" : "Refresh MP Data"}
            </button>

            {syncError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                <strong>Sync failed:</strong> {syncError}
              </div>
            )}

            {syncResult && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 space-y-2 text-sm">
                <div className="flex flex-wrap gap-4 text-gray-700">
                  <span>
                    <span className="font-semibold text-green-700">{syncResult.created}</span> created
                  </span>
                  <span>
                    <span className="font-semibold text-blue-700">{syncResult.updated}</span> updated
                  </span>
                  <span>
                    <span className="font-semibold text-gray-500">{syncResult.unchanged}</span> unchanged
                  </span>
                  <span className="text-gray-400">
                    {syncResult.total} total
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  Last synced {formatDate(syncResult.syncedAt)}
                </p>
                {syncResult.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1">
                    ⚠ {w}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Pending users */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">
          Pending Government Registrations
          {pendingUsers.length > 0 && (
            <span className="ml-2 bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">
              {pendingUsers.length}
            </span>
          )}
        </h2>

        {userActionMsg && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
            {userActionMsg}
          </p>
        )}

        {pendingUsers.length === 0 ? (
          <p className="text-sm text-gray-500">No pending registrations.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2 font-medium">Email</th>
                  <th className="pb-2 font-medium">Role</th>
                  <th className="pb-2 font-medium">Registered</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pendingUsers.map((u) => (
                  <tr key={u.id}>
                    <td className="py-3 text-gray-800">{u.email}</td>
                    <td className="py-3 text-gray-600 capitalize">{u.role}</td>
                    <td className="py-3 text-gray-500">{formatDate(u.createdAt)}</td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUserAction(u.id, "approve")}
                          className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleUserAction(u.id, "reject")}
                          className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Submissions */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">
            All Submissions
            {pagination && (
              <span className="ml-2 text-sm text-gray-500 font-normal">
                ({pagination.total} total)
              </span>
            )}
          </h2>
        </div>

        {submissions.length === 0 ? (
          <p className="text-sm text-gray-500">No submissions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Constituency</th>
                  <th className="pb-2 font-medium">User</th>
                  <th className="pb-2 font-medium">Content</th>
                  <th className="pb-2 font-medium">Location</th>
                  <th className="pb-2 font-medium">Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {submissions.map((sub) => (
                  <tr key={sub.id} className="align-top">
                    <td className="py-3 text-gray-500 whitespace-nowrap">
                      {formatDate(sub.createdAt)}
                    </td>
                    <td className="py-3 text-gray-800">
                      {sub.constituency?.name || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="py-3 text-gray-600">
                      {sub.user?.email || <span className="text-gray-400">Anon</span>}
                    </td>
                    <td className="py-3 text-gray-800 max-w-xs">
                      {sub.textContent ? (
                        <span className="line-clamp-2">{sub.textContent}</span>
                      ) : (
                        <span className="text-gray-400 italic">
                          {sub.voiceMemoPath ? "Voice" : sub.photoPath ? "Photo" : "—"}
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-gray-600 capitalize">
                      {sub.locationStatus}
                      {sub.postcode && ` (${sub.postcode})`}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1">
                        {sub.anonymised && (
                          <span className="bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.5 rounded text-xs">
                            Anon
                          </span>
                        )}
                        {sub.voiceMemoPath && (
                          <span className="bg-red-50 text-red-700 border border-red-100 px-1.5 py-0.5 rounded text-xs">
                            🎙
                          </span>
                        )}
                        {sub.photoPath && (
                          <span className="bg-purple-50 text-purple-700 border border-purple-100 px-1.5 py-0.5 rounded text-xs">
                            📷
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between pt-4">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="border border-gray-300 px-3 py-1.5 rounded text-sm disabled:opacity-40 hover:bg-gray-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">
              Page {pagination.page} of {pagination.pages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(pagination.pages, p + 1))}
              disabled={currentPage === pagination.pages}
              className="border border-gray-300 px-3 py-1.5 rounded text-sm disabled:opacity-40 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
