/**
 * Turn raw Zod validation issues into plain English an author can act on.
 *
 * Two outputs, used by both validation surfaces:
 *   - humanizeMessage(issue) — the "what's wrong" sentence (no jargon, no
 *     JSON paths). Drives the inline field error and the popover message.
 *   - humanizeFieldLabel(path) — a friendly breadcrumb ("Interaction 1 →
 *     Answer 2 → Option text") for the popover, instead of "interactions.0…".
 *
 * Typed loosely on purpose: Zod's issue union shifts between minor versions
 * and we read a handful of optional fields defensively, falling back to a
 * tidied version of the original message when a code is unfamiliar.
 */

type LooseIssue = {
  code?: string;
  message: string;
  expected?: string;
  received?: string;
  minimum?: number | bigint;
  maximum?: number | bigint;
  origin?: string;
  type?: string;
  format?: string;
  validation?: string;
  values?: unknown[];
  options?: unknown[];
  keys?: string[];
  input?: unknown;
  path?: ReadonlyArray<PropertyKey>;
};

function typeWord(t: string | undefined): string {
  switch (t) {
    case "string":
      return "text";
    case "number":
    case "integer":
    case "bigint":
      return "a number";
    case "boolean":
      return "a yes/no value";
    case "array":
      return "a list";
    case "object":
      return "a set of fields";
    default:
      return "a valid value";
  }
}

function cleanupRaw(message: string): string {
  const m = message.trim();
  if (/^required$/i.test(m)) return "This is required.";
  if (/invalid url/i.test(m)) return "Enter a valid URL (starting with https://).";
  if (/invalid email/i.test(m)) return "Enter a valid email address.";
  const sentence = m.charAt(0).toUpperCase() + m.slice(1);
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

export function humanizeMessage(issue: LooseIssue): string {
  const i = issue;
  const min = typeof i.minimum === "bigint" ? Number(i.minimum) : i.minimum;
  const max = typeof i.maximum === "bigint" ? Number(i.maximum) : i.maximum;
  const origin = i.origin ?? i.type;

  switch (i.code) {
    case "invalid_type": {
      const missing =
        i.received === "undefined" ||
        i.received === "null" ||
        i.input === undefined ||
        i.input === null ||
        /received (undefined|null|nan)/i.test(i.message);
      return missing ? "This is required." : `Should be ${typeWord(i.expected)}.`;
    }
    case "too_small": {
      if (origin === "string")
        return min === 1 ? "This can’t be empty." : `Use at least ${min} characters.`;
      if (origin === "array")
        return min === 1 ? "Add at least one." : `Add at least ${min}.`;
      if (origin === "number" || origin === "int" || origin === "bigint")
        return `Must be ${min} or more.`;
      return `Too small. Minimum is ${min}.`;
    }
    case "too_big": {
      if (origin === "string") return `Keep it to ${max} characters or fewer.`;
      if (origin === "array") return `Use at most ${max}.`;
      if (origin === "number" || origin === "int" || origin === "bigint")
        return `Must be ${max} or less.`;
      return `Too large. Maximum is ${max}.`;
    }
    case "invalid_string":
    case "invalid_format": {
      const fmt = i.format ?? i.validation;
      if (fmt === "url") return "Enter a valid URL (starting with https://).";
      if (fmt === "email") return "Enter a valid email address.";
      if (fmt === "uuid" || fmt === "cuid") return "Enter a valid ID.";
      return "This isn’t in the expected format.";
    }
    case "invalid_enum_value":
    case "invalid_value":
    case "invalid_literal": {
      const opts = (i.values ?? i.options) as unknown[] | undefined;
      if (Array.isArray(opts) && opts.length) {
        return `Choose one of: ${opts.map((v) => String(v)).join(", ")}.`;
      }
      return "Choose a valid option.";
    }
    case "unrecognized_keys": {
      const keys = i.keys;
      if (Array.isArray(keys) && keys.length) {
        return `Unexpected field${keys.length > 1 ? "s" : ""}: ${keys.join(", ")}.`;
      }
      return "There’s an unexpected field here.";
    }
    case "invalid_union":
      return "This doesn’t match any of the allowed options.";
    case "not_multiple_of":
      return "This value isn’t allowed at that precision.";
    default:
      return cleanupRaw(i.message);
  }
}

// Friendly names for the keys that show up in activity configs. Anything not
// listed falls back to a de-camelCased Title Case version of the key.
const KEY_LABELS: Record<string, string> = {
  atSeconds: "Time",
  src: "URL",
  url: "URL",
  video: "Video",
  poster: "Poster image",
  interactions: "Interaction",
  answers: "Answer",
  question: "Question",
  prompt: "Prompt",
  title: "Title",
  author: "Author",
  text: "Option text",
  correct: "Correct answer",
  feedback: "Feedback",
  kind: "Type",
  required: "Required",
  config: "Content",
  blanks: "Blank",
  alt: "Alt text",
  image: "Image",
  hotspots: "Hotspot",
  dropZones: "Drop zone",
  draggables: "Draggable",
  label: "Label",
  nodes: "Node",
  edges: "Connection",
  cards: "Card",
  items: "Item",
  options: "Option",
};

function labelForKey(key: string): string {
  if (KEY_LABELS[key]) return KEY_LABELS[key];
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function humanizeFieldLabel(path: ReadonlyArray<PropertyKey>): string {
  if (!path.length) return "Whole activity";
  const parts: string[] = [];
  for (const seg of path) {
    if (typeof seg === "number") {
      // An array index labels the thing it indexes: "Interaction" + 0 → "Interaction 1".
      const prev = parts.pop() ?? "Item";
      parts.push(`${prev} ${seg + 1}`);
    } else {
      parts.push(labelForKey(String(seg)));
    }
  }
  return parts.join(" → ");
}
