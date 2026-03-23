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

function getMPFirstName(mpName: string | null | undefined): string {
  if (!mpName) return "";
  const stripped = mpName
    .replace(/^(mr|mrs|ms|miss|dr|sir|dame|lord|lady|the rt hon|rt hon)\s+/i, "")
    .trim();
  return stripped.split(" ")[0] ?? "";
}

function shortConstituencyName(name: string): string {
  return name.replace(/\s+(and|&)\s+/i, " & ").replace(" Parliamentary Constituency", "");
}

export function SubmissionForm() {
  const [user, setUser] = useState<User | null>(null);

  const [textContent, setTextContent] = useState("");
  const [voicePath, setVoicePath] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [locationStatus, setLocationStatus] = useState<
    "idle" | "requesting" | "granted" | "denied" | "away" | "postcode"
  >("idle");
  const [constituency, setConstituency] = useState<Constituency | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [postcode, setPostcode] = useState("");
  const [isAwayFromArea, setIsAwayFromArea] = useState(false);
  const [lookingUpConstituency, setLookingUpConstituency] = useState(false);
  const [showLocationEdit, setShowLocationEdit] = useState(false);

  const [anonymised, setAnonymised] = useState(true);
  const [anonExpanded, setAnonExpanded] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);

  const mpFirstName = getMPFirstName(constituency?.mpName);
  const constituencyShort = constituency ? shortConstituencyName(constituency.name) : "";
  const hasContent = !!(textContent.trim() || voicePath || photoPath);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user));
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) { setLocationStatus("denied"); return; }
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
          if (data.constituency) setConstituency(data.constituency);
        } catch { /* silent */ } finally { setLookingUpConstituency(false); }
      },
      () => setLocationStatus("denied"),
      { timeout: 8000 }
    );
  }, []);

  const lookupPostcode = async () => {
    if (!postcode.trim()) return;
    setLookingUpConstituency(true);
    try {
      const res = await fetch(`/api/mapIt?postcode=${encodeURIComponent(postcode.trim())}`);
      const data = await res.json();
      if (data.constituency) {
        setConstituency(data.constituency);
        setLocationStatus("postcode");
        setShowLocationEdit(false);
      }
    } catch { /* silent */ } finally { setLookingUpConstituency(false); }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        const formData = new FormData();
        formData.append("file", blob, "voice-memo.webm");
        formData.append("type", "voice");
        try {
          const res = await fetch("/api/upload", { method: "POST", body: formData });
          const data = await res.json();
          if (data.path) setVoicePath(data.path);
        } catch { /* keep local url */ }
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch { alert("Could not access microphone."); }
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
    setPhotoPreview(URL.createObjectURL(file));
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "photo");
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.path) setPhotoPath(data.path);
    } catch { /* keep preview */ }
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    if (!hasContent) { setSubmitError("Add a message, voice memo, or photo before sending."); return; }
    setSubmitting(true);
    const finalLocationStatus = isAwayFromArea ? "away"
      : locationStatus === "postcode" ? "postcode"
      : locationStatus === "granted" ? "granted"
      : "denied";
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          textContent: textContent.trim() || null,
          voiceMemoPath: voicePath,
          photoPath,
          deviceFingerprint: generateFingerprint(),
          locationStatus: finalLocationStatus,
          latitude, longitude,
          postcode: postcode || null,
          isAwayFromArea,
          constituencyId: constituency?.id || null,
          anonymised,
        }),
      });
      const data = await res.json();
      if (!res.ok) setSubmitError(data.error || "Failed to submit");
      else setSubmitted(true);
    } catch { setSubmitError("Network error. Please try again."); }
    finally { setSubmitting(false); }
  };

  const resetForm = () => {
    setTextContent("");
    setVoicePath(null);
    setAudioUrl(null);
    setPhotoPath(null);
    setPhotoPreview(null);
    setSubmitted(false);
    setSubmitError(null);
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>
      <div className="flex-1 flex flex-col w-full max-w-[480px] mx-auto px-4 pt-6 pb-4">

        {/* Wordmark */}
        <p className="text-[10px] tracking-widest uppercase text-gray-400 font-medium mb-8">
          Constituency Capture
        </p>

        {/* Headline */}
        <div className="mb-6">
          <h1 className="text-[26px] font-medium text-gray-900 leading-tight">
            What&apos;s happening?
          </h1>
          {constituencyShort && (
            <p className="text-[22px] font-medium text-gray-400 leading-tight mt-0.5">
              {constituencyShort}
            </p>
          )}
        </div>

        {/* Location card — resolved */}
        {locationStatus === "granted" && constituency && !showLocationEdit && (
          <div className="mb-5 flex items-center justify-between text-sm text-gray-600">
            <span>
              {lookingUpConstituency ? (
                <span className="text-gray-400">Finding your MP…</span>
              ) : constituency.mpName ? (
                <>Your MP is <span className="font-medium text-gray-800">{constituency.mpName}</span></>
              ) : (
                <span className="text-gray-400">Constituency found</span>
              )}
            </span>
            <button
              onClick={() => setShowLocationEdit(true)}
              className="text-gray-400 hover:text-gray-600 underline underline-offset-2 ml-4 shrink-0"
            >
              Change
            </button>
          </div>
        )}

        {/* Location fallback / edit */}
        {(locationStatus === "denied" || showLocationEdit) && (
          <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">Where are you?</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter postcode"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && lookupPostcode()}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
              <button
                onClick={lookupPostcode}
                disabled={lookingUpConstituency}
                className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
              >
                {lookingUpConstituency ? "…" : "Go"}
              </button>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
              <input
                type="checkbox"
                checked={isAwayFromArea}
                onChange={(e) => setIsAwayFromArea(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              I&apos;m away from my local area
            </label>
          </div>
        )}

        {/* Detecting */}
        {locationStatus === "requesting" && !showLocationEdit && (
          <div className="mb-5 text-sm text-gray-400">Detecting location…</div>
        )}

        {/* Post-submission */}
        {submitted ? (
          <div className="flex-1 flex flex-col justify-center text-center py-10 space-y-4">
            <p className="text-xl font-medium text-gray-900">
              Sent{mpFirstName ? ` to ${mpFirstName}` : ""}. Thank you.
            </p>
            <button
              onClick={resetForm}
              className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2"
            >
              Submit another
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col space-y-3">

            {/* Attachment previews */}
            {(audioUrl || photoPreview) && (
              <div className="space-y-2">
                {audioUrl && (
                  <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-2.5">
                    <audio src={audioUrl} controls className="flex-1 h-8" style={{ minWidth: 0 }} />
                    <button
                      onClick={() => { setAudioUrl(null); setVoicePath(null); }}
                      className="text-gray-300 hover:text-gray-500 text-xl leading-none shrink-0"
                      aria-label="Remove voice memo"
                    >×</button>
                  </div>
                )}
                {photoPreview && (
                  <div className="relative w-fit">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoPreview}
                      alt="Attachment"
                      className="max-h-36 rounded-xl border border-gray-200 object-cover"
                    />
                    <button
                      onClick={() => { setPhotoPreview(null); setPhotoPath(null); }}
                      className="absolute top-1.5 right-1.5 bg-black/50 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                      aria-label="Remove photo"
                    >×</button>
                  </div>
                )}
              </div>
            )}

            {/* Compose box */}
            <div className="relative rounded-2xl border border-gray-200 bg-white">
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder={mpFirstName
                  ? `Tell ${mpFirstName} what's happening…`
                  : "Tell your MP what's happening…"}
                rows={5}
                className="w-full bg-transparent px-4 pt-4 pb-14 text-[15px] text-gray-900 placeholder-gray-400 focus:outline-none resize-none"
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                    isRecording
                      ? "bg-red-500 text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                  aria-label={isRecording ? "Stop recording" : "Record voice memo"}
                >
                  {isRecording ? (
                    <span className="text-[10px] font-mono font-semibold tabular-nums">
                      {formatTime(recordingSeconds)}
                    </span>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm7 8a1 1 0 0 1 1 1 8 8 0 0 1-7 7.938V21h2a1 1 0 0 1 0 2H9a1 1 0 0 1 0-2h2v-1.062A8 8 0 0 1 4 12a1 1 0 0 1 2 0 6 6 0 0 0 12 0 1 1 0 0 1 1-1z"/>
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center transition-colors"
                  aria-label="Attach photo"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 3l-1.83 2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.17L15 3H9zm3 15a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11zm0-2a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
                  </svg>
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </div>
            </div>

            {/* Anonymisation */}
            <div>
              <button
                type="button"
                onClick={() => setAnonExpanded((v) => !v)}
                className="w-full flex items-center gap-3 py-2"
              >
                <span className="flex-1 h-px bg-gray-200" />
                <span className="text-[10px] tracking-widest uppercase text-gray-400 font-medium whitespace-nowrap">
                  anonymous by default
                </span>
                <span className="flex-1 h-px bg-gray-200" />
              </button>
              {anonExpanded && (
                <div className="flex items-center justify-between px-1 pb-2 text-sm text-gray-500">
                  <span>Keep me anonymous</span>
                  <button
                    type="button"
                    onClick={() => setAnonymised((v) => !v)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      anonymised ? "bg-gray-900" : "bg-gray-300"
                    }`}
                    aria-label="Toggle anonymisation"
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      anonymised ? "translate-x-5" : "translate-x-0.5"
                    }`} />
                  </button>
                </div>
              )}
            </div>

            {submitError && (
              <p className="text-sm text-red-500 text-center">{submitError}</p>
            )}

            {/* Send button */}
            <button
              onClick={handleSubmit}
              disabled={submitting || !hasContent}
              className="w-full py-3.5 rounded-2xl text-[15px] font-medium transition-opacity disabled:opacity-40"
              style={{ background: "var(--foreground)", color: "var(--background)" }}
            >
              {submitting ? "Sending…" : mpFirstName ? `Send to ${mpFirstName}` : "Send"}
            </button>

            {!user && (
              <p className="text-xs text-center text-gray-400">
                <Link href="/auth/login" className="underline underline-offset-2 hover:text-gray-600">Log in</Link>
                {" or "}
                <Link href="/auth/register" className="underline underline-offset-2 hover:text-gray-600">create an account</Link>
                {" to track your submissions"}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="w-full max-w-[480px] mx-auto px-4 pb-6 pt-2">
        <p className="text-xs text-gray-400 text-center">
          Goes to your MP every Monday
          {" · "}
          <Link href="/how-it-works" className="underline underline-offset-2 hover:text-gray-600">
            How it works
          </Link>
        </p>
      </div>
    </div>
  );
}
