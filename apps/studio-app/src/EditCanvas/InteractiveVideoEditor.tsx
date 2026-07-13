import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { StageHeader } from "./StageHeader.js";

/**
 * Visual timeline editor for the interactive-video activity.
 *
 * The form pane (left) edits chrome (title, prompt, video URL). This canvas
 * owns the part that's painful to author as bare numbers: *where* in the video
 * each interaction fires. It shows the video (native scrubbing for MP4), a
 * timeline track with a draggable marker per interaction, and an inspector for
 * the selected interaction — including inline multiple-choice content so a
 * working checkpoint can be built without leaving the canvas.
 *
 * YouTube/Vimeo can't be scrubbed here (no IFrame API wired into the editor),
 * so for those the author sets the clip length by hand and still places markers
 * against it; the Live tab is the place to test actual playback.
 */

type Kind = "multipleChoice" | "fillInTheBlanks";

type Answer = { text: string; correct: boolean; feedback?: string };

type McConfig = {
  version: string;
  title: string;
  question: string;
  answers: Answer[];
  [k: string]: unknown;
};

type Interaction = {
  id: string;
  atSeconds: number;
  required?: boolean;
  kind: Kind;
  config: Record<string, unknown>;
};

type IVConfig = {
  video?: { src?: string; type?: "html5" | "youtube" | "vimeo"; poster?: string };
  interactions?: Interaction[];
  [k: string]: unknown;
};

const FALLBACK_DURATION = 60;

function newInteractionId(existing: string[]): string {
  let i = existing.length + 1;
  while (existing.includes(`iv-${i}`)) i += 1;
  return `iv-${i}`;
}

/** A fresh, schema-valid multiple-choice checkpoint so a new marker works immediately. */
function seedMcConfig(): McConfig {
  return {
    version: "1.0",
    title: "Checkpoint question",
    question: "<p>New question. Edit me.</p>",
    answers: [
      { text: "Correct answer", correct: true },
      { text: "Another option", correct: false },
    ],
  };
}

function fmt(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/** Strip tags for the editable plain-text view of an HTML question. */
function htmlToText(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

/**
 * Parse a timecode the way an author would type it: "1:05" → 65, "12:03:40" →
 * 43420, or a bare "90" → 90 seconds. Returns null on anything unparseable so
 * the caller can revert to the last good value.
 */
function parseTimecode(input: string): number | null {
  const s = input.trim();
  if (s === "") return null;
  if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  if (!/^\d{1,2}(:\d{1,2}){1,2}(\.\d+)?$/.test(s)) return null;
  const parts = s.split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  // Allow 60+ in the leading field (e.g. "80:00") but seconds/minutes columns
  // that follow stay 0–59 by convention; we don't hard-reject to keep it lenient.
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

/**
 * Text input that shows/accepts m:ss timecodes but stores seconds. Keeps a
 * local draft string while focused so typing isn't fought by reformatting;
 * commits (parsed + clamped) on blur or Enter, reverting if unparseable.
 */
function TimecodeField({
  label,
  value,
  onCommit,
  max,
  min = 0,
  wrapClassName = "ks-iv-tl__field",
}: {
  label: string;
  value: number;
  onCommit: (seconds: number) => void;
  max?: number;
  min?: number;
  wrapClassName?: string;
}) {
  const [text, setText] = useState(() => fmt(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(fmt(value));
  }, [value, focused]);

  const commit = () => {
    const parsed = parseTimecode(text);
    if (parsed === null) {
      setText(fmt(value));
      return;
    }
    let v = Math.max(min, parsed);
    if (max != null) v = Math.min(v, max);
    onCommit(v);
    setText(fmt(v));
  };

  return (
    <label className={wrapClassName}>
      {label}
      <input
        type="text"
        inputMode="numeric"
        placeholder="m:ss"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </label>
  );
}

/** Extract the 11-char video id from watch / youtu.be / embed URLs. */
function parseYouTubeId(src: string): string | null {
  try {
    const u = new URL(src);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1) || null;
    const v = u.searchParams.get("v");
    if (v) return v;
    const m = u.pathname.match(/\/embed\/([^/?]+)/);
    if (m) return m[1] ?? null;
    return null;
  } catch {
    return /^[\w-]{6,}$/.test(src) ? src : null;
  }
}

// --- Minimal YouTube IFrame Player API plumbing (editor-side) ----------------
// We can't reuse the runtime YouTubeStage: it has no duration readout and bakes
// in checkpoint polling. This loader is the same singleton pattern, but exposes
// getDuration + a seek handle so the timeline can drive the player.
type YTPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
};
type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      host?: string;
      playerVars?: Record<string, number>;
      events?: { onReady?: () => void };
    },
  ) => YTPlayer;
};
// Access the global without re-augmenting Window (YouTubeStage already does,
// with a different shape — a second global augmentation would conflict).
type YTWindow = Window & {
  YT?: YTNamespace;
  onYouTubeIframeAPIReady?: () => void;
};

let ytApiPromise: Promise<YTNamespace> | null = null;
function loadYouTubeApi(): Promise<YTNamespace> {
  const w = window as YTWindow;
  if (w.YT?.Player) return Promise.resolve(w.YT);
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise<YTNamespace>((resolve) => {
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (w.YT) resolve(w.YT);
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

/**
 * YouTube player for the editor. Renders the IFrame (with its native controls,
 * so the author can scrub directly), reports currentTime + duration up via
 * callbacks, and assigns a seek function into `seekRef` so the timeline track
 * and markers can move the playhead.
 */
function YouTubeScrubber({
  videoId,
  onTime,
  onDuration,
  seekRef,
}: {
  videoId: string;
  onTime: (seconds: number) => void;
  onDuration: (seconds: number) => void;
  seekRef: { current: ((seconds: number) => void) | null };
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onTimeRef = useRef(onTime);
  const onDurationRef = useRef(onDuration);
  onTimeRef.current = onTime;
  onDurationRef.current = onDuration;

  useEffect(() => {
    if (!hostRef.current) return;
    let cancelled = false;
    let player: YTPlayer | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !hostRef.current) return;
        player = new YT.Player(hostRef.current, {
          videoId,
          host: "https://www.youtube-nocookie.com",
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
          events: {
            onReady: () => {
              seekRef.current = (s) => player?.seekTo(s, true);
              poll = setInterval(() => {
                if (!player) return;
                if (typeof player.getCurrentTime === "function") {
                  onTimeRef.current(player.getCurrentTime());
                }
                if (typeof player.getDuration === "function") {
                  const d = player.getDuration();
                  if (d > 0) onDurationRef.current(d);
                }
              }, 250);
            },
          },
        });
      })
      .catch(() => {
        /* API blocked/offline — falls back to the manual-length UI below. */
      });

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      seekRef.current = null;
      try {
        player?.destroy();
      } catch {
        /* noop */
      }
    };
  }, [videoId, seekRef]);

  return <div ref={hostRef} className="ks-iv-tl__video" />;
}

export function InteractiveVideoEditor({
  config,
  onChange,
}: {
  config: IVConfig;
  onChange: (next: IVConfig) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Seek handle for the YouTube player; assigned once the IFrame is ready.
  const ytSeekRef = useRef<((seconds: number) => void) | null>(null);

  const interactions = useMemo<Interaction[]>(
    () => (Array.isArray(config.interactions) ? config.interactions : []),
    [config.interactions],
  );

  const videoType = config.video?.type ?? "html5";
  const isHtml5 = videoType === "html5";
  const isYouTube = videoType === "youtube";
  const src = config.video?.src ?? "";
  const youTubeId = useMemo(
    () => (isYouTube ? parseYouTubeId(src) : null),
    [isYouTube, src],
  );
  const canScrub = (isHtml5 && !!src) || (isYouTube && !!youTubeId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState(0);
  // Manual length used when we can't read it off the media (YouTube/Vimeo, or
  // before metadata loads). Seeded generously so existing markers stay on-track.
  const [manualDuration, setManualDuration] = useState<number>(() =>
    Math.max(
      FALLBACK_DURATION,
      ...interactions.map((it) => Math.ceil(it.atSeconds) + 10),
    ),
  );
  const [mediaDuration, setMediaDuration] = useState<number | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const duration = mediaDuration ?? manualDuration;

  // Reset transient UI when the activity (or its video) changes underneath us.
  useEffect(() => {
    setSelectedId(null);
    setMediaDuration(null);
    setPlayhead(0);
  }, [src, videoType]);

  const selected = selectedId
    ? interactions.find((it) => it.id === selectedId) ?? null
    : null;

  const commit = (next: Interaction[]) => onChange({ ...config, interactions: next });

  const patch = (id: string, fields: Partial<Interaction>) =>
    commit(interactions.map((it) => (it.id === id ? { ...it, ...fields } : it)));

  const timeFromClientX = (clientX: number): number => {
    const track = trackRef.current;
    if (!track) return 0;
    const r = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return ratio * duration;
  };

  const seekTo = (t: number) => {
    setPlayhead(t);
    if (!Number.isFinite(t)) return;
    if (isHtml5) {
      const v = videoRef.current;
      if (v) v.currentTime = t;
    } else if (isYouTube) {
      ytSeekRef.current?.(t);
    }
  };

  const addAtPlayhead = () => {
    const id = newInteractionId(interactions.map((it) => it.id));
    const at = Math.round(playhead * 10) / 10;
    const next: Interaction = {
      id,
      atSeconds: at,
      required: true,
      kind: "multipleChoice",
      config: seedMcConfig(),
    };
    commit(
      [...interactions, next].sort((a, b) => a.atSeconds - b.atSeconds),
    );
    setSelectedId(id);
  };

  const remove = (id: string) => {
    commit(interactions.filter((it) => it.id !== id));
    setSelectedId(null);
  };

  // ---- marker drag ----------------------------------------------------------
  const startDrag = (id: string) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setSelectedId(id);
    setDragId(id);
    // Pointer capture keeps the drag tracking if the cursor leaves the marker.
    // Guarded: it can throw InvalidStateError, and isn't present in jsdom.
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* capture unavailable — drag still works via the track's move handler */
    }
  };

  const onTrackPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragId) return;
    const t = Math.round(timeFromClientX(e.clientX) * 10) / 10;
    patch(dragId, { atSeconds: t });
  };

  const endDrag = () => {
    if (!dragId) return;
    // Re-sort so chronological order (which the runtime relies on) holds.
    commit([...interactions].sort((a, b) => a.atSeconds - b.atSeconds));
    setDragId(null);
  };

  const onTrackClick = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragId) return;
    if (e.target !== trackRef.current) return;
    seekTo(timeFromClientX(e.clientX));
  };

  return (
    <div className="ks-iv-tl">
      <StageHeader
        title={typeof config.title === "string" ? config.title : ""}
        prompt={typeof config.prompt === "string" ? config.prompt : ""}
        onPatch={(patch) => onChange({ ...config, ...patch })}
      />
      <p className="ks-edit-canvas__hint">
        {canScrub ? "Scrub the video, then " : "Set the clip length, then "}
        <strong>Add interaction</strong> drops a checkpoint at the playhead. Drag a
        marker to re-time it; click one to edit its question. Use the <strong>Live</strong>
        tab to test playback.
      </p>

      <div className="ks-iv-tl__stage">
        {isHtml5 && src ? (
          <video
            ref={videoRef}
            className="ks-iv-tl__video"
            src={src}
            poster={config.video?.poster}
            controls
            preload="metadata"
            playsInline
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration;
              if (Number.isFinite(d) && d > 0) setMediaDuration(d);
            }}
            onTimeUpdate={(e) => setPlayhead(e.currentTarget.currentTime)}
          />
        ) : isYouTube && youTubeId ? (
          <YouTubeScrubber
            videoId={youTubeId}
            seekRef={ytSeekRef}
            onTime={(t) => setPlayhead(t)}
            onDuration={(d) => setMediaDuration(d)}
          />
        ) : (
          <div className="ks-iv-tl__noscrub">
            <p>
              {src ? (
                <>In-canvas scrubbing supports MP4 and YouTube. This is a <strong>{videoType}</strong> source.
                Set the length below, place markers, and test in the <strong>Live</strong> tab.</>
              ) : (
                <>Add a video URL in the form to start placing interactions.</>
              )}
            </p>
          </div>
        )}
      </div>

      <div className="ks-iv-tl__controls">
        <button type="button" className="kukui-studio-btn kukui-studio-btn--primary" onClick={addAtPlayhead}>
          + Add interaction at {fmt(playhead)}
        </button>
        {!mediaDuration ? (
          <TimecodeField
            label="Clip length (m:ss)"
            value={manualDuration}
            min={1}
            onCommit={(v) => setManualDuration(v)}
            wrapClassName="ks-iv-tl__len"
          />
        ) : (
          <span className="ks-iv-tl__len-readout">Length {fmt(duration)}</span>
        )}
      </div>

      {/* Timeline track */}
      <div
        ref={trackRef}
        className="ks-iv-tl__track"
        onPointerMove={onTrackPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerDown={onTrackClick}
        role="group"
        aria-label="Interaction timeline"
      >
        <div
          className="ks-iv-tl__playhead"
          style={{ left: `${(playhead / duration) * 100}%` }}
          aria-hidden="true"
        />
        {interactions.map((it) => {
          const pct = Math.max(0, Math.min(100, (it.atSeconds / duration) * 100));
          const isSel = it.id === selectedId;
          return (
            <button
              key={it.id}
              type="button"
              className={[
                "ks-iv-tl__marker",
                isSel ? "is-selected" : "",
                it.required ? "is-required" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ left: `${pct}%` }}
              onPointerDown={startDrag(it.id)}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedId(it.id);
                seekTo(it.atSeconds);
              }}
              title={`${fmt(it.atSeconds)}, ${it.kind === "multipleChoice" ? "Multiple choice" : "Fill in the blanks"}`}
            >
              <span className="ks-iv-tl__marker-time">{fmt(it.atSeconds)}</span>
            </button>
          );
        })}
        {interactions.length === 0 ? (
          <span className="ks-iv-tl__track-empty">No interactions yet</span>
        ) : null}
      </div>

      {/* Inspector for the selected interaction */}
      {selected ? (
        <Inspector
          key={selected.id}
          interaction={selected}
          duration={duration}
          onPatch={(fields) => patch(selected.id, fields)}
          onPatchConfig={(cfg) => patch(selected.id, { config: cfg })}
          onRemove={() => remove(selected.id)}
        />
      ) : (
        <p className="ks-iv-tl__noselect">Select a marker to edit its timing and question.</p>
      )}
    </div>
  );
}

function Inspector({
  interaction,
  duration,
  onPatch,
  onPatchConfig,
  onRemove,
}: {
  interaction: Interaction;
  duration: number;
  onPatch: (fields: Partial<Interaction>) => void;
  onPatchConfig: (config: Record<string, unknown>) => void;
  onRemove: () => void;
}) {
  const isMc = interaction.kind === "multipleChoice";
  const mc = interaction.config as Partial<McConfig>;
  const answers: Answer[] = Array.isArray(mc.answers) ? (mc.answers as Answer[]) : [];

  const setAnswers = (next: Answer[]) => onPatchConfig({ ...mc, answers: next });

  return (
    <div className="ks-iv-tl__inspector">
      <div className="ks-iv-tl__inspector-head">
        <h3>Interaction at {fmt(interaction.atSeconds)}</h3>
        <button type="button" className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm" onClick={onRemove}>
          Delete
        </button>
      </div>

      <div className="ks-iv-tl__row">
        <TimecodeField
          label="Time (m:ss)"
          value={interaction.atSeconds}
          max={Math.ceil(duration)}
          onCommit={(v) => onPatch({ atSeconds: v })}
        />
        <label className="ks-iv-tl__check">
          <input
            type="checkbox"
            checked={interaction.required ?? true}
            onChange={(e) => onPatch({ required: e.target.checked })}
          />
          Required (blocks resume until answered)
        </label>
      </div>

      {isMc ? (
        <>
          <label className="ks-iv-tl__field">
            Question
            <textarea
              rows={2}
              value={htmlToText(typeof mc.question === "string" ? mc.question : "")}
              onChange={(e) => onPatchConfig({ ...mc, question: `<p>${e.target.value}</p>` })}
            />
          </label>
          <div className="ks-iv-tl__answers">
            <span className="ks-iv-tl__answers-label">Answers (pick the correct one)</span>
            {answers.map((a, i) => (
              <div key={i} className="ks-iv-tl__answer">
                <input
                  type="radio"
                  name={`correct-${interaction.id}`}
                  checked={!!a.correct}
                  onChange={() =>
                    setAnswers(answers.map((x, j) => ({ ...x, correct: j === i })))
                  }
                  aria-label={`Mark answer ${i + 1} correct`}
                />
                <input
                  type="text"
                  value={a.text}
                  placeholder={`Option ${i + 1}`}
                  onChange={(e) =>
                    setAnswers(answers.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))
                  }
                />
                <button
                  type="button"
                  className="kukui-studio-btn kukui-studio-btn--icon kukui-studio-btn--sm"
                  onClick={() => setAnswers(answers.filter((_, j) => j !== i))}
                  disabled={answers.length <= 2}
                  aria-label={`Remove answer ${i + 1}`}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="kukui-studio-btn kukui-studio-btn--ghost kukui-studio-btn--sm"
              onClick={() => setAnswers([...answers, { text: "", correct: false }])}
            >
              + Add answer
            </button>
          </div>
        </>
      ) : (
        <p className="ks-iv-tl__note">
          This is a fill-in-the-blanks checkpoint. Edit its content in the form on the right.
        </p>
      )}
    </div>
  );
}
