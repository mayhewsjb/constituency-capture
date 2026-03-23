"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Constituency {
  id: string;
  name: string;
  mpName?: string | null;
}

interface User {
  userId: string;
  email: string;
  role: string;
}

function generateFingerprint(): string {
  const data = [
    navigator.userAgent,
    screen.width + "x" + screen.height,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join("|");

  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

export function SubmissionForm() {
  const [user, setUser] = useState<User | null>(null);

  // Content state
  const [textContent, setTextContent] = useState("");
  const [voicePath, setVoicePath] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Location state
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "requesting" | "granted" | "denied" | "away" | "postcode"
  >("idle");
  const [constituency, setConstituency] = useState<Constituency | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [postcode, setPostcode] = useState("");
  const [isAwayFromArea, setIsAwayFromArea] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [lookingUpConstituency, setLookingUpConstituency] = useState(false);

  // Form state
  const [anonymised, setAnonymised] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user));
  }, []);

  // Request location when form is first interacted with (lazy)
  const requestLocation = () => {
    setLocationStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setLatitude(lat);
        setLongitude(lng);
        setLocationStatus("granted");
        setLookingUpConstituency(true);
        try {
          const res = await fetch(`/api/mapIt?lat=${lat}&lng=${lng}`);
          const data = await res.json();
          if (data.constituency) {
            setConstituency(data.constituency);
          }
        } catch {
          // Silently fail — location still recorded
        } finally {
          setLookingUpConstituency(false);
        }
      },
      () => {
        setLocationStatus("denied");
      },
      { timeout: 10000 }
    );
  };

  const lookupPostcode = async () => {
    if (!postcode.trim()) return;
    setLookingUpConstituency(true);
    setLocationError(null);
    try {
      const res = await fetch(
        `/api/mapIt?postcode=${encodeURIComponent(postcode.trim())}`
      );
      const data = await res.json();
      if (data.constituency) {
        setConstituency(data.constituency);
        setLocationStatus("postcode");
      } else {
        setLocationError(data.error || "Postcode not found");
      }
    } catch {
      setLocationError("Failed to look up postcode");
    } finally {
      setLookingUpConstituency(false);
    }
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // Upload the recording
        const formData = new FormData();
        formData.append("file", blob, "voice-memo.webm");
        formData.append("type", "voice");
        try {
          const res = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });
          const data = await res.json();
          if (data.path) setVoicePath(data.path);
        } catch {
          // Keep audio URL for playback even if upload fails
        }

        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const preview = URL.createObjectURL(file);
    setPhotoPreview(preview);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "photo");
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.path) setPhotoPath(data.path);
    } catch {
      // Keep preview even if upload fails
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!textContent && !voicePath && !photoPath) {
      setSubmitError(
        "Please add at least some text, a voice memo, or a photo."
      );
      return;
    }

    setSubmitting(true);

    const finalLocationStatus = isAwayFromArea
      ? "away"
      : locationStatus === "postcode"
      ? "postcode"
      : locationStatus === "granted"
      ? "granted"
      : "denied";

    try {
      const fingerprint = generateFingerprint();
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          textContent: textContent || null,
          voiceMemoPath: voicePath,
          photoPath,
          deviceFingerprint: fingerprint,
          locationStatus: finalLocationStatus,
          latitude,
          longitude,
          postcode: postcode || null,
          isAwayFromArea,
          constituencyId: constituency?.id || null,
          anonymised,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Failed to submit");
      } else {
        setSubmitted(true);
      }
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="bg-green-50 border border-green-200 rounded-xl p-10">
          <div className="text-5xl mb-4">✓</div>
          <h2 className="text-2xl font-bold text-green-800 mb-2">
            Submission received
          </h2>
          <p className="text-green-700 mb-6">
            Thank you. Your concern has been recorded
            {constituency ? ` for ${constituency.name}` : ""} and will be
            included in the next MP digest.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => {
                setSubmitted(false);
                setTextContent("");
                setVoicePath(null);
                setAudioUrl(null);
                setPhotoPath(null);
                setPhotoPreview(null);
                setLocationStatus("idle");
                setConstituency(null);
              }}
              className="bg-green-700 text-white px-5 py-2 rounded-lg hover:bg-green-800 transition-colors"
            >
              Submit another
            </button>
            {user && (
              <Link
                href="/submissions"
                className="border border-green-700 text-green-700 px-5 py-2 rounded-lg hover:bg-green-50 transition-colors"
              >
                View my submissions
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Submit a concern
        </h1>
        <p className="text-gray-600">
          Share what matters to you. Your submission will be included in a
          digest sent to your local MP.
        </p>
      </div>

      {/* Text area */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Your concern</h2>
        <textarea
          value={textContent}
          onChange={(e) => setTextContent(e.target.value)}
          placeholder="Describe your concern or complaint in your own words..."
          rows={5}
          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </section>

      {/* Voice memo */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Voice memo (optional)</h2>
        {!isRecording && !audioUrl && (
          <button
            type="button"
            onClick={startRecording}
            className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg hover:bg-red-100 transition-colors"
          >
            <span className="text-lg">🎙</span>
            Record voice memo
          </button>
        )}
        {isRecording && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-red-600">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
              Recording {formatTime(recordingSeconds)}
            </div>
            <button
              type="button"
              onClick={stopRecording}
              className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm"
            >
              Stop recording
            </button>
          </div>
        )}
        {audioUrl && (
          <div className="space-y-2">
            <audio src={audioUrl} controls className="w-full" />
            <button
              type="button"
              onClick={() => {
                setAudioUrl(null);
                setVoicePath(null);
              }}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Remove recording
            </button>
          </div>
        )}
      </section>

      {/* Photo upload */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Photo (optional)</h2>
        {!photoPreview ? (
          <label className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2.5 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer w-fit">
            <span className="text-lg">📷</span>
            Upload photo
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </label>
        ) : (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoPreview}
              alt="Uploaded preview"
              className="max-h-48 rounded-lg border border-gray-200 object-cover"
            />
            <button
              type="button"
              onClick={() => {
                setPhotoPreview(null);
                setPhotoPath(null);
              }}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Remove photo
            </button>
          </div>
        )}
      </section>

      {/* Location */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Your location</h2>
        <p className="text-sm text-gray-500">
          We use your location to identify your constituency and route your
          submission to the right MP.
        </p>

        {locationStatus === "idle" && (
          <button
            type="button"
            onClick={requestLocation}
            className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2.5 rounded-lg hover:bg-blue-800 transition-colors"
          >
            <span>📍</span>
            Detect my location
          </button>
        )}

        {locationStatus === "requesting" && (
          <p className="text-sm text-gray-500 animate-pulse">
            Requesting location…
          </p>
        )}

        {locationStatus === "granted" && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
            {lookingUpConstituency ? (
              <span className="animate-pulse">Looking up constituency…</span>
            ) : constituency ? (
              <>
                Location detected. Constituency:{" "}
                <strong>{constituency.name}</strong>
                {constituency.mpName && ` (MP: ${constituency.mpName})`}
              </>
            ) : (
              "Location detected. Constituency not found — submission will be filed without one."
            )}
          </div>
        )}

        {locationStatus === "denied" && (
          <div className="space-y-3">
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              Location access was denied. You can still submit by entering your
              postcode or letting us know you&apos;re away from your area.
            </p>

            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isAwayFromArea}
                onChange={(e) => {
                  setIsAwayFromArea(e.target.checked);
                  if (e.target.checked) setLocationStatus("away");
                }}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              I am away from my local area
            </label>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter postcode (e.g. SW1A 1AA)"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={lookupPostcode}
                disabled={lookingUpConstituency}
                className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-800 disabled:opacity-50 transition-colors"
              >
                {lookingUpConstituency ? "…" : "Look up"}
              </button>
            </div>
            {locationError && (
              <p className="text-sm text-red-600">{locationError}</p>
            )}
            {constituency && postcode && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                Constituency: <strong>{constituency.name}</strong>
                {constituency.mpName && ` (MP: ${constituency.mpName})`}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Anonymisation */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={anonymised}
            onChange={(e) => setAnonymised(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600"
          />
          <div>
            <span className="font-medium text-gray-800">
              Keep my details anonymous in MP reports
            </span>
            <p className="text-sm text-gray-500 mt-0.5">
              Your name and email will not appear in the digest sent to your MP.
            </p>
          </div>
        </label>
      </section>

      {/* Auth status */}
      {!user && (
        <p className="text-sm text-gray-600 text-center">
          Submitting anonymously.{" "}
          <Link href="/auth/register" className="text-blue-700 hover:underline">
            Create an account
          </Link>{" "}
          or{" "}
          <Link href="/auth/login" className="text-blue-700 hover:underline">
            log in
          </Link>{" "}
          to track your submissions.
        </p>
      )}

      {user && (
        <p className="text-sm text-gray-600 text-center">
          Submitting as <strong>{user.email}</strong>
        </p>
      )}

      {/* Error */}
      {submitError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {submitError}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-blue-700 text-white py-3 rounded-xl font-semibold text-lg hover:bg-blue-800 disabled:opacity-60 transition-colors"
      >
        {submitting ? "Submitting…" : "Submit concern"}
      </button>
    </form>
  );
}
