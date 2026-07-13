import { type MediaState, formatTime } from "./media.js";

export type MarkerTone = "warning" | "info" | "success";

export type SeekMarker = {
  id: string;
  atSeconds: number;
  tone: MarkerTone;
  title?: string;
  resolved: boolean;
};

export type ChapterMark = {
  id: string;
  atSeconds: number;
  title: string;
};

type Props = {
  media: MediaState;
  markers: SeekMarker[];
  rates: number[];
  captionsOn?: boolean;
  /** Provide to show a captions toggle (html5 only). */
  onToggleCaptions?: () => void;
  onPlayPause: () => void;
  onSeek: (seconds: number) => void;
  onSeekToMarker: (id: string) => void;
  onSetVolume: (v: number) => void;
  onToggleMute: () => void;
  onSetRate: (r: number) => void;
  onFullscreen: () => void;
  /** Disable transport while an interaction overlay is open. */
  disabled?: boolean;
  /** Trim window start (seconds). The scrubber and clock remap to it. */
  trimStart?: number;
  /** Trim window end (seconds). Defaults to the media duration. */
  trimEnd?: number;
  /** Optional chapter jump points shown as ticks plus a menu. */
  chapters?: ChapterMark[];
};

/** Custom video control bar: play/pause, seek + interaction markers, volume,
 *  speed, captions, fullscreen. Backend-agnostic (drives a VideoController via
 *  the callbacks). Tokens only; 44px targets; every control has a text label. */
export function VideoControls({
  media,
  markers,
  rates,
  captionsOn,
  onToggleCaptions,
  onPlayPause,
  onSeek,
  onSeekToMarker,
  onSetVolume,
  onToggleMute,
  onSetRate,
  onFullscreen,
  disabled,
  trimStart,
  trimEnd,
  chapters,
}: Props) {
  const { currentTime, duration, paused, volume, muted, rate } = media;
  // The displayed timeline is the trim window, not the raw file: elapsed and
  // total read as window-relative, the scrubber's range is the window, and
  // markers are positioned by their fraction of the window.
  const winStart = trimStart ?? 0;
  const winEnd =
    trimEnd !== undefined && trimEnd > winStart
      ? duration > 0
        ? Math.min(trimEnd, duration)
        : trimEnd
      : duration;
  const winLength = Math.max(0, winEnd - winStart);
  const pct = (t: number) =>
    winLength > 0 ? Math.min(100, Math.max(0, ((t - winStart) / winLength) * 100)) : 0;
  const shownTime = Math.min(Math.max(currentTime, winStart), winEnd || currentTime);

  return (
    <div className="kukui-iv__controls">
      <button
        type="button"
        className="kukui-iv__ctl-btn"
        onClick={onPlayPause}
        disabled={disabled}
        aria-label={paused ? "Play" : "Pause"}
      >
        {paused ? <PlayIcon /> : <PauseIcon />}
      </button>

      <span className="kukui-iv__time" aria-hidden="true">
        {formatTime(shownTime - winStart)} / {formatTime(winLength)}
      </span>

      <div className="kukui-iv__seek">
        <input
          type="range"
          className="kukui-iv__seek-input"
          min={winStart}
          max={winLength > 0 ? winEnd : winStart}
          step={0.1}
          value={shownTime}
          disabled={disabled || winLength === 0}
          aria-label="Seek"
          style={{ ["--pct" as string]: `${pct(shownTime)}%` }}
          onChange={(e) => onSeek(Number(e.target.value))}
        />
        <div className="kukui-iv__markers">
          {(chapters ?? [])
            .filter((ch) => ch.atSeconds >= winStart && ch.atSeconds <= (winEnd || ch.atSeconds))
            .map((ch) => (
              <span
                key={`ch-${ch.id}`}
                className="kukui-iv__chapter-tick"
                style={{ left: `${pct(ch.atSeconds)}%` }}
                aria-hidden="true"
                title={`${formatTime(ch.atSeconds)}: ${ch.title}`}
              />
            ))}
          {markers.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`kukui-iv__marker is-${m.tone}${m.resolved ? " is-resolved" : ""}`}
              style={{ left: `${pct(m.atSeconds)}%` }}
              onClick={() => onSeekToMarker(m.id)}
              disabled={disabled}
              aria-label={`Interaction at ${formatTime(m.atSeconds)}${m.title ? `: ${m.title}` : ""}${m.resolved ? " (answered)" : ""}`}
              title={`${formatTime(m.atSeconds)}${m.title ? ` — ${m.title}` : ""}`}
            />
          ))}
        </div>
      </div>

      <div className="kukui-iv__volume">
        <button
          type="button"
          className="kukui-iv__ctl-btn"
          onClick={onToggleMute}
          disabled={disabled}
          aria-label={muted || volume === 0 ? "Unmute" : "Mute"}
        >
          {muted || volume === 0 ? <MuteIcon /> : <VolumeIcon />}
        </button>
        <input
          type="range"
          className="kukui-iv__volume-input"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          disabled={disabled}
          aria-label="Volume"
          onChange={(e) => onSetVolume(Number(e.target.value))}
        />
      </div>

      <label className="kukui-iv__rate">
        <span className="kukui-iv__sr-only">Playback speed</span>
        <select
          className="kukui-iv__rate-select"
          value={rate}
          disabled={disabled}
          onChange={(e) => onSetRate(Number(e.target.value))}
        >
          {rates.map((r) => (
            <option key={r} value={r}>
              {r}×
            </option>
          ))}
        </select>
      </label>

      {onToggleCaptions ? (
        <button
          type="button"
          className={`kukui-iv__ctl-btn${captionsOn ? " is-active" : ""}`}
          onClick={onToggleCaptions}
          disabled={disabled}
          aria-pressed={!!captionsOn}
          aria-label="Captions"
        >
          <span className="kukui-iv__cc">CC</span>
        </button>
      ) : null}

      {chapters && chapters.length > 0 ? (
        <label className="kukui-iv__rate">
          <span className="kukui-iv__sr-only">Jump to chapter</span>
          <select
            className="kukui-iv__rate-select"
            value=""
            disabled={disabled}
            aria-label="Jump to chapter"
            onChange={(e) => {
              const ch = chapters.find((c) => c.id === e.target.value);
              if (ch) onSeek(ch.atSeconds);
              e.target.value = "";
            }}
          >
            <option value="" disabled>
              Chapters
            </option>
            {chapters.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {formatTime(ch.atSeconds)} {ch.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <button
        type="button"
        className="kukui-iv__ctl-btn"
        onClick={onFullscreen}
        disabled={disabled}
        aria-label="Fullscreen"
      >
        <FullscreenIcon />
      </button>
    </div>
  );
}

/* Inline control icons (currentColor). */
function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}
function VolumeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M4 9v6h4l5 5V4L8 9H4zm12 3a4 4 0 0 0-2-3.5v7A4 4 0 0 0 16 12z" />
    </svg>
  );
}
function MuteIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M4 9v6h4l5 5V4L8 9H4zm15.5 3 2-2-1.4-1.4-2 2-2-2L14.7 10l2 2-2 2 1.4 1.4 2-2 2 2 1.4-1.4-2-2z" />
    </svg>
  );
}
function FullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" />
    </svg>
  );
}
