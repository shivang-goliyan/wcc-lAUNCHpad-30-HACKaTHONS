"use client";

import { useEffect, useRef, useState } from "react";
import { useMotionValue } from "motion/react";
import { clsx } from "clsx";
import { NamiImage } from "@/components/nami/NamiImage";
import {
  NamiStage,
  type CaseStatus,
  type ConnectionState,
  type InteractionState,
  type MicrophoneState,
  type NamiSize,
} from "@/components/nami/NamiStage";
import { pickVoice, speechSynthesisEnvelope } from "@/components/nami/lipsync";
import { POSE_NAMES, type PoseName } from "@/lib/nami/poses";

const STATES: InteractionState[] = [
  "idle",
  "greeting",
  "listening",
  "thinking",
  "speaking",
  "reminder",
  "acknowledged",
  "calling",
  "help",
  "quiet",
];
const CASES: CaseStatus[] = [null, "escalating", "owner_accepted", "unresolved"];
const MICS: MicrophoneState[] = ["active", "muted", "unavailable", "off"];
const CONNS: ConnectionState[] = ["online", "reconnecting", "offline"];

const SPEECH = {
  hi: "नमस्ते मीरा जी, मैं नामी हूँ — एक AI साथी। आज का प्लान सुनना चाहेंगी?",
  en: "Good morning, Meera ji. I'm Nami, your AI companion. Would you like to hear today's plan?",
};

const BG = { ivory: "#F7F3EA", teal: "#173D38" } as const;

function Seg<T extends string | null>({
  label,
  value,
  options,
  onChange,
  format = (v) => String(v ?? "none"),
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-1.5">
      <legend className="mb-1 w-full text-xs font-semibold uppercase tracking-wide text-[#4A5552]">
        {label}
      </legend>
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          aria-pressed={o === value}
          onClick={() => onChange(o)}
          className={clsx(
            "rounded-full border px-3 py-1 text-sm transition-colors",
            o === value
              ? "border-[#173D38] bg-[#173D38] text-[#F7F3EA]"
              : "border-[#DCD6C8] bg-white text-[#173D38] hover:border-[#80A99B]",
          )}
        >
          {format(o)}
        </button>
      ))}
    </fieldset>
  );
}

export function MascotLab() {
  const [state, setState] = useState<InteractionState>("idle");
  const [caseStatus, setCaseStatus] = useState<CaseStatus>(null);
  const [mic, setMic] = useState<MicrophoneState>("active");
  const [conn, setConn] = useState<ConnectionState>("online");
  const [reduced, setReduced] = useState(false);
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [bg, setBg] = useState<keyof typeof BG>("ivory");
  const [size, setSize] = useState<NamiSize>("lg");
  const [poseOverride, setPoseOverride] = useState<PoseName | null>(null);
  const [follow, setFollow] = useState(true);
  const [look, setLook] = useState<{ x: number; y: number } | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [note, setNote] = useState("");
  const [stageKey, setStageKey] = useState(0);

  const mouth = useMotionValue(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);
  const readoutRef = useRef<HTMLOutputElement>(null);
  const stopEnvelope = useRef<(() => void) | null>(null);

  // Mirror the mouth value into the slider without re-rendering the page per frame.
  useEffect(
    () =>
      mouth.on("change", (v) => {
        if (sliderRef.current && document.activeElement !== sliderRef.current) {
          sliderRef.current.value = String(v);
        }
        if (readoutRef.current) readoutRef.current.textContent = v.toFixed(2);
      }),
    [mouth],
  );

  // Pointer-follow eyes, relative to the big Nami.
  useEffect(() => {
    if (!follow) return;
    const onMove = (e: PointerEvent) => {
      const el = stageRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.36; // roughly her eyes
      const nx = (e.clientX - cx) / (window.innerWidth * 0.35);
      const ny = (e.clientY - cy) / (window.innerHeight * 0.35);
      setLook({ x: Math.max(-1, Math.min(1, nx)), y: Math.max(-1, Math.min(1, ny)) });
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [follow]);

  useEffect(
    () => () => {
      stopEnvelope.current?.();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    },
    [],
  );

  const stopSpeaking = () => {
    window.speechSynthesis?.cancel();
    stopEnvelope.current?.();
    stopEnvelope.current = null;
    mouth.set(0);
    setSpeaking(false);
  };

  const speakTest = () => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) {
      setNote("speechSynthesis is not available in this browser.");
      return;
    }
    stopSpeaking();
    const voice = pickVoice(["hi-IN", "en-IN"]);
    const hindi = voice ? voice.lang.toLowerCase().startsWith("hi") : false;
    const u = new SpeechSynthesisUtterance(hindi ? SPEECH.hi : SPEECH.en);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? "en-IN";
    u.rate = 0.95;
    stopEnvelope.current = speechSynthesisEnvelope(u, (v) => mouth.set(v));
    u.addEventListener("start", () => setSpeaking(true));
    const done = () => {
      setSpeaking(false);
      mouth.set(0);
    };
    u.addEventListener("end", done);
    u.addEventListener("error", done);
    setNote(voice ? `Voice: ${voice.name} (${voice.lang})` : "No hi-IN/en-IN voice found; using the default voice.");
    synth.speak(u);
  };

  const interactionState: InteractionState = speaking ? "speaking" : state;
  const dark = bg === "teal";

  return (
    <main className="min-h-screen bg-[#F7F3EA] px-4 py-8 text-[#173D38] sm:px-8">
      <header className="mx-auto mb-8 max-w-6xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-[#80A99B]">Nami Care · dev</p>
        <h1 className="mt-1 text-3xl font-semibold">Mascot lab</h1>
        <p className="mt-2 max-w-2xl text-[#4A5552]">
          Every painted pose, the app state contract (<code>NamiStage</code>), the mouth thresholds and a
          speech-synthesis lip-sync test. Move the pointer and she follows it with her eyes.
        </p>
      </header>

      <section className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div
          ref={stageRef}
          className="flex min-h-[460px] items-center justify-center rounded-[20px] p-6 shadow-[0_8px_30px_rgba(23,61,56,.10)]"
          style={{ background: BG[bg] }}
        >
          <div className={clsx(dark && "[&_p]:!text-[#F7F3EA]")}>
            <NamiStage
              key={stageKey}
              interactionState={interactionState}
              mouthOpen={mouth}
              microphoneState={mic}
              connectionState={conn}
              reducedMotion={reduced}
              caseStatus={caseStatus}
              activeTurnId={null}
              lookAt={follow ? look : null}
              size={size}
              callTarget="clinic"
              lang={lang}
              poseOverride={poseOverride}
            />
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <Seg label="Interaction state" value={state} options={STATES} onChange={setState} />
          <Seg label="Help case status" value={caseStatus} options={CASES} onChange={setCaseStatus} />
          <Seg
            label="Pose override (landing choreography)"
            value={poseOverride}
            options={[null, "swim", "peek", "point-left", "point-right"] as const}
            onChange={setPoseOverride}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <Seg label="Microphone" value={mic} options={MICS} onChange={setMic} />
            <Seg label="Connection" value={conn} options={CONNS} onChange={setConn} />
            <Seg label="Size" value={size} options={["sm", "md", "lg"] as const} onChange={setSize} />
            <Seg label="Language" value={lang} options={["en", "hi"] as const} onChange={setLang} />
            <Seg label="Background" value={bg} options={["ivory", "teal"] as const} onChange={setBg} />
            <Seg
              label="Motion"
              value={reduced ? "reduced" : "full"}
              options={["full", "reduced"] as const}
              onChange={(v) => setReduced(v === "reduced")}
            />
          </div>

          <div>
            <label htmlFor="mouth" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#4A5552]">
              Mouth (output-audio envelope) · <output ref={readoutRef}>0.00</output>
            </label>
            <input
              ref={sliderRef}
              id="mouth"
              type="range"
              min={0}
              max={1}
              step={0.01}
              defaultValue={0}
              onChange={(e) => mouth.set(Number(e.currentTarget.value))}
              className="w-full accent-[#173D38]"
            />
            <p className="mt-1 text-xs text-[#4A5552]">
              &lt;0.08 closed smile · 0.08–0.35 small · 0.35–0.7 wide · &gt;0.7 wide/round alternating every 140 ms
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={speaking ? stopSpeaking : speakTest}
              className="rounded-full bg-[#173D38] px-5 py-2 font-medium text-[#F7F3EA] hover:bg-[#0F2C28]"
            >
              {speaking ? "Stop speaking" : "Speak test"}
            </button>
            <button
              type="button"
              onClick={() => setStageKey((k) => k + 1)}
              className="rounded-full border border-[#DCD6C8] bg-white px-4 py-2 text-sm"
            >
              Replay greeting (remount)
            </button>
            <button
              type="button"
              aria-pressed={follow}
              onClick={() => {
                setFollow((f) => !f);
                setLook(null);
              }}
              className="rounded-full border border-[#DCD6C8] bg-white px-4 py-2 text-sm"
            >
              Eyes follow pointer: {follow ? "on" : "off"}
            </button>
          </div>
          {note ? <p className="text-sm text-[#4A5552]">{note}</p> : null}
        </div>
      </section>

      <section className="mx-auto mt-12 max-w-6xl">
        <h2 className="mb-4 text-xl font-semibold">All poses</h2>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
          {POSE_NAMES.map((p) => (
            <li
              key={p}
              className="flex flex-col items-center rounded-[20px] border border-[#DCD6C8] p-2"
              style={{ background: BG[bg] }}
            >
              <NamiImage
                still
                pose={p}
                reducedMotion={reduced}
                lookAt={follow ? look : null}
                title={`Nami, ${p} pose`}
                style={{ width: 220, height: 220 }}
              />
              <span className={clsx("pb-1 text-sm font-medium", dark ? "text-[#F7F3EA]" : "text-[#173D38]")}>{p}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
