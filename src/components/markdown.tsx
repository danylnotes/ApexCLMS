import { Fragment, type ReactNode } from "react";

/**
 * Minimal, safe Markdown renderer for lesson content (headings, paragraphs, lists, bold, italics).
 * Produces React elements only — no HTML injection — so all content is output-encoded.
 */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    out.push(t.startsWith("**") ? <strong key={i++}>{t.slice(2, -2)}</strong> : <em key={i++}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block = { kind: "h2" | "h3" | "p"; text: string[] } | { kind: "ul" | "ol"; items: string[] };

function parse(source: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: "p", text: para });
    para = [];
  };
  for (const raw of source.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    const last = blocks[blocks.length - 1];
    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith("### ") || line.startsWith("## ")) {
      flush();
      blocks.push({ kind: line.startsWith("### ") ? "h3" : "h2", text: [line.replace(/^#+ /, "")] });
      continue;
    }
    const ul = /^[-*] (.*)$/.exec(line);
    const ol = /^\d+\. (.*)$/.exec(line);
    if (ul || ol) {
      flush();
      const kind = ul ? "ul" : "ol";
      // Consecutive list items merge even across blank lines.
      if (last && last.kind === kind) last.items.push((ul ?? ol)![1]);
      else blocks.push({ kind, items: [(ul ?? ol)![1]] });
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks;
}

export function Markdown({ source, className = "prose-lesson" }: { source: string; className?: string }) {
  return (
    <div className={className}>
      {parse(source).map((b, i) => {
        if (b.kind === "ul") return <ul key={i}>{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ul>;
        if (b.kind === "ol") return <ol key={i}>{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ol>;
        if (b.kind === "h2") return <h2 key={i}>{inline(b.text[0])}</h2>;
        if (b.kind === "h3") return <h3 key={i}>{inline(b.text[0])}</h3>;
        if (b.kind !== "p") return null;
        return <p key={i}>{b.text.map((l: string, j: number) => <Fragment key={j}>{j > 0 && <br />}{inline(l)}</Fragment>)}</p>;
      })}
    </div>
  );
}
