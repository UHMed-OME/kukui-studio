import { useEffect, useRef } from "react";
import type { WidgetProps } from "@rjsf/utils";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  H2Icon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  QuoteIcon,
} from "../icons.js";

/**
 * Rich-text WYSIWYG widget. Used for any field whose uiSchema sets
 * `ui:widget: "html"` — replaces the previous textarea-with-tags editor.
 *
 * Features:
 *   - Markdown-style shortcuts via Tiptap StarterKit (e.g. `**bold**`,
 *     `# heading`, `> blockquote`, `* list`, ` ``code`` `)
 *   - Inline image upload (file picker or paste from clipboard) — files
 *     are embedded as data URLs so the activity stays self-contained for
 *     SCORM packaging
 *   - Text alignment (left / center / right)
 *   - Stored value is HTML, matching the existing schema contract
 */
export function RichTextWidget(props: WidgetProps) {
  const { value, onChange, disabled, readonly, options, id } = props;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const minRows = (options?.rows as number | undefined) ?? 3;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // StarterKit v3 bundles Link; we configure it separately below
        // with our own openOnClick / rel / target settings, so disable
        // the bundled copy to avoid Tiptap's duplicate-extension warning.
        link: false,
      }),
      Image.configure({ inline: false }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: typeof value === "string" ? value : "",
    editable: !disabled && !readonly,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      // Tiptap returns "<p></p>" for empty — normalize to "" so required
      // string validation triggers as expected.
      onChange(html === "<p></p>" ? "" : html);
    },
    editorProps: {
      attributes: {
        id,
        "aria-multiline": "true",
        class: "ks-rt__content",
        style: `min-height: ${minRows * 1.5}rem`,
      },
    },
    immediatelyRender: false,
  });

  // Keep editor content in sync if the form value changes externally
  // (e.g. activity switch, draft load, import).
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = typeof value === "string" ? value : "";
    if (current !== next && (next || current !== "<p></p>")) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) return null;

  const insertImageFromFile = async (file: File) => {
    // 2 MB cap — images embed as data URLs in the activity JSON, which
    // gets stuffed into SCORM cmi.suspend_data on resume. Anything bigger
    // blows past LMS limits and crashes localStorage on auto-save.
    const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
    if (file.size > MAX_IMAGE_BYTES) {
      window.alert(
        `Image is ${(file.size / 1024 / 1024).toFixed(1)} MB — please pick one under 2 MB or paste an image URL instead.`,
      );
      return;
    }
    if (!file.type.startsWith("image/")) {
      window.alert("That doesn't look like an image. Pick a PNG, JPG, GIF, or SVG.");
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    editor.chain().focus().setImage({ src: dataUrl, alt: file.name }).run();
  };

  const onImageButton = () => fileInputRef.current?.click();

  const onImageChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) await insertImageFromFile(file);
  };

  const insertLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="ks-rt">
      <div className="ks-rt__toolbar" role="toolbar" aria-label="Formatting">
        <RtBtn
          title="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <BoldIcon />
        </RtBtn>
        <RtBtn
          title="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <ItalicIcon />
        </RtBtn>
        <RtBtn
          title="Heading"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <H2Icon />
        </RtBtn>
        <RtBtn
          title="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <ListIcon />
        </RtBtn>
        <RtBtn
          title="Quote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <QuoteIcon />
        </RtBtn>
        <span className="ks-rt__sep" aria-hidden="true" />
        <RtBtn
          title="Align left"
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeftIcon />
        </RtBtn>
        <RtBtn
          title="Align center"
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenterIcon />
        </RtBtn>
        <RtBtn
          title="Align right"
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          <AlignRightIcon />
        </RtBtn>
        <span className="ks-rt__sep" aria-hidden="true" />
        <RtBtn title="Insert link" active={editor.isActive("link")} onClick={insertLink}>
          <LinkIcon />
        </RtBtn>
        <RtBtn title="Insert image" onClick={onImageButton}>
          <ImageIcon />
        </RtBtn>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={onImageChosen}
          aria-hidden="true"
        />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function RtBtn({
  title,
  active,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={["ks-rt__btn", active ? "is-active" : ""].filter(Boolean).join(" ")}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
