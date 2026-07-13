import { Link } from "react-router-dom";

export function AboutPane() {
  return (
    <div className="ks-settings-pane ks-settings-pane--prose">
      <p>
        <strong>Kukui Studio</strong> is an open-source toolkit for building
        interactive learning activities that drop directly into any
        SCORM-compatible LMS.
      </p>
      <p>
        Open-source, MIT-licensed, no telemetry. Fork the repo and host your
        own instance on GitHub Pages in about five minutes. See the{" "}
        <Link to="/docs/self-hosting">self-hosting guide</Link>.
      </p>
      <ul className="ks-settings-pane__links">
        <li>
          <Link to="/docs">Documentation</Link>
        </li>
        <li>
          <Link to="/blog">Blog</Link>
        </li>
        <li>
          <a
            href="https://github.com/UHMed-OME/kukui-studio"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub repository
          </a>
        </li>
        <li>
          <a
            href="https://github.com/UHMed-OME/kukui-studio/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
          >
            MIT License
          </a>
        </li>
        <li>
          <a
            href="https://github.com/UHMed-OME/kukui-studio/issues"
            target="_blank"
            rel="noopener noreferrer"
          >
            Report an issue
          </a>
        </li>
      </ul>
    </div>
  );
}
