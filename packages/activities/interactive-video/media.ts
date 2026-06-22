/** Reactive snapshot of the active video backend (html5 <video> or YouTube). */
export type MediaState = {
  currentTime: number;
  duration: number;
  paused: boolean;
  /** 0..1 */
  volume: number;
  muted: boolean;
  /** Playback rate, e.g. 1. */
  rate: number;
  /** True once duration is known. */
  ready: boolean;
};

export const INITIAL_MEDIA: MediaState = {
  currentTime: 0,
  duration: 0,
  paused: true,
  volume: 1,
  muted: false,
  rate: 1,
  ready: false,
};

/** Backend-agnostic control surface the player UI drives. */
export type VideoController = {
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  /** @param v 0..1 */
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  setRate: (r: number) => void;
};

/** Format seconds as m:ss (or h:mm:ss). */
export function formatTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const total = Math.floor(s);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
