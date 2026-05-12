export function PrivacyPane() {
  return (
    <div className="ks-settings-pane ks-settings-pane--prose">
      <p>
        Kukui Studio runs entirely in your browser. Drafts auto-save to your
        local browser storage (<code>localStorage</code>) and never leave your
        device. We don't operate any backend, don't set analytics cookies, and
        don't transmit form data anywhere.
      </p>
      <p>
        When you click <strong>Download</strong>, the SCORM zip is generated
        client-side; what happens after upload is between you and your LMS.
        SCORM activities packaged by Studio post grades only to the LMS that
        hosts them (Brightspace, Canvas, Moodle, etc.) — the same channel any
        LMS-hosted activity uses.
      </p>
      <p>
        If you enable <strong>AI Assist</strong>, requests go directly from
        your browser to whatever LLM endpoint you configured (OpenAI, Groq,
        your institution's internal proxy, etc.). Kukui Studio never sees or
        proxies the request. Your API key and base URL are stored in your
        browser only (<code>localStorage</code> or <code>sessionStorage</code>{" "}
        — your choice on the AI Assist tab).
      </p>
      <p>
        The activity JSON you're working on, plus your prompt, are sent to the
        endpoint you picked; the response comes back to your browser only.
        Your provider's data-handling policies apply to that traffic — pick a
        provider whose policies match your institution's rules.
      </p>
    </div>
  );
}
