import { useEffect, useRef } from "react";
import type { MediaState, VideoController } from "./media.js";

export type { VideoController } from "./media.js";

// Minimal shape of the YouTube IFrame API we use (no @types/youtube dep).
type YTPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  setVolume: (v: number) => void;
  getVolume: () => number;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  setPlaybackRate: (r: number) => void;
  getPlaybackRate: () => number;
  destroy: () => void;
};
type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      host?: string;
      playerVars?: Record<string, number>;
      events?: {
        onReady?: () => void;
        onStateChange?: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
  PlayerState: { ENDED: number; PLAYING: number };
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** Extract the 11-char video id from watch / youtu.be / embed URLs. */
export function parseYouTubeId(src: string): string | null {
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

let apiPromise: Promise<YTNamespace> | null = null;

function loadYouTubeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("no document"));
  }
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YTNamespace>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT) resolve(window.YT);
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return apiPromise;
}

/**
 * Renders a YouTube player (privacy `youtube-nocookie` host, no native chrome)
 * and drives the interactive-video player: registers a full VideoController and
 * polls a MediaState snapshot ~5×/s (YT has no timeupdate). Stale-closure safe.
 */
export function YouTubeStage({
  src,
  className,
  onController,
  onState,
  onTick,
  onEnded,
}: {
  src: string;
  className?: string;
  onController: (c: VideoController | null) => void;
  onState: (s: MediaState) => void;
  onTick: (seconds: number) => void;
  onEnded: () => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onTickRef = useRef(onTick);
  const onEndedRef = useRef(onEnded);
  const onStateRef = useRef(onState);
  onTickRef.current = onTick;
  onEndedRef.current = onEnded;
  onStateRef.current = onState;

  useEffect(() => {
    const videoId = parseYouTubeId(src);
    if (!videoId || !hostRef.current) return;
    let cancelled = false;
    let player: YTPlayer | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !hostRef.current) return;
        player = new YT.Player(hostRef.current, {
          videoId,
          host: "https://www.youtube-nocookie.com",
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1, controls: 0 },
          events: {
            onReady: () => {
              onController({
                play: () => player?.playVideo(),
                pause: () => player?.pauseVideo(),
                seek: (s) => player?.seekTo(s, true),
                setVolume: (v) => player?.setVolume(Math.round(v * 100)),
                setMuted: (m) => (m ? player?.mute() : player?.unMute()),
                setRate: (r) => player?.setPlaybackRate(r),
              });
              poll = setInterval(() => {
                if (!player || typeof player.getCurrentTime !== "function") return;
                const t = player.getCurrentTime();
                const dur = player.getDuration();
                onStateRef.current({
                  currentTime: t,
                  duration: dur,
                  paused: player.getPlayerState() !== YT.PlayerState.PLAYING,
                  volume: (player.getVolume?.() ?? 100) / 100,
                  muted: player.isMuted?.() ?? false,
                  rate: player.getPlaybackRate?.() ?? 1,
                  ready: dur > 0,
                });
                onTickRef.current(t);
              }, 200);
            },
            onStateChange: (e) => {
              if (e.data === YT.PlayerState.ENDED) onEndedRef.current();
            },
          },
        });
      })
      .catch(() => {
        /* API blocked/offline — leave host empty. */
      });

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      onController(null);
      try {
        player?.destroy();
      } catch {
        /* noop */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return <div ref={hostRef} className={className} data-testid="kukui-iv-youtube" />;
}
