import { useEffect, useRef } from "react";

/**
 * Minimal controller the checkpoint logic drives, regardless of backend
 * (native <video> or the YouTube IFrame player).
 */
export type VideoController = {
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
};

// Minimal shape of the YouTube IFrame API we use (no @types/youtube dep).
type YTPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
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
  PlayerState: { ENDED: number };
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
    // Bare id fallback.
    return /^[\w-]{6,}$/.test(src) ? src : null;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

/** Load the IFrame Player API script once; resolve when window.YT is ready. */
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
 * Renders a YouTube player (privacy `youtube-nocookie` host) and drives the
 * interactive-video checkpoint logic: it registers a VideoController, polls
 * currentTime (~4×/s, since YT has no timeupdate event), and reports ENDED.
 * Stale-closure safe — the poll calls the latest onTick via a ref.
 */
export function YouTubeStage({
  src,
  className,
  onController,
  onTick,
  onEnded,
}: {
  src: string;
  className?: string;
  onController: (c: VideoController | null) => void;
  onTick: (seconds: number) => void;
  onEnded: () => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onTickRef = useRef(onTick);
  const onEndedRef = useRef(onEnded);
  onTickRef.current = onTick;
  onEndedRef.current = onEnded;

  useEffect(() => {
    const videoId = parseYouTubeId(src);
    const host = hostRef.current;
    if (!videoId || !host) return;
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
              onController({
                play: () => player?.playVideo(),
                pause: () => player?.pauseVideo(),
                seek: (s) => player?.seekTo(s, true),
              });
              poll = setInterval(() => {
                if (player && typeof player.getCurrentTime === "function") {
                  onTickRef.current(player.getCurrentTime());
                }
              }, 250);
            },
            onStateChange: (e) => {
              if (e.data === YT.PlayerState.ENDED) onEndedRef.current();
            },
          },
        });
      })
      .catch(() => {
        /* API failed to load (offline / blocked) — leave the host empty. */
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
