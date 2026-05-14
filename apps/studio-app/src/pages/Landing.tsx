import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ActivityKind } from "@kukui/core";
import { ActivityIcon } from "../activityIcons.js";
import { ACTIVITY_LABELS } from "../starters.js";
import { DownloadIcon, PlayIcon } from "../icons.js";
import { LandingTopNav } from "./shared/LandingTopNav.js";
import { BrandWordmark } from "./shared/BrandWordmark.js";
import "./Landing.css";

const SHOWCASE: ReadonlyArray<{ kind: ActivityKind; blurb: string }> = [
  { kind: "flashcards", blurb: "Self-paced card decks with mastery tracking." },
  { kind: "crossword", blurb: "Term/definition pairs become a generated grid." },
  { kind: "hotspot-2d", blurb: "Pick the right region of an image." },
  { kind: "drag-and-drop", blurb: "Place labels onto zones on a background." },
  { kind: "anatomy-labeling", blurb: "Drag named labels onto diagram targets." },
  { kind: "osce", blurb: "Multi-phase clinical encounter with scored actions." },
];

const VALUE_PROPS = [
  {
    title: "Works in your browser",
    body: "No account to create, no server to log into. Your work stays in your browser unless you choose to export it.",
  },
  {
    title: "AI-assisted authoring",
    body: "Describe what you want in plain English and let AI draft the activity for you. Bring your own API key — no Studio account needed.",
  },
  {
    title: "Accessible by default",
    body: "Every activity ships with keyboard support, screen-reader labels, and respects motion preferences out of the box.",
  },
  {
    title: "Drops into any LMS",
    body: "Download your activity and upload it to your course. Grades flow back to the gradebook automatically. Works with Brightspace, Canvas, Moodle, and more.",
  },
  {
    title: "Free and open",
    body: "Open-source and free to use. No per-seat license, no subscription. Host your own instance for your institution if you want.",
  },
];

const HOW_IT_WORKS = [
  {
    n: 1,
    title: "Pick an activity",
    body: "Browse 24 types organized by Bloom's taxonomy.",
  },
  {
    n: 2,
    title: "Author content",
    body: "Fill the form, or describe what you want in plain English and let AI draft it.",
  },
  {
    n: 3,
    title: "Download a SCORM zip",
    body: "One click; the activity is packaged with everything it needs.",
  },
  {
    n: 4,
    title: "Upload to your LMS",
    body: "Drop the zip into a course module. Grades report automatically.",
  },
];

export function Landing() {
  return (
    <div className="kukui-landing">
      <LandingTopNav />

      <section className="kukui-landing__hero">
        <div className="kukui-landing__hero-text">
          <p className="kukui-landing__eyebrow">Kukui Studio</p>
          <h1 className="kukui-landing__headline">
            Interactive learning activities for any LMS.
          </h1>
          <p className="kukui-landing__lede">
            Build interactive lessons in your browser and drop them into any
            course. Made for online learning. Free and open-source.
          </p>
          <div className="kukui-landing__hero-ctas">
            <Link to="/studio" className="kukui-landing__cta-primary">
              <PlayIcon />
              <span>Open Studio</span>
            </Link>
            <Link to="/docs/getting-started" className="kukui-landing__cta-secondary">
              Read the docs
            </Link>
          </div>
        </div>
        <div className="kukui-landing__hero-visual" aria-hidden="true">
          <HeroFlashcard />
        </div>
      </section>

      <section className="kukui-landing__props" aria-labelledby="why-kukui">
        <h2 id="why-kukui" className="kukui-landing__section-title">
          Why Kukui
        </h2>
        <ul className="kukui-landing__props-grid">
          {VALUE_PROPS.map((prop) => (
            <li key={prop.title} className="kukui-landing__prop">
              <h3 className="kukui-landing__prop-title">{prop.title}</h3>
              <p className="kukui-landing__prop-body">{prop.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="kukui-landing__catalog" aria-labelledby="catalog">
        <h2 id="catalog" className="kukui-landing__section-title">
          24 activity types, ready to author
        </h2>
        <p className="kukui-landing__section-lede">
          Organized by Bloom's revised taxonomy — pick the cognitive level you want
          to exercise, fill in the content, ship.
        </p>
        <ul className="kukui-landing__catalog-grid">
          {SHOWCASE.map(({ kind, blurb }) => (
            <li key={kind} className="kukui-landing__catalog-card">
              <ActivityIcon
                kind={kind}
                className="kukui-landing__catalog-icon"
              />
              <h3 className="kukui-landing__catalog-name">{ACTIVITY_LABELS[kind]}</h3>
              <p className="kukui-landing__catalog-blurb">{blurb}</p>
            </li>
          ))}
        </ul>
        <p className="kukui-landing__catalog-more">
          <Link to="/docs/activity-guide">See all 24 activities →</Link>
        </p>
      </section>

      <section className="kukui-landing__how" aria-labelledby="how-it-works">
        <h2 id="how-it-works" className="kukui-landing__section-title">
          How it works
        </h2>
        <ol className="kukui-landing__how-grid">
          {HOW_IT_WORKS.map((step) => (
            <li key={step.n} className="kukui-landing__how-step">
              <span className="kukui-landing__how-num">{step.n}</span>
              <h3 className="kukui-landing__how-title">{step.title}</h3>
              <p className="kukui-landing__how-body">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="kukui-landing__dev" aria-labelledby="devs">
        <h2 id="devs" className="kukui-landing__section-title">
          For developers & institutions
        </h2>
        <div className="kukui-landing__dev-grid">
          <article>
            <h3>
              <DownloadIcon /> Self-host your own
            </h3>
            <p>
              Fork the repo, enable GitHub Pages, push to main. The workflow
              builds and deploys Studio + SCORM templates automatically.
            </p>
            <Link to="/docs/self-hosting">Self-hosting guide →</Link>
          </article>
          <article>
            <h3>
              <PlayIcon /> Contribute a new activity
            </h3>
            <p>
              Activity components live in <code>packages/core</code> with a Zod
              schema and a React component. New types ship in under a day.
            </p>
            <Link to="/docs/contributing">Contributing guide →</Link>
          </article>
        </div>
      </section>

      <footer className="kukui-landing__footer">
        <div className="kukui-landing__footer-top">
          <div className="kukui-landing__footer-brand">
            <BrandWordmark />
            <p
              className="kukui-landing__footer-pronounce"
              aria-label="pronounced koo-KOO-ee"
            >
              <em>Kukui</em> · /koo-KOO-ee/
            </p>
            <p className="kukui-landing__footer-blurb">
              Open interactive learning activities for any LMS.
            </p>
          </div>

          <div className="kukui-landing__footer-links">
            <section>
              <h3>Product</h3>
              <ul>
                <li>
                  <Link to="/studio">Open Studio</Link>
                </li>
                <li>
                  <Link to="/docs/activity-guide">Activity catalog</Link>
                </li>
                <li>
                  <Link to="/blog">Blog</Link>
                </li>
              </ul>
            </section>
            <section>
              <h3>Learn</h3>
              <ul>
                <li>
                  <Link to="/docs/getting-started">Getting started</Link>
                </li>
                <li>
                  <Link to="/docs/upload-to-lms">Upload to your LMS</Link>
                </li>
                <li>
                  <Link to="/docs/self-hosting">Self-hosting</Link>
                </li>
              </ul>
            </section>
            <section>
              <h3>Source</h3>
              <ul>
                <li>
                  <a
                    href="https://github.com/UHMed-OME/kukui-studio"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    GitHub
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
                    Issues
                  </a>
                </li>
              </ul>
            </section>
            <section>
              <h3>Support</h3>
              <ul>
                <li>
                  <a
                    href="https://give.uhfoundation.org/campaigns/67662/donations/new?utm_medium=redirect&utm_campaign=22MF7"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Donate via UH Foundation
                  </a>
                </li>
                <li className="kukui-landing__footer-note">
                  Gifts go to JABSOM's Office of Medical Education, which
                  builds and maintains Kukui.
                </li>
              </ul>
            </section>
          </div>
        </div>

        <div className="kukui-landing__footer-bottom">
          <p>© Kukui Studio · MIT-licensed open source</p>
          <p className="kukui-landing__footer-legal">
            <Link to="/privacy">Privacy &amp; data</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}

/**
 * Auto-flipping flashcard for the hero. Uses local state + a setInterval
 * so the front/back alternation works without dragging the full
 * Flashcards activity component in (which carries scoring, mastery,
 * keyboard handlers — overkill for a decorative preview).
 */
function HeroFlashcard() {
  const [side, setSide] = useState<"front" | "back">("front");
  useEffect(() => {
    const id = window.setInterval(() => {
      setSide((s) => (s === "front" ? "back" : "front"));
    }, 2800);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className={`kukui-landing__card kukui-landing__card--${side}`}>
      <div className="kukui-landing__card-face kukui-landing__card-face--front">
        <span className="kukui-landing__card-pill">Front</span>
        <p className="kukui-landing__card-text">
          What's the most common cause of a Type II MI?
        </p>
      </div>
      <div className="kukui-landing__card-face kukui-landing__card-face--back">
        <span className="kukui-landing__card-pill">Back</span>
        <p className="kukui-landing__card-text">
          Supply–demand mismatch — typically from another condition (sepsis,
          tachyarrhythmia, severe anemia) rather than a primary plaque rupture.
        </p>
      </div>
    </div>
  );
}
