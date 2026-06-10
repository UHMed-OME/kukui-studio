/**
 * @kukui/embed — a `<kukui-activity>` custom element for dropping a Kukui
 * activity onto any web page with one tag.
 *
 * It wraps a *hosted web package* (the non-LMS "web" target — see
 * docs/host-on-the-web.md) in a lazy, responsive iframe so the activity
 * keeps its own origin (and therefore its own localStorage persistence +
 * completion panel). This iframe approach is deliberately decoupled from
 * the engine's React/Tailwind bundle: the element stays a few KB of
 * dependency-free DOM code that works on any site and CDN, while the
 * activity itself is served from wherever the author hosts the package.
 *
 * Sandbox caveat: the iframe ships `sandbox="allow-scripts allow-same-origin
 * …"`, and that combination is a no-op as an isolation boundary when the
 * package is hosted on the SAME origin as the embedding page — a same-origin
 * sandboxed document with both flags can reach the parent and remove its own
 * sandbox. Host the package on a separate origin (e.g. a dedicated
 * subdomain) if you want real isolation from the host page; the element
 * relies on the browser's cross-origin boundary, not the sandbox, for that.
 *
 * Usage:
 *   <script type="module" src="https://cdn.example.com/kukui-embed.js"></script>
 *   <kukui-activity src="https://my-host.example.com/kukui-multiple-choice/"></kukui-activity>
 *
 * Attributes:
 *   src     (required) URL of a hosted package's index.html (or its folder).
 *   height  iframe height in px (default 640).
 *   title   accessible iframe title (default "Kukui activity").
 *   allow   feature-policy passthrough, e.g. "camera; microphone" for the
 *           Audio Recording / Video Reflection activities.
 *   eager   present → mount immediately instead of lazily on scroll.
 *
 * The element listens for `{ type: "kukui:resize", height }` postMessages from
 * the framed activity and grows to fit when one arrives — harmless today (the
 * engine doesn't send them yet), future-proofing auto-height.
 */

const TAG = "kukui-activity";
const DEFAULT_HEIGHT = 640;
const MAX_RESIZE_HEIGHT = 10000;
const RESIZE_MESSAGE = "kukui:resize";

/** Resolve src against the page URL; only http(s) packages are embeddable. */
function resolveSrc(raw: string): URL | null {
  try {
    const url = new URL(raw, location.href);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export class KukuiActivityElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ["src", "height", "title", "allow"];
  }

  private iframe: HTMLIFrameElement | null = null;
  private observer: IntersectionObserver | null = null;
  // Origin of the resolved src, captured when the iframe (re)loads a URL —
  // kukui:resize messages must come from this origin to be honoured.
  private expectedOrigin: string | null = null;
  private onMessage = (event: MessageEvent) => this.handleResizeMessage(event);

  connectedCallback() {
    this.style.display = this.style.display || "block";
    window.addEventListener("message", this.onMessage);
    if (this.hasAttribute("eager") || typeof IntersectionObserver === "undefined") {
      this.mount();
    } else {
      this.observeViewport();
    }
  }

  disconnectedCallback() {
    window.removeEventListener("message", this.onMessage);
    this.observer?.disconnect();
    this.observer = null;
  }

  attributeChangedCallback(name: string) {
    // Re-render in place if attributes change after the iframe exists.
    if (this.iframe) {
      this.applyAttributes(this.iframe);
    } else if (name === "src" && this.isConnected && !this.observer) {
      // An earlier eager mount failed (missing/invalid src) — clear the
      // error content and retry now that src has been provided.
      this.textContent = "";
      this.mount();
    }
  }

  private observeViewport() {
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.observer?.disconnect();
            this.observer = null;
            this.mount();
            break;
          }
        }
      },
      { rootMargin: "200px" },
    );
    this.observer.observe(this);
  }

  private mount() {
    if (this.iframe) return;
    const src = this.getAttribute("src");
    if (!src) {
      this.renderError("kukui-activity: missing required \"src\" attribute.");
      return;
    }
    if (!resolveSrc(src)) {
      this.renderError(
        `kukui-activity: "src" must be an http(s) URL, got "${src}".`,
      );
      return;
    }
    const iframe = document.createElement("iframe");
    iframe.style.width = "100%";
    iframe.style.border = "0";
    iframe.loading = "lazy";
    // allow-same-origin keeps the framed activity on its own origin so its
    // localStorage (resume + completion panel) works; allow-scripts runs it.
    // NOTE: together these flags neutralise the sandbox as an isolation
    // boundary if the package is hosted on the same origin as the host page
    // — see the module docstring; host on a separate origin for isolation.
    iframe.setAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-popups allow-forms allow-downloads",
    );
    this.applyAttributes(iframe);
    this.appendChild(iframe);
    this.iframe = iframe;
  }

  private applyAttributes(iframe: HTMLIFrameElement) {
    const src = this.getAttribute("src");
    const resolved = src ? resolveSrc(src) : null;
    // Only (re)assign src when the resolved URL actually changed — assigning
    // the same value would force-reload the activity on every unrelated
    // attribute change. Non-http(s) values are ignored here (mount() already
    // surfaces the error for the initial render).
    if (resolved) {
      this.expectedOrigin = resolved.origin;
      if (iframe.src !== resolved.href) iframe.src = resolved.href;
    }
    iframe.title = this.getAttribute("title") || "Kukui activity";
    iframe.style.height = `${this.resolveHeight()}px`;
    const allow = this.getAttribute("allow");
    if (allow) iframe.setAttribute("allow", allow);
    else iframe.removeAttribute("allow");
  }

  private resolveHeight(): number {
    const raw = Number.parseInt(this.getAttribute("height") ?? "", 10);
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_HEIGHT;
  }

  private handleResizeMessage(event: MessageEvent) {
    if (!this.iframe || event.source !== this.iframe.contentWindow) return;
    // Require the message to come from the origin we navigated to — a
    // matching source alone isn't enough if the frame was navigated away.
    if (!this.expectedOrigin || event.origin !== this.expectedOrigin) return;
    const data = event.data as { type?: unknown; height?: unknown } | null;
    if (!data || data.type !== RESIZE_MESSAGE) return;
    const height = Number(data.height);
    if (Number.isFinite(height) && height > 0) {
      this.iframe.style.height = `${Math.min(height, MAX_RESIZE_HEIGHT)}px`;
    }
  }

  private renderError(message: string) {
    this.textContent = message;
    // Surface to developers without throwing — a broken tag shouldn't take
    // down the host page.
    if (typeof console !== "undefined") console.error(message);
  }
}

/** Register the element once. Safe to import more than once. */
export function defineKukuiActivity(): void {
  if (typeof customElements === "undefined") return;
  if (!customElements.get(TAG)) {
    customElements.define(TAG, KukuiActivityElement);
  }
}

// Auto-register on import so a plain <script type="module" src> just works.
defineKukuiActivity();
