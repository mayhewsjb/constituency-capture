"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

interface Constituency {
  id: string;
  name: string;
  mpName: string | null;
  mpEmail: string | null;
  mpParty: string | null;
  mpPhotoUrl: string | null;
  mpParliamentId: string | null;
  lastSyncedAt: string | null;
}

interface Submission {
  id: string;
  textContent: string | null;
  voiceMemoPath: string | null;
  photoPath: string | null;
  anonymised: boolean;
  locationStatus: string;
  createdAt: string;
  user: { email: string } | null;
}

interface Pagination {
  page: number;
  pages: number;
  total: number;
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

export default function ConstituencyDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [constituency, setConstituency] = useState<Constituency | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    if (authorized === false) router.push("/auth/login");
  }, [authorized, router]);

  useEffect(() => {
    if (!authorized) return;
    setLoading(true);
    fetch(`/api/admin/constituencies/${id}?page=${page}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { router.push("/admin/constituencies"); return; }
        setConstituency(d.constituency);
        setSubmissions(d.submissions);
        setPagination(d.pagination);
      })
      .finally(() => setLoading(false));
  }, [authorized, id, page, router]);

  if (authorized === null || loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-gray-500 animate-pulse">
        Loading…
      </div>
    );
  }

  if (!constituency) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      {/* Back */}
      <Link href="/admin/constituencies" className="text-sm text-gray-500 hover:text-blue-700">
        ← Constituencies
      </Link>

      {/* Constituency header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          {constituency.mpPhotoUrl && constituency.mpName && (
            <Image
              src={constituency.mpPhotoUrl}
              alt={constituency.mpName}
              width={64}
              height={64}
              className="rounded-full object-cover shrink-0"
              unoptimized
            />
          )}
          <div className="space-y-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">{constituency.name}</h1>
            {constituency.mpName && (
              <p className="text-gray-700 font-medium">{constituency.mpName}</p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
              {constituency.mpParty && <span>{constituency.mpParty}</span>}
              {constituency.mpEmail && (
                <a href={`mailto:${constituency.mpEmail}`} className="hover:text-blue-700 hover:underline">
                  {constituency.mpEmail}
                </a>
              )}
            </div>
            {constituency.lastSyncedAt && (
              <p className="text-xs text-gray-400">Last synced {formatDate(constituency.lastSyncedAt)}</p>
            )}
          </div>
        </div>
      </div>

      {/* Submissions */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">
            Submissions
            {pagination && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({pagination.total} total)
              </span>
            )}
          </h2>
        </div>

        {submissions.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl px-6 py-10 text-center text-sm text-gray-400">
            No submissions for this constituency yet.
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
            {submissions.map((sub) => (
              <div key={sub.id}>
                {/* Row */}
                <button
                  onClick={() => setExpandedId(expandedId === sub.id ? null : sub.id)}
                  className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      {/* Text preview */}
                      <p className="text-sm text-gray-800 truncate">
                        {sub.textContent
                          ? sub.textContent
                          : <span className="text-gray-400 italic">No text</span>}
                      </p>
                      {/* Meta */}
                      <p className="text-xs text-gray-400">
                        {formatDate(sub.createdAt)}
                        {sub.user ? ` · ${sub.user.email}` : " · Anonymous"}
                      </p>
                    </div>
                    {/* Badges */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {sub.textContent && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">T</span>
                      )}
                      {sub.voiceMemoPath && (
                        <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded">🎙</span>
                      )}
                      {sub.photoPath && (
                        <span className="text-xs bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">📷</span>
                      )}
                      {sub.anonymised && (
                        <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">Anon</span>
                      )}
                      <span className="text-gray-300 text-xs ml-1">
                        {expandedId === sub.id ? "▲" : "▼"}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Expanded detail */}
                {expandedId === sub.id && (
                  <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 space-y-3 text-sm">
                    {sub.textContent && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Text</p>
                        <p className="text-gray-800 whitespace-pre-wrap">{sub.textContent}</p>
                      </div>
                    )}
                    {sub.voiceMemoPath && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Voice memo</p>
                        <audio src={sub.voiceMemoPath} controls className="w-full max-w-sm" />
                      </div>
                    )}
                    {sub.photoPath && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Photo</p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={sub.photoPath} alt="Submission photo" className="max-h-48 rounded-lg border border-gray-200 object-cover" />
                      </div>
                    )}
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-400">
                      <span>Location: {sub.locationStatus}</span>
                      <span>Anonymised: {sub.anonymised ? "yes" : "no"}</span>
                      {sub.user && <span>Account: {sub.user.email}</span>}
                      <span className="font-mono">ID: {sub.id}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="border border-gray-300 px-3 py-1.5 rounded text-sm disabled:opacity-40 hover:bg-gray-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">Page {page} of {pagination.pages}</span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
              disabled={page === pagination.pages}
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
