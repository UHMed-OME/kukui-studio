import { LandingTopNav } from "./shared/LandingTopNav.js";
import "./docs/Docs.css";

/**
 * Standalone Privacy & data page. The body used to live as a pane
 * inside the multi-pane Settings dialog; once the prose grew past a
 * paragraph or two it felt cramped in the modal's narrow column.
 * Moving it to its own route lets the text breathe at the docs-page
 * column width (~720 px) and gives us a stable URL to link from
 * institutional procurement reviews + the footer.
 *
 * The page reuses `kukui-docs` layout classes (and so reuses Docs.css)
 * because the visual treatment for "policy prose" is the same
 * treatment we use for documentation prose — a single source of truth
 * here means typography stays consistent across both surfaces.
 */
export function Privacy() {
  return (
    <div className="kukui-docs">
      <LandingTopNav />
      <main className="kukui-docs__main kukui-docs__main--single">
        <article className="kukui-docs__content kukui-docs__content--single">
          <header>
            <h1>Privacy &amp; data</h1>
            <p className="kukui-docs__lede">
              Where your authoring data, your AI requests, and your students' SCORM grades
              actually go. Short version: none of it touches a Kukui-operated server.
            </p>
          </header>

          <h2>Authoring (Kukui Studio)</h2>
          <p>
            Kukui Studio runs entirely in your browser. Drafts auto-save to your local
            browser storage (<code>localStorage</code>) and never leave your device. We
            don't operate any backend, don't set analytics cookies, and don't transmit
            form data anywhere.
          </p>
          <p>
            When you click <strong>Download</strong>, the SCORM zip is generated
            client-side; what happens after upload is between you and your LMS.
          </p>

          <h2>Learner grades (SCORM passback)</h2>
          <p>
            SCORM activities packaged by Studio post grades only to the LMS that hosts
            them (Brightspace, Canvas, Moodle, etc.) — the same channel any
            LMS-hosted activity uses. Kukui Studio is not a party to that traffic.
          </p>

          <h2>AI Assist (optional)</h2>
          <p>
            If you enable <strong>AI Assist</strong>, requests go directly from your
            browser to whatever LLM endpoint you configured (OpenAI, Groq, your
            institution's internal proxy, etc.). Kukui Studio never sees or proxies the
            request. Your API key and base URL are stored in your browser only
            (<code>localStorage</code> or <code>sessionStorage</code> — your choice on the
            AI Assist tab).
          </p>
          <p>
            The activity JSON you're working on, plus your prompt, are sent to the
            endpoint you picked; the response comes back to your browser only. Your
            provider's data-handling policies apply to that traffic — pick a provider
            whose policies match your institution's rules.
          </p>

          <h2>Live mode (peer-to-peer)</h2>
          <p>
            When you run a Live activity (Straw Poll, Confidence Meter, Word Cloud, Q&amp;A
            Board, Quick Quiz), peers discover each other through public Nostr relays
            (default) or MQTT brokers, then exchange data directly via WebRTC. The relays
            see the room hash and ICE candidates needed to set up the connection; the
            activity content itself flows peer-to-peer and never reaches a relay.
          </p>
          <p>
            Display names broadcast in presence are visible to every peer in the same
            room. Live mode generates an ephemeral handle (e.g. <code>Guest-A37</code>)
            so a real student name never touches the relay.
          </p>

          <h2>Summary</h2>
          <ul>
            <li>
              <strong>No Kukui backend.</strong> Authoring drafts, AI keys, and live
              session state stay in your browser or flow peer-to-peer.
            </li>
            <li>
              <strong>Your LMS handles grades.</strong> SCORM passback uses the LMS's own
              channel.
            </li>
            <li>
              <strong>AI traffic goes where you point it.</strong> Pick a provider whose
              policies match your institution's rules.
            </li>
          </ul>
        </article>
      </main>
    </div>
  );
}
