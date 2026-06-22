import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  MultipleChoiceConfigSchema,
  type MultipleChoiceConfig,
} from "@kukui/activities/multiple-choice/schema";
import {
  FillInTheBlanksConfigSchema,
  type FillInTheBlanksConfig,
} from "@kukui/activities/fill-in-the-blanks/schema";
import type { InteractiveVideoConfig } from "./schema.js";
import type { ActivityProps, ScoreState } from "@kukui/core/types";
import { aggregate, resolveScoring } from "@kukui/core/scoring";
import MultipleChoice from "@kukui/activities/multiple-choice/Component";
import FillInTheBlanks from "@kukui/activities/fill-in-the-blanks/Component";
import { ActivityHeader, SafeHtml, StatusBadge, DotIcon, CheckIcon, TrophyIcon } from "@kukui/core";
import { YouTubeStage, type VideoController } from "./YouTubeStage.js";
import { VideoControls, type SeekMarker } from "./VideoControls.js";
import { INITIAL_MEDIA, type MediaState, formatTime } from "./media.js";
import "./Component.css";

type Stage = "watching" | "submitted";

type State = {
  stage: Stage;
  resolvedInteractions: Record<string, ScoreState>;
  /** Last seen time (whole seconds) for resume. */
  lastTime: number;
};

type Base = {
  id: string;
  atSeconds: number;
  required: boolean;
  pauseOnReach: boolean;
  title?: string;
};
type ValidatedInteraction =
  | (Base & { kind: "label"; html: string })
  | (Base & { kind: "multipleChoice"; config: MultipleChoiceConfig })
  | (Base & { kind: "fillInTheBlanks"; config: FillInTheBlanksConfig })
  | (Base & { kind: "invalid"; reason: string });

const TRIGGER_WINDOW = 0.5;
const SENTINEL: ScoreState = { raw: 0, max: 0, success: true };

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

  const validated = useMemo<ValidatedInteraction[]>(() => {
    const out: ValidatedInteraction[] = [];
    config.interactions.forEach((it) => {
      const base: Base = {
        id: it.id,
        atSeconds: it.atSeconds,
        required: it.required ?? true,
        pauseOnReach: it.pauseOnReach ?? true,
        title: it.title,
      };
      if (it.kind === "label") {
        const html = typeof it.config.html === "string" ? it.config.html : "";
        out.push({ ...base, kind: "label", html });
      } else if (it.kind === "multipleChoice") {
        const r = MultipleChoiceConfigSchema.safeParse(it.config);
        if (r.success) out.push({ ...base, kind: "multipleChoice", config: r.data });
        else out.push({ ...base, kind: "invalid", reason: r.error.issues[0]?.message ?? "Invalid multiple-choice config" });
      } else {
        const r = FillInTheBlanksConfigSchema.safeParse(it.config);
        if (r.success) out.push({ ...base, kind: "fillInTheBlanks", config: r.data });
        else out.push({ ...base, kind: "invalid", reason: r.error.issues[0]?.message ?? "Invalid fill-in-the-blanks config" });
      }
    });
    out.sort((a, b) => a.atSeconds - b.atSeconds);
    return out;
  }, [config.interactions]);

  const [state, setState] = useState<State>(
    () => parseSuspend(suspendData) ?? { stage: "watching", resolvedInteractions: {}, lastTime: 0 },
  );
  const [media, setMedia] = useState<MediaState>(INITIAL_MEDIA);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [captionsOn, setCaptionsOn] = useState(false);

  useEffect(() => {
    setState(parseSuspend(suspendData) ?? { stage: "watching", resolvedInteractions: {}, lastTime: 0 });
    setActiveId(null);
    setMedia(INITIAL_MEDIA);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  useEffect(() => {
    if (onPersist) onPersist(JSON.stringify(state));
  }, [state, onPersist]);

  const videoType = config.video.type ?? "html5";
  const isYouTube = videoType === "youtube";
  const isVimeo = videoType === "vimeo";
  const tracks = config.video.tracks ?? [];
  const rates = config.behaviour?.playbackRates ?? [0.75, 1, 1.25, 1.5, 2];
  const ui = config.ui ?? {};
  const resumeLabel = ui.resumeButtonLabel ?? "Resume";

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
    // Only MC/FIB contribute real scores; label/invalid resolutions are sentinels (max 0).
    const scores = Object.values(snapshot.resolvedInteractions);
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

  const requiredOnes = useMemo(() => validated.filter((v) => v.required), [validated]);
  const allRequiredResolved = useMemo(() => {
    if (requiredOnes.length === 0) return false;
    return requiredOnes.every((v) => state.resolvedInteractions[v.id]);
  }, [requiredOnes, state.resolvedInteractions]);

  useEffect(() => {
    if (state.stage !== "watching") return;
    if (!allRequiredResolved) return;
    submitFrom(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRequiredResolved, state]);

  /** Earliest unresolved required interaction in (after, atMost], or null. */
  const blockingBetween = (after: number, atMost: number): ValidatedInteraction | null => {
    let best: ValidatedInteraction | null = null;
    for (const it of validated) {
      if (!it.required) continue;
      if (state.resolvedInteractions[it.id]) continue;
      if (it.atSeconds > after + TRIGGER_WINDOW && it.atSeconds <= atMost) {
        if (!best || it.atSeconds < best.atSeconds) best = it;
      }
    }
    return best;
  };

  const tick = (t: number) => {
    if (Math.floor(t) !== state.lastTime) {
      setState((s) => (Math.floor(t) === s.lastTime ? s : { ...s, lastTime: Math.floor(t) }));
    }
    if (activeId !== null) return;
    if (state.stage !== "watching") return;
    const c = ctl();
    for (const it of validated) {
      if (state.resolvedInteractions[it.id]) continue;
      if (Math.abs(t - it.atSeconds) < TRIGGER_WINDOW && t >= it.atSeconds - TRIGGER_WINDOW) {
        if (it.pauseOnReach) {
          c?.pause();
          setActiveId(it.id);
        } else {
          // Non-pausing: auto-resolve so it never gates.
          recordResolved(it.id, SENTINEL);
        }
        return;
      }
      if (it.required && it.pauseOnReach && t > it.atSeconds + TRIGGER_WINDOW) {
        c?.seek(Math.max(0, it.atSeconds - 0.5));
        c?.pause();
        return;
      }
    }
  };

  const handleSeek = (target: number) => {
    if (state.stage === "submitted") {
      ctl()?.seek(target);
      return;
    }
    // Forward seeks clamp to the earliest unresolved required in between.
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
    setState((s) => ({ ...s, resolvedInteractions: { ...s.resolvedInteractions, [id]: score } }));
  };

  const resume = () => {
    setActiveId(null);
    ctl()?.play();
  };

  const skip = () => {
    if (activeId) recordResolved(activeId, SENTINEL);
    setActiveId(null);
    ctl()?.play();
  };

  const handleEnded = () => {
    if (state.stage !== "watching") return;
    const unresolved = validated.find(
      (v) => v.required && v.pauseOnReach && !state.resolvedInteractions[v.id],
    );
    const c = ctl();
    if (unresolved && c) {
      c.seek(Math.max(0, unresolved.atSeconds - 0.5));
      c.play();
      return;
    }
    submitFrom(state);
  };

  const tryAgain = () => {
    setActiveId(null);
    setState({ stage: "watching", resolvedInteractions: {}, lastTime: 0 });
    ctl()?.seek(0);
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
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.();
  };

  // html5 media-event handlers keep `media` in sync + drive the checkpoint tick.
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

  const active = activeId ? validated.find((v) => v.id === activeId) ?? null : null;

  const markers: SeekMarker[] = validated.map((it) => ({
    id: it.id,
    atSeconds: it.atSeconds,
    tone: state.resolvedInteractions[it.id] ? "success" : it.required ? "warning" : "info",
    title: it.title,
    resolved: !!state.resolvedInteractions[it.id],
  }));

  const answeredCount = Object.keys(state.resolvedInteractions).length;
  const scorable = validated.filter((v) => v.kind === "multipleChoice" || v.kind === "fillInTheBlanks");
  const correctScore = aggregate(Object.values(state.resolvedInteractions), scoring.passPercentage);
  const headerBadge =
    state.stage === "submitted" ? (
      scorable.length > 0 ? (
        <StatusBadge tone={correctScore.success ? "success" : "warning"} icon={correctScore.success ? <TrophyIcon /> : <CheckIcon />}>
          {correctScore.success ? "Passed" : "Review"}
        </StatusBadge>
      ) : (
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

        <div className="kukui-iv__stage" ref={stageRef}>
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
          ) : isVimeo ? (
            <div role="note" className="kukui-iv__placeholder">
              Vimeo embeds aren&rsquo;t supported yet — use a hosted MP4 (type
              &ldquo;html5&rdquo;) or a YouTube URL.
            </div>
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
              onPause={syncFromVideo}
              onVolumeChange={syncFromVideo}
              onRateChange={syncFromVideo}
              onEnded={handleEnded}
              data-testid="kukui-iv-video"
            >
              {tracks.map((t, i) => (
                <track
                  key={i}
                  src={t.src}
                  kind="subtitles"
                  srcLang={t.srclang}
                  label={t.label}
                  default={t.default}
                />
              ))}
            </video>
          )}

          {active ? (
            <div
              className="kukui-iv__overlay"
              role="dialog"
              aria-modal="true"
              aria-label={active.title ?? `Interaction at ${formatTime(active.atSeconds)}`}
            >
              <div className="kukui-iv__overlay-body">
                {active.kind === "multipleChoice" ? (
                  <MultipleChoice config={active.config} onSubmit={(s) => recordResolved(active.id, s)} headingLevel={2} />
                ) : active.kind === "fillInTheBlanks" ? (
                  <FillInTheBlanks config={active.config} onSubmit={(s) => recordResolved(active.id, s)} headingLevel={2} />
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
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {!isVimeo ? (
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
          />
        ) : null}

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

        <p
          className={["kukui-iv__status", state.stage === "submitted" ? "is-visible" : ""].filter(Boolean).join(" ")}
          role="status"
          aria-live="polite"
        >
          {state.stage === "submitted"
            ? `Submitted. ${answeredCount} of ${validated.length} interactions answered.`
            : `${answeredCount} of ${validated.length} interactions answered.`}
        </p>

        {state.stage === "submitted" && scoring.enableRetry ? (
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

const KIND_LABEL: Record<string, string> = {
  label: "Info card",
  multipleChoice: "Multiple choice",
  fillInTheBlanks: "Fill in the blanks",
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
