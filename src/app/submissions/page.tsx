"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Submission {
  id: string;
  textContent: string | null;
  voiceMemoPath: string | null;
  photoPath: string | null;
  locationStatus: string;
  postcode: string | null;
  isAwayFromArea: boolean;
  anonymised: boolean;
  createdAt: string;
  constituency: { name: string; mpName: string | null } | null;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function locationLabel(s: Submission) {
  if (s.locationStatus === "granted") return "GPS detected";
  if (s.locationStatus === "away") return "Away from area";
  if (s.locationStatus === "postcode") return `Postcode: ${s.postcode}`;
  return "Location not provided";
}

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/submissions")
      .then((r) => {
        if (r.status === 401) throw new Error("unauthenticated");
        return r.json();
      })
      .then((d) => setSubmissions(d.submissions))
      .catch((e) => {
        if (e.message === "unauthenticated") {
          setError("login");
        } else {
          setError("Failed to load submissions.");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-500">
        Loading…
      </div>
    );
  }

  if (error === "login") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-600 mb-4">
          You need to be logged in to view your submissions.
        </p>
        <Link
          href="/auth/login"
          className="bg-blue-700 text-white px-5 py-2 rounded-lg hover:bg-blue-800"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Submissions</h1>
        <Link
          href="/"
          className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-800 transition-colors"
        >
          New submission
        </Link>
      </div>

      {submissions.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-500">
          <p className="mb-4">You haven&apos;t submitted anything yet.</p>
          <Link href="/" className="text-blue-700 hover:underline">
            Make your first submission
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {submissions.map((sub) => (
            <div
              key={sub.id}
              className="bg-white border border-gray-200 rounded-xl p-6 space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {sub.textContent ? (
                    <p className="text-gray-800 line-clamp-3">
                      {sub.textContent}
                    </p>
                  ) : (
                    <p className="text-gray-400 italic">
                      {sub.voiceMemoPath ? "Voice memo" : "Photo submission"}
                    </p>
                  )}
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {formatDate(sub.createdAt)}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                {sub.constituency && (
                  <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">
                    {sub.constituency.name}
                    {sub.constituency.mpName &&
                      ` · ${sub.constituency.mpName}`}
                  </span>
                )}
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {locationLabel(sub)}
                </span>
                {sub.voiceMemoPath && (
                  <span className="bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-full">
                    🎙 Voice memo
                  </span>
                )}
                {sub.photoPath && (
                  <span className="bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-full">
                    📷 Photo
                  </span>
                )}
                {sub.anonymised && (
                  <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full">
                    Anonymous
                  </span>
                )}
              </div>

              {sub.voiceMemoPath && (
                <audio
                  src={sub.voiceMemoPath}
                  controls
                  className="w-full mt-2"
                />
              )}
              {sub.photoPath && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={sub.photoPath}
                  alt="Submitted photo"
                  className="max-h-40 rounded-lg object-cover border border-gray-200 mt-2"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
