import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  MultipleChoiceConfigSchema,
  type MultipleChoiceConfig,
} from "@kukui/activities/multiple-choice/schema";
import {
  FillInTheBlanksConfigSchema,
  type FillInTheBlanksConfig,
} from "@kukui/activities/fill-in-the-blanks/schema";
import {
  ReflectionPromptConfigSchema,
  type ReflectionPromptConfig,
} from "@kukui/activities/reflection-prompt/schema";
import type { InteractiveVideoConfig } from "./schema.js";
import type { ActivityProps, ScoreState } from "@kukui/core/types";
import { aggregate, resolveScoring } from "@kukui/core/scoring";
import MultipleChoice from "@kukui/activities/multiple-choice/Component";
import FillInTheBlanks from "@kukui/activities/fill-in-the-blanks/Component";
import ReflectionPrompt from "@kukui/activities/reflection-prompt/Component";
import { ActivityHeader, SafeHtml, StatusBadge, DotIcon, CheckIcon, TrophyIcon } from "@kukui/core";
import { YouTubeStage, type VideoController } from "./YouTubeStage.js";
import { VideoControls, type SeekMarker } from "./VideoControls.js";
import { INITIAL_MEDIA, type MediaState, formatTime } from "./media.js";
import "./Component.css";

type Stage = "watching" | "summary" | "submitted";

type State = {
  stage: Stage;
  resolvedInteractions: Record<string, ScoreState>;
  /** Last seen time (whole seconds) for resume. */
  lastTime: number;
  /** Answer-adaptive rewatch counts per interaction id (onWrong budget). */
  replays?: Record<string, number>;
};

type Base = {
  id: string;
  atSeconds: number;
  required: boolean;
  pauseOnReach: boolean;
  title?: string;
  onWrong?: { seekTo: number; maxReplays?: number };
};
type ValidatedInteraction =
  | (Base & { kind: "label"; html: string })
  | (Base & { kind: "multipleChoice"; config: MultipleChoiceConfig })
  | (Base & { kind: "fillInTheBlanks"; config: FillInTheBlanksConfig })
  | (Base & { kind: "reflection"; config: ReflectionPromptConfig })
  | (Base & { kind: "invalid"; reason: string });

const TRIGGER_WINDOW = 0.5;
/** Non-scored resolution (labels, skipped optionals). Zero-max means
 *  completion semantics: it can never drag the aggregate into failure. */
const SENTINEL: ScoreState = { raw: 0, max: 0, success: true };
/** Persist the resume position at most this often (seconds of playback). */
const LAST_TIME_INTERVAL = 5;

/** What restored suspend data means for the returning learner. */
type ResumeInfo = {
  /** True when the previous attempt was submitted (score already recorded). */
  submitted: boolean;
  /** How many interactions the previous session resolved. */
  answered: number;
};

function resumeInfoFrom(parsed: State | null): ResumeInfo | null {
  if (!parsed) return null;
  const answered = Object.keys(parsed.resolvedInteractions).length;
  if (parsed.stage === "submitted") return { submitted: true, answered };
  return answered > 0 ? { submitted: false, answered } : null;
}

export default function Component({
  config,
  onSubmit,
  onPersist,
  suspendData,
  headingLevel = 1,
}: ActivityProps<InteractiveVideoConfig>) {
  const headingId = useId();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controllerRef = useRef<VideoController | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);

  const validated = useMemo<ValidatedInteraction[]>(() => {
    const out: ValidatedInteraction[] = [];
    config.interactions.forEach((it) => {
      const base: Base = {
        id: it.id,
        atSeconds: it.atSeconds,
        required: it.required ?? true,
        pauseOnReach: it.pauseOnReach ?? true,
        title: it.title,
        onWrong: it.onWrong,
      };
      if (it.kind === "label") {
        const html = typeof it.config.html === "string" ? it.config.html : "";
        out.push({ ...base, kind: "label", html });
      } else if (it.kind === "multipleChoice") {
        const r = MultipleChoiceConfigSchema.safeParse(it.config);
        if (r.success) out.push({ ...base, kind: "multipleChoice", config: r.data });
        else out.push({ ...base, kind: "invalid", reason: r.error.issues[0]?.message ?? "Invalid multiple-choice config" });
      } else if (it.kind === "reflection") {
        const r = ReflectionPromptConfigSchema.safeParse(it.config);
        if (r.success) out.push({ ...base, kind: "reflection", config: r.data });
        else out.push({ ...base, kind: "invalid", reason: r.error.issues[0]?.message ?? "Invalid reflection config" });
      } else {
        const r = FillInTheBlanksConfigSchema.safeParse(it.config);
        if (r.success) out.push({ ...base, kind: "fillInTheBlanks", config: r.data });
        else out.push({ ...base, kind: "invalid", reason: r.error.issues[0]?.message ?? "Invalid fill-in-the-blanks config" });
      }
    });
    out.sort((a, b) => a.atSeconds - b.atSeconds);
    // Interactions outside the trim window can never trigger; drop them so
    // they don't gate completion. The editor warns about these at author time.
    const winStart = config.video.startAt ?? 0;
    const winEnd = config.video.endAt;
    return out.filter(
      (it) => it.atSeconds >= winStart && (winEnd === undefined || it.atSeconds <= winEnd),
    );
  }, [config.interactions, config.video.startAt, config.video.endAt]);

  const [state, setState] = useState<State>(
    () => parseSuspend(suspendData) ?? { stage: "watching", resolvedInteractions: {}, lastTime: 0 },
  );
  const [media, setMedia] = useState<MediaState>(INITIAL_MEDIA);
  const [activeId, setActiveId] = useState<string | null>(null);
  // The pending wrong answer offering an answer-adaptive rewatch (set when a
  // graded checkpoint is answered wrong and its onWrong budget remains). The
  // learner's real score rides along so "Continue anyway" records it faithfully.
  const [reviewOffer, setReviewOffer] = useState<{ id: string; score: ScoreState } | null>(null);
  const [captionsOn, setCaptionsOn] = useState<boolean>(() =>
    (config.video.tracks ?? []).some((t) => !!t.default),
  );
  // What the restored suspend data said at mount, so a returning learner
  // gets an honest explanation instead of a silent dead frame ("it just
  // auto-completed") or an unexplained mid-video answered state.
  const [resumedAttempt, setResumedAttempt] = useState<ResumeInfo | null>(() =>
    resumeInfoFrom(parseSuspend(suspendData)),
  );
  // "Watch again" dismisses the completed-attempt panel; playback while
  // submitted never re-triggers interactions (tick gates on stage).
  const [resumePanelDismissed, setResumePanelDismissed] = useState(false);

  // Live playhead (whole seconds). Mirrors playback without a state write per
  // tick; flushed into persisted state at the throttle points below.
  const lastTimeRef = useRef(state.lastTime);
  // Position restored from suspend data; seek here once the media is ready.
  const resumeTargetRef = useRef(state.lastTime);
  const resumeDoneRef = useRef(false);
  // One-shot guard for the trim-end submit (see tick()).
  const trimEndFiredRef = useRef(false);

  useEffect(() => {
    const parsed = parseSuspend(suspendData);
    const next = parsed ?? { stage: "watching", resolvedInteractions: {}, lastTime: 0 };
    setState(next);
    setActiveId(null);
    setReviewOffer(null);
    setMedia(INITIAL_MEDIA);
    setCaptionsOn((config.video.tracks ?? []).some((t) => !!t.default));
    setResumedAttempt(resumeInfoFrom(parsed));
    setResumePanelDismissed(false);
    lastTimeRef.current = next.lastTime;
    resumeTargetRef.current = next.lastTime;
    resumeDoneRef.current = false;
    trimEndFiredRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  useEffect(() => {
    if (onPersist) onPersist(JSON.stringify(state));
  }, [state, onPersist]);

  const videoType = config.video.type ?? "html5";
  const isYouTube = videoType === "youtube";
  // Trim window: playback is confined to [trimStart, trimEnd]. trimEnd
  // resolves against the real duration once known (media.duration is 0
  // until metadata loads; Infinity keeps comparisons inert until then).
  const trimStart = config.video.startAt ?? 0;
  const configuredTrimEnd = config.video.endAt;
  const tracks = config.video.tracks ?? [];
  const rates = config.behaviour?.playbackRates ?? [0.75, 1, 1.25, 1.5, 2];
  const ui = config.ui ?? {};
  const resumeLabel = ui.resumeButtonLabel ?? "Resume";
  const showSummary = config.behaviour?.showSummary ?? true;

  const ctl = (): VideoController | null => {
    if (isYouTube) return controllerRef.current;
    const v = videoRef.current;
    if (!v) return null;
    return {
      play: () => {
        const p = v.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      },
      pause: () => v.pause(),
      seek: (s) => {
        v.currentTime = s;
      },
      setVolume: (x) => {
        v.muted = false;
        v.volume = x;
      },
      setMuted: (m) => {
        v.muted = m;
      },
      setRate: (r) => {
        v.playbackRate = r;
      },
    };
  };

  const scoring = useMemo(
    () => resolveScoring(config, { mode: "points", passPercentage: 50 }),
    [config],
  );

  const submitFrom = (snapshot: State) => {
    const scores = Object.values(snapshot.resolvedInteractions);
    // Zero-max aggregates report success (completion semantics) per
    // @kukui/core's aggregate(): an interaction-free watch-through completes.
    const aggregated = aggregate(scores, scoring.passPercentage);
    const next: State = { ...snapshot, stage: "submitted" };
    setState(next);
    onSubmit({
      raw: aggregated.raw,
      max: aggregated.max,
      success: aggregated.success,
      suspendData: JSON.stringify(next),
    });
  };

  // End of the activity: show the review summary first (default) so the
  // learner sees what they answered and submits deliberately, or submit
  // straight away when the summary is disabled or nothing is scorable.
  const finishOrSummarize = (snapshot: State) => {
    if (showSummary && validated.length > 0) {
      setState({ ...snapshot, stage: "summary" });
      return;
    }
    submitFrom(snapshot);
  };

  const requiredOnes = useMemo(() => validated.filter((v) => v.required), [validated]);
  const allRequiredResolved = useMemo(() => {
    if (requiredOnes.length === 0) return false;
    return requiredOnes.every((v) => state.resolvedInteractions[v.id]);
  }, [requiredOnes, state.resolvedInteractions]);

  useEffect(() => {
    if (state.stage !== "watching") return;
    if (!allRequiredResolved) return;
    finishOrSummarize(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRequiredResolved, state]);

  /** Earliest unresolved required *pausing* interaction in (after, atMost], or
   *  null. Non-pausing required ones never clamp a scrub — the tick() catch-up
   *  auto-resolves them once the playhead is past their window. */
  const blockingBetween = (after: number, atMost: number): ValidatedInteraction | null => {
    let best: ValidatedInteraction | null = null;
    for (const it of validated) {
      if (!it.required || !it.pauseOnReach) continue;
      if (state.resolvedInteractions[it.id]) continue;
      if (it.atSeconds > after + TRIGGER_WINDOW && it.atSeconds <= atMost) {
        if (!best || it.atSeconds < best.atSeconds) best = it;
      }
    }
    return best;
  };

  /** Flush the live playhead into persisted state (pause / interaction / throttle). */
  const flushLastTime = () => {
    setState((s) =>
      s.lastTime === lastTimeRef.current ? s : { ...s, lastTime: lastTimeRef.current },
    );
  };

  /** Open the interaction overlay, remembering where focus was so it can be
   *  restored when the overlay closes. */
  const openInteraction = (id: string) => {
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      lastFocusRef.current = document.activeElement;
    }
    setActiveId(id);
    flushLastTime();
  };

  const tick = (t: number) => {
    lastTimeRef.current = Math.floor(t);
    // Throttled resume-position persistence: at most one write per
    // LAST_TIME_INTERVAL seconds of playback, plus flushes on pause and on
    // interaction open, so onPersist isn't hit every second.
    if (Math.abs(lastTimeRef.current - state.lastTime) >= LAST_TIME_INTERVAL) flushLastTime();
    if (activeId !== null) return;
    if (state.stage !== "watching") return;
    const c = ctl();
    // Trim end: reaching the window's end IS the end of the activity. Guarded
    // so one crossing fires one handleEnded (the pause stops further ticks,
    // but a slow pause on the YouTube poll path could tick again first).
    if (configuredTrimEnd !== undefined && t >= configuredTrimEnd) {
      if (!trimEndFiredRef.current) {
        trimEndFiredRef.current = true;
        c?.pause();
        handleEnded();
      }
      return;
    }
    for (const it of validated) {
      if (state.resolvedInteractions[it.id]) continue;
      if (Math.abs(t - it.atSeconds) < TRIGGER_WINDOW && t >= it.atSeconds - TRIGGER_WINDOW) {
        if (it.pauseOnReach) {
          c?.pause();
          openInteraction(it.id);
          return;
        }
        recordResolved(it.id, SENTINEL); // non-pausing: auto-resolve so it never gates
        continue;
      }
      if (it.required && t > it.atSeconds + TRIGGER_WINDOW) {
        // Skipped past a required checkpoint (scrub, a high playback rate
        // whose frames jump the trigger window, or a backend whose native
        // scrubber we can't lock).
        if (!it.pauseOnReach) {
          recordResolved(it.id, SENTINEL); // catch up without interrupting playback
          continue;
        }
        // Rewind just inside the window, pause, and show the overlay now; the
        // player is paused so it won't re-enter on its own.
        c?.seek(Math.max(0, it.atSeconds - TRIGGER_WINDOW / 2));
        c?.pause();
        openInteraction(it.id);
        return;
      }
    }
  };

  const handleSeek = (raw: number) => {
    // Clamp every seek into the trim window; content outside it is not part
    // of this activity.
    const upper = configuredTrimEnd !== undefined ? configuredTrimEnd : Infinity;
    const target = Math.min(Math.max(raw, trimStart), upper);
    if (state.stage === "submitted") {
      ctl()?.seek(target);
      return;
    }
    if (target > media.currentTime) {
      const block = blockingBetween(media.currentTime, target);
      if (block) {
        ctl()?.seek(block.atSeconds);
        return;
      }
    }
    ctl()?.seek(target);
  };

  const handleSeekToMarker = (id: string) => {
    const it = validated.find((v) => v.id === id);
    if (it) handleSeek(it.atSeconds);
  };

  const recordResolved = (id: string, score: ScoreState) => {
    setState((s) => ({
      ...s,
      lastTime: lastTimeRef.current,
      resolvedInteractions: { ...s.resolvedInteractions, [id]: score },
    }));
  };

  // Graded checkpoint submit: on a wrong answer with an onWrong rule and
  // remaining replay budget, offer a rewatch instead of recording the score.
  const handleCheckpointSubmit = (it: ValidatedInteraction, score: ScoreState) => {
    const rule = it.onWrong;
    if (rule && !score.success) {
      const used = state.replays?.[it.id] ?? 0;
      const budget = rule.maxReplays ?? 1;
      if (used < budget) {
        setReviewOffer({ id: it.id, score });
        return;
      }
    }
    recordResolved(it.id, score);
  };

  // Accept the rewatch: spend one replay, close the overlay, seek back, and
  // play. The checkpoint re-triggers at its window with a fresh attempt.
  const acceptReview = (it: ValidatedInteraction) => {
    if (!it.onWrong) return;
    setState((s) => ({
      ...s,
      replays: { ...(s.replays ?? {}), [it.id]: (s.replays?.[it.id] ?? 0) + 1 },
    }));
    setReviewOffer(null);
    setActiveId(null);
    trimEndFiredRef.current = false;
    const c = ctl();
    c?.seek(Math.max(trimStart, it.onWrong.seekTo));
    c?.play();
  };

  const resume = () => {
    setActiveId(null);
    setReviewOffer(null);
    ctl()?.play();
  };

  const skip = () => {
    if (activeId) recordResolved(activeId, SENTINEL);
    setActiveId(null);
    setReviewOffer(null);
    ctl()?.play();
  };

  const handleEnded = () => {
    if (state.stage !== "watching") return;
    // Catch up required non-pausing interactions that playback never landed
    // on (a high rate can jump their trigger window entirely).
    const resolved = { ...state.resolvedInteractions };
    for (const it of validated) {
      if (it.required && !it.pauseOnReach && !resolved[it.id]) resolved[it.id] = SENTINEL;
    }
    const unresolved = validated.find((v) => v.required && v.pauseOnReach && !resolved[v.id]);
    const c = ctl();
    if (unresolved && c) {
      setState((s) => ({
        ...s,
        resolvedInteractions: { ...resolved, ...s.resolvedInteractions },
      }));
      c.seek(Math.max(0, unresolved.atSeconds - 0.5));
      c.play();
      return;
    }
    finishOrSummarize({ ...state, resolvedInteractions: resolved });
  };

  const tryAgain = () => {
    setActiveId(null);
    lastTimeRef.current = trimStart;
    resumeTargetRef.current = trimStart;
    trimEndFiredRef.current = false;
    setResumedAttempt(null);
    setResumePanelDismissed(false);
    setReviewOffer(null);
    setState({ stage: "watching", resolvedInteractions: {}, lastTime: trimStart });
    ctl()?.seek(trimStart);
  };

  // From the summary: rewatch a segment for context, then the video re-ends
  // and the summary returns (required questions are already resolved, so they
  // do not re-prompt).
  const rewatchFrom = (seconds: number) => {
    trimEndFiredRef.current = false;
    setState((s) => ({ ...s, stage: "watching" }));
    const c = ctl();
    c?.seek(Math.max(trimStart, seconds));
    c?.play();
  };

  const toggleCaptions = () => {
    const v = videoRef.current;
    if (!v?.textTracks) return;
    const next = !captionsOn;
    for (let i = 0; i < v.textTracks.length; i += 1) {
      v.textTracks[i]!.mode = next ? "showing" : "disabled";
    }
    setCaptionsOn(next);
  };

  const onFullscreen = () => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
      return;
    }
    // requestFullscreen can reject (embed permissions, user-agent policy).
    // Swallow the rejection and stay inline; the custom control bar lives
    // inside the stage either way.
    try {
      const request = el.requestFullscreen?.();
      if (request && typeof request.catch === "function") {
        request.catch(() => {});
      }
    } catch {
      /* stay non-fullscreen */
    }
  };

  const syncFromVideo = () => {
    const v = videoRef.current;
    if (!v) return;
    setMedia((m) => ({
      ...m,
      currentTime: v.currentTime,
      duration: Number.isFinite(v.duration) ? v.duration : m.duration,
      paused: v.paused,
      volume: v.volume,
      muted: v.muted,
      rate: v.playbackRate,
      ready: Number.isFinite(v.duration) && v.duration > 0,
    }));
  };

  // Resume playback position: once the media reports ready, seek to the
  // position restored from suspend data, clamped into the trim window (a
  // fresh session starts at the window's start).
  useEffect(() => {
    if (resumeDoneRef.current || !media.ready) return;
    resumeDoneRef.current = true;
    if (state.stage !== "watching") return;
    const restored = Math.max(resumeTargetRef.current, trimStart);
    if (restored <= 0) return;
    // Don't resume at (or past) the window's end; leave a beat of playback.
    const windowEnd = Math.min(
      configuredTrimEnd ?? Infinity,
      media.duration > 0 ? media.duration : Infinity,
    );
    ctl()?.seek(Math.min(restored, Math.max(trimStart, windowEnd - 1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.ready]);

  // Focus management for the interaction overlay (role="dialog"): move focus
  // in on open, keep Tab cycling inside, restore focus on close.
  useEffect(() => {
    if (activeId === null) return;
    const overlay = overlayRef.current;
    if (!overlay) return;
    const focusables = () =>
      Array.from(
        overlay.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
    (focusables()[0] ?? overlay).focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const els = focusables();
      if (els.length === 0) {
        e.preventDefault();
        overlay.focus();
        return;
      }
      const first = els[0]!;
      const last = els[els.length - 1]!;
      const current = document.activeElement;
      if (e.shiftKey) {
        if (current === first || !overlay.contains(current)) {
          e.preventDefault();
          last.focus();
        }
      } else if (current === last || !overlay.contains(current)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      // Defer the restore so React commits the close first (controls are
      // re-enabled by then and can receive focus again).
      queueMicrotask(() => lastFocusRef.current?.focus?.());
    };
  }, [activeId]);

  const active = activeId ? validated.find((v) => v.id === activeId) ?? null : null;

  const resumePanelVisible =
    !!resumedAttempt?.submitted && state.stage === "submitted" && !resumePanelDismissed;

  const markers: SeekMarker[] = validated.map((it) => ({
    id: it.id,
    atSeconds: it.atSeconds,
    tone: state.resolvedInteractions[it.id] ? "success" : it.required ? "warning" : "info",
    title: it.title,
    resolved: !!state.resolvedInteractions[it.id],
  }));

  const summaryRows = validated.map((it) => {
    const score = state.resolvedInteractions[it.id];
    const scorable = it.kind === "multipleChoice" || it.kind === "fillInTheBlanks";
    let outcome: "correct" | "incorrect" | "answered" | "viewed" | "missed";
    if (!score) outcome = "missed";
    else if (!scorable) outcome = it.kind === "reflection" ? "answered" : "viewed";
    else outcome = score.success ? "correct" : "incorrect";
    return { it, outcome };
  });
  const answeredCount = Object.keys(state.resolvedInteractions).length;
  const correctScore = aggregate(Object.values(state.resolvedInteractions), scoring.passPercentage);
  const headerBadge =
    state.stage === "submitted" ? (
      correctScore.max > 0 ? (
        <StatusBadge tone={correctScore.success ? "success" : "warning"} icon={correctScore.success ? <TrophyIcon /> : <CheckIcon />}>
          {correctScore.success ? "Passed" : "Review"}
        </StatusBadge>
      ) : (
        // Zero-max = completion: nothing scorable, so the badge matches the
        // success:true submit rather than implying a failed score.
        <StatusBadge tone="success" icon={<CheckIcon />}>Complete</StatusBadge>
      )
    ) : (
      <StatusBadge tone="neutral" icon={<DotIcon />}>In progress</StatusBadge>
    );

  return (
    <div className="kukui-iv">
      <article className="kukui-iv__card" aria-labelledby={headingId}>
        <ActivityHeader
          title={config.title}
          titleId={headingId}
          headingLevel={headingLevel}
          variant={config.appearance?.header ?? "full"}
          badge={headerBadge}
          prompt={config.prompt ? <SafeHtml className="kukui-iv__prompt" html={config.prompt} /> : undefined}
        />

        {/* The stage wraps the frame AND the control bar so both survive
            fullscreen (only stageRef is promoted to the fullscreen element). */}
        <div className="kukui-iv__stage" ref={stageRef}>
          <div className="kukui-iv__frame">
            {isYouTube ? (
              <YouTubeStage
                src={config.video.src}
                className="kukui-iv__video"
                onController={(c) => {
                  controllerRef.current = c;
                }}
                onState={setMedia}
                onTick={tick}
                onEnded={handleEnded}
              />
            ) : (
              <video
                ref={videoRef}
                className="kukui-iv__video"
                src={config.video.src}
                poster={config.video.poster}
                preload="metadata"
                playsInline
                onLoadedMetadata={syncFromVideo}
                onTimeUpdate={() => {
                  syncFromVideo();
                  if (videoRef.current) tick(videoRef.current.currentTime);
                }}
                onPlay={syncFromVideo}
                onPause={() => {
                  syncFromVideo();
                  flushLastTime();
                }}
                onVolumeChange={syncFromVideo}
                onRateChange={syncFromVideo}
                onEnded={handleEnded}
                data-testid="kukui-iv-video"
              >
                {tracks.map((t, i) => (
                  <track key={i} src={t.src} kind="subtitles" srcLang={t.srclang} label={t.label} default={t.default} />
                ))}
              </video>
            )}

            {active ? (
              <>
                {/* Full-stage scrim: traps pointer events so the player underneath
                    (notably the YouTube IFrame) can't be scrubbed mid-question. */}
                <div className="kukui-iv__scrim" aria-hidden="true" />
                <div
                  ref={overlayRef}
                  className="kukui-iv__overlay"
                  role="dialog"
                  aria-modal="true"
                  aria-label={active.title ?? `Interaction at ${formatTime(active.atSeconds)}`}
                  tabIndex={-1}
                >
                  <div className="kukui-iv__overlay-body">
                    {active.kind === "multipleChoice" ? (
                      <MultipleChoice config={active.config} onSubmit={(s) => handleCheckpointSubmit(active, s)} headingLevel={2} />
                    ) : active.kind === "fillInTheBlanks" ? (
                      <FillInTheBlanks config={active.config} onSubmit={(s) => handleCheckpointSubmit(active, s)} headingLevel={2} />
                    ) : active.kind === "reflection" ? (
                      // Open response: gates like any checkpoint but records a
                      // zero-max sentinel so it never shifts a points grade.
                      <ReflectionPrompt
                        config={active.config}
                        onSubmit={() => recordResolved(active.id, SENTINEL)}
                        headingLevel={2}
                      />
                    ) : active.kind === "label" ? (
                      <div className="kukui-iv__label">
                        {active.title ? <h2 className="kukui-iv__label-title">{active.title}</h2> : null}
                        <SafeHtml className="kukui-iv__prose" html={active.html} />
                      </div>
                    ) : (
                      <div className="kukui-iv__invalid" role="note">
                        <strong>This interaction is misconfigured.</strong> {active.reason}
                      </div>
                    )}
                    <div className="kukui-iv__overlay-actions">
                      {reviewOffer?.id === active.id ? (
                        <>
                          <button
                            type="button"
                            className="kukui-iv__primary"
                            onClick={() => acceptReview(active)}
                          >
                            Review that section
                          </button>
                          <button
                            type="button"
                            className="kukui-iv__secondary"
                            onClick={() => {
                              const score = reviewOffer.score;
                              setReviewOffer(null);
                              recordResolved(active.id, score);
                            }}
                          >
                            Continue anyway
                          </button>
                        </>
                      ) : (
                        <>
                          {!active.required && !state.resolvedInteractions[active.id] ? (
                            <button type="button" className="kukui-iv__secondary" onClick={skip}>
                              Skip
                            </button>
                          ) : null}
                          {active.kind === "label" || active.kind === "invalid" ? (
                            <button type="button" className="kukui-iv__primary" onClick={skip}>
                              Continue
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="kukui-iv__primary"
                              onClick={resume}
                              disabled={!state.resolvedInteractions[active.id]}
                            >
                              {resumeLabel}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            {/* Returning-learner explanation: without this a restored
                submitted attempt reads as "the video auto-completed and
                never asked me anything." */}
            {resumePanelVisible ? (
              <>
                <div className="kukui-iv__scrim" aria-hidden="true" />
                <div className="kukui-iv__overlay kukui-iv__overlay--resume" role="status">
                  <div className="kukui-iv__overlay-body">
                    <h2 className="kukui-iv__resume-title">Completed on a previous attempt</h2>
                    <p className="kukui-iv__resume-detail">
                      {correctScore.max > 0
                        ? `Your recorded score is ${correctScore.raw} of ${correctScore.max} (${correctScore.success ? "passed" : "not passed"}).`
                        : "This activity was marked complete."}
                    </p>
                    <div className="kukui-iv__overlay-actions">
                      {scoring.enableRetry ? (
                        <button type="button" className="kukui-iv__primary" onClick={tryAgain}>
                          Try again
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="kukui-iv__secondary"
                        onClick={() => setResumePanelDismissed(true)}
                      >
                        Watch again
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>

          <VideoControls
            media={media}
            markers={markers}
            rates={rates}
            captionsOn={captionsOn}
            onToggleCaptions={tracks.length > 0 && !isYouTube ? toggleCaptions : undefined}
            onPlayPause={() => (media.paused ? ctl()?.play() : ctl()?.pause())}
            onSeek={handleSeek}
            onSeekToMarker={handleSeekToMarker}
            onSetVolume={(v) => ctl()?.setVolume(v)}
            onToggleMute={() => ctl()?.setMuted(!media.muted)}
            onSetRate={(r) => ctl()?.setRate(r)}
            onFullscreen={onFullscreen}
            disabled={active !== null}
            trimStart={trimStart > 0 ? trimStart : undefined}
            trimEnd={configuredTrimEnd}
            chapters={config.chapters}
          />
        </div>

        {validated.length > 0 ? (
          <ol className="kukui-iv__list" aria-label="Interactions">
            {validated.map((it) => {
              const done = !!state.resolvedInteractions[it.id];
              return (
                <li key={it.id} className="kukui-iv__list-item">
                  <button type="button" className="kukui-iv__list-jump" onClick={() => handleSeekToMarker(it.id)}>
                    <span className="kukui-iv__list-time">{formatTime(it.atSeconds)}</span>
                    <span className="kukui-iv__list-title">{it.title ?? KIND_LABEL[it.kind]}</span>
                  </button>
                  <span className="kukui-iv__list-status">
                    {done ? (
                      <StatusBadge tone="success" icon={<CheckIcon />}>Done</StatusBadge>
                    ) : it.required ? (
                      <StatusBadge tone="warning">Required</StatusBadge>
                    ) : (
                      <StatusBadge tone="info">Optional</StatusBadge>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : null}

        {state.stage === "summary" ? (
          <section className="kukui-iv__summary" aria-label="Review your answers">
            <h2 className="kukui-iv__summary-title">Review your answers</h2>
            <ol className="kukui-iv__summary-list">
              {summaryRows.map(({ it, outcome }) => (
                <li key={it.id} className="kukui-iv__summary-row">
                  <button
                    type="button"
                    className="kukui-iv__summary-jump"
                    onClick={() => rewatchFrom(it.atSeconds)}
                  >
                    <span className="kukui-iv__list-time">{formatTime(it.atSeconds)}</span>
                    <span className="kukui-iv__list-title">{it.title ?? KIND_LABEL[it.kind]}</span>
                  </button>
                  <span className={`kukui-iv__summary-outcome is-${outcome}`}>
                    {SUMMARY_OUTCOME_LABEL[outcome]}
                  </span>
                </li>
              ))}
            </ol>
            <div className="kukui-iv__actions">
              <button
                type="button"
                className="kukui-iv__primary"
                onClick={() => submitFrom(state)}
              >
                Submit
              </button>
            </div>
          </section>
        ) : null}

        <p
          className={["kukui-iv__status", state.stage === "submitted" ? "is-visible" : ""].filter(Boolean).join(" ")}
          role="status"
          aria-live="polite"
        >
          {state.stage === "submitted"
            ? `Submitted. ${answeredCount} of ${validated.length} interactions answered.`
            : resumedAttempt && !resumedAttempt.submitted
              ? `Resumed. ${answeredCount} of ${validated.length} interactions answered.`
              : `${answeredCount} of ${validated.length} interactions answered.`}
        </p>

        {/* Suppressed while the resume panel is open so there is exactly one
            Try again affordance on screen. */}
        {state.stage === "submitted" && scoring.enableRetry && !resumePanelVisible ? (
          <div className="kukui-iv__actions">
            <button type="button" className="kukui-iv__secondary" onClick={tryAgain}>
              Try again
            </button>
          </div>
        ) : null}
      </article>
    </div>
  );
}

const SUMMARY_OUTCOME_LABEL: Record<string, string> = {
  correct: "Correct",
  incorrect: "Incorrect",
  answered: "Answered",
  viewed: "Viewed",
  missed: "Not answered",
};

const KIND_LABEL: Record<string, string> = {
  label: "Info card",
  multipleChoice: "Multiple choice",
  fillInTheBlanks: "Fill in the blanks",
  reflection: "Reflection",
  invalid: "Misconfigured",
};

function parseSuspend(s: string | undefined): State | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as Partial<State> & { currentTime?: number };
    if (parsed && typeof parsed === "object" && parsed.resolvedInteractions && typeof parsed.resolvedInteractions === "object") {
      return {
        stage: parsed.stage === "submitted" ? "submitted" : "watching",
        resolvedInteractions: parsed.resolvedInteractions as Record<string, ScoreState>,
        lastTime: typeof parsed.lastTime === "number" ? parsed.lastTime : typeof parsed.currentTime === "number" ? parsed.currentTime : 0,
      };
    }
  } catch {
    /* noop */
  }
  return null;
}
