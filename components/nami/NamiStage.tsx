"use client";

/**
 * NamiStage: the app → animation adapter (docs/DESIGN.md §5–6).
 *
 * Takes the binding `NamiProps` contract, applies the visual state priority,
 * maps the state to a pose and renders NamiSvg plus accessible status text
 * OUTSIDE the SVG (aria-live). Care logic never lives here: this only reflects
 * state that the app already owns.
 */

import { useEffect, useState } from "react";
import type { MotionValue } from "motion/react";
import { Mic, MicOff, Phone, RefreshCw, WifiOff } from "lucide-react";
import { clsx } from "clsx";
import { NamiSvg } from "./NamiSvg";
import type { PoseName } from "@/lib/nami/poses";

export type InteractionState =
  | "idle"
  | "greeting"
  | "listening"
  | "thinking"
  | "speaking"
  | "reminder"
  | "acknowledged"
  | "calling"
  | "help"
  | "quiet";

export type MicrophoneState = "active" | "muted" | "unavailable" | "off";
export type ConnectionState = "online" | "reconnecting" | "offline";

/** Case states from docs/TRD.md §5.2 (check-in and help share one machine). */
export type CaseStatus =
  | null
  | "awaiting_response"
  | "retrying_page"
  | "phone_fallback"
  | "escalating"
  | "owner_accepted"
  | "resolved_user_responded"
  | "resolved_human_reported"
  | "cancelled_mistake"
  | "unresolved";

export type NamiSize = "sm" | "md" | "lg";

/** The binding contract from docs/DESIGN.md §6. */
export type NamiProps = {
  interactionState: InteractionState;
  /** 0..1, from OUTPUT audio only. A MotionValue avoids re-rendering at audio rate. */
  mouthOpen: number | MotionValue<number>;
  microphoneState: MicrophoneState;
  connectionState: ConnectionState;
  reducedMotion: boolean;
  caseStatus: CaseStatus;
  /** Stale events for other turn ids are ignored. */
  activeTurnId: string | null;
  lookAt?: { x: number; y: number } | null;
  size: NamiSize;
};

export type NamiStageProps = NamiProps & {
  /** Turn that produced `mouthOpen`. If set and ≠ activeTurnId, the mouth stays closed. */
  mouthTurnId?: string | null;
  /** Who a `calling` state is calling; picks the status text. */
  callTarget?: "clinic" | "family" | null;
  lang?: "en" | "hi";
  /** Play the one-shot greeting wave on mount (default true). */
  greet?: boolean;
  /** Show the status line and chips under Nami (default true). Keep them visible in the app. */
  showStatus?: boolean;
  /** Landing-page choreography (swim, peek, point-*) that is not an app state. Ignored while help is open. */
  poseOverride?: PoseName | null;
  className?: string;
};

export const NAMI_SIZE_PX: Record<NamiSize, number> = { sm: 128, md: 220, lg: 340 };

const HELP_OPEN: ReadonlySet<NonNullable<CaseStatus>> = new Set([
  "escalating",
  "owner_accepted",
  "unresolved",
]);

export function isHelpCaseOpen(caseStatus: CaseStatus): boolean {
  return caseStatus !== null && HELP_OPEN.has(caseStatus);
}

const STEADY_PRIORITY: InteractionState[] = ["calling", "speaking", "listening", "thinking", "reminder"];

/**
 * Visual priority (DESIGN.md §6):
 * help > calling > speaking > listening > thinking > reminder > acknowledged (one-shot) > quiet > idle.
 * The mount greeting only plays when nothing else is going on.
 */
export function resolveNamiState(input: {
  interactionState: InteractionState;
  caseStatus: CaseStatus;
  ackActive: boolean;
  greetingActive: boolean;
}): InteractionState {
  const { interactionState: s, caseStatus } = input;
  if (s === "help" || isHelpCaseOpen(caseStatus)) return "help";
  if (STEADY_PRIORITY.includes(s)) return s;
  if (input.ackActive) return "acknowledged";
  if (s === "quiet") return "quiet";
  if (input.greetingActive) return "greeting";
  return "idle";
}

export const STATE_TO_POSE: Record<InteractionState, PoseName> = {
  idle: "idle",
  greeting: "greeting",
  listening: "listening",
  thinking: "thinking",
  speaking: "speaking",
  reminder: "reminder",
  acknowledged: "acknowledged",
  calling: "calling",
  help: "help",
  quiet: "quiet",
};

const T = {
  en: {
    idle: "Nami is here",
    greeting: "Hello! I'm Nami, an AI companion",
    listening: "Listening…",
    thinking: "Thinking…",
    speaking: "Speaking…",
    reminder: "Reminder",
    acknowledged: "Noted",
    quiet: "Quiet mode",
    callClinic: "Calling the clinic…",
    callFamily: "Calling your family…",
    call: "On a call…",
    helpEscalating: "Getting help: contacting your people…",
    helpAccepted: "Someone from your contacts is checking on you",
    helpUnresolved: "No one has responded yet",
    help: "Getting help…",
    emergency: "Emergency? Call 112",
    micMuted: "Mic muted",
    micUnavailable: "Mic unavailable",
    reconnecting: "Reconnecting…",
    offline: "Offline",
    onCall: "On a call",
  },
  hi: {
    idle: "नामी यहाँ है",
    greeting: "नमस्ते! मैं नामी हूँ, एक AI साथी",
    listening: "सुन रही हूँ…",
    thinking: "सोच रही हूँ…",
    speaking: "बोल रही हूँ…",
    reminder: "याद दिला रही हूँ",
    acknowledged: "नोट कर लिया",
    quiet: "शांत मोड",
    callClinic: "क्लिनिक को कॉल कर रही हूँ…",
    callFamily: "परिवार को कॉल कर रही हूँ…",
    call: "कॉल चल रही है…",
    helpEscalating: "मदद बुला रही हूँ: आपके लोगों से संपर्क हो रहा है…",
    helpAccepted: "आपके संपर्कों में से कोई आपकी ख़बर ले रहा है",
    helpUnresolved: "अभी तक किसी ने जवाब नहीं दिया",
    help: "मदद बुला रही हूँ…",
    emergency: "आपातकाल? 112 पर कॉल करें",
    micMuted: "माइक बंद है",
    micUnavailable: "माइक उपलब्ध नहीं",
    reconnecting: "फिर से जुड़ रही हूँ…",
    offline: "ऑफ़लाइन",
    onCall: "कॉल चल रही है",
  },
} as const;

export function namiStatusText(
  state: InteractionState,
  opts: { caseStatus: CaseStatus; callTarget?: "clinic" | "family" | null; lang?: "en" | "hi" },
): string {
  const t = T[opts.lang ?? "en"];
  switch (state) {
    case "help": {
      const head =
        opts.caseStatus === "escalating"
          ? t.helpEscalating
          : opts.caseStatus === "owner_accepted"
            ? t.helpAccepted
            : opts.caseStatus === "unresolved"
              ? t.helpUnresolved
              : t.help;
      return `${head} · ${t.emergency}`;
    }
    case "calling":
      return opts.callTarget === "clinic"
        ? t.callClinic
        : opts.callTarget === "family"
          ? t.callFamily
          : t.call;
    default:
      return t[state];
  }
}

const GREETING_MS = 1700;
const ACK_MS = 900;

export function NamiStage({
  interactionState,
  mouthOpen,
  microphoneState,
  connectionState,
  reducedMotion,
  caseStatus,
  activeTurnId,
  lookAt = null,
  size,
  mouthTurnId,
  callTarget = null,
  lang = "en",
  greet = true,
  showStatus = true,
  poseOverride = null,
  className,
}: NamiStageProps) {
  // Greeting: once per mount.
  const [greeted, setGreeted] = useState(!greet);
  useEffect(() => {
    if (greeted) return;
    const t = setTimeout(() => setGreeted(true), GREETING_MS);
    return () => clearTimeout(t);
  }, [greeted]);

  // Acknowledged: one-shot for 900 ms each time the state is entered.
  const [prevState, setPrevState] = useState(interactionState);
  const [ackSeq, setAckSeq] = useState(interactionState === "acknowledged" ? 1 : 0);
  const [ackDone, setAckDone] = useState(0);
  if (prevState !== interactionState) {
    setPrevState(interactionState);
    if (interactionState === "acknowledged") setAckSeq((n) => n + 1);
  }
  useEffect(() => {
    if (ackSeq === 0) return;
    const t = setTimeout(() => setAckDone(ackSeq), ACK_MS);
    return () => clearTimeout(t);
  }, [ackSeq]);

  const state = resolveNamiState({
    interactionState,
    caseStatus,
    ackActive: ackSeq > ackDone,
    greetingActive: !greeted,
  });
  const pose: PoseName =
    poseOverride && state !== "help" ? poseOverride : STATE_TO_POSE[state];

  // Ignore a mouth envelope that belongs to a stale (cancelled) turn.
  const stale = mouthTurnId !== undefined && mouthTurnId !== activeTurnId;
  const mouth = stale ? 0 : mouthOpen;

  const px = NAMI_SIZE_PX[size];
  const t = T[lang];
  const status = namiStatusText(state, { caseStatus, callTarget, lang });

  const chips: { key: string; icon: React.ReactNode; text: string; tone: string }[] = [];
  if (state === "help" && interactionState === "calling") {
    chips.push({ key: "call", icon: <Phone aria-hidden size={14} />, text: t.onCall, tone: "text-[#173D38] bg-[#E3EEEA]" });
  }
  if (microphoneState === "muted") {
    chips.push({ key: "mic", icon: <MicOff aria-hidden size={14} />, text: t.micMuted, tone: "text-[#4A5552] bg-[#ECE7DC]" });
  } else if (microphoneState === "unavailable") {
    chips.push({ key: "mic", icon: <MicOff aria-hidden size={14} />, text: t.micUnavailable, tone: "text-[#8A5A12] bg-[#F6E9D2]" });
  } else if (microphoneState === "active" && state === "listening") {
    chips.push({ key: "mic", icon: <Mic aria-hidden size={14} />, text: t.listening.replace("…", ""), tone: "text-[#2F7A55] bg-[#E2F0E8]" });
  }
  if (connectionState === "reconnecting") {
    chips.push({ key: "net", icon: <RefreshCw aria-hidden size={14} />, text: t.reconnecting, tone: "text-[#8A5A12] bg-[#F6E9D2]" });
  } else if (connectionState === "offline") {
    chips.push({ key: "net", icon: <WifiOff aria-hidden size={14} />, text: t.offline, tone: "text-[#B8463B] bg-[#F6E1DE]" });
  }

  return (
    <div
      className={clsx("inline-flex flex-col items-center", className)}
      data-nami-state={state}
      data-nami-pose={pose}
    >
      <div style={{ width: px, height: px }}>
        <NamiSvg
          pose={pose}
          mouth={mouth}
          lookAt={lookAt}
          reducedMotion={reducedMotion}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
      {showStatus ? (
        <div className="mt-1 flex max-w-full flex-col items-center gap-1.5 text-center">
          <p
            role="status"
            aria-live="polite"
            className={clsx(
              "font-medium text-[#173D38]",
              size === "sm" ? "text-sm" : size === "md" ? "text-base" : "text-lg",
            )}
          >
            {status}
          </p>
          {chips.length ? (
            <ul className="flex flex-wrap justify-center gap-1.5" aria-label="Status">
              {chips.map((c) => (
                <li
                  key={c.key}
                  className={clsx(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                    c.tone,
                  )}
                >
                  {c.icon}
                  {c.text}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default NamiStage;
