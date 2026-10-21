import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { clientDictionary, serverDictionary } from "@/i18n/catalog";
import { format, translate } from "@/i18n/translate";
import { negotiate } from "@/i18n/config";

const SRC = path.resolve(__dirname, "../../src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) return p.includes(`${path.sep}i18n`) ? [] : files(p);
    return /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

/** Every literal passed to t("…") or tr("…") in the source, with whether it is in a client component. */
function usedKeys() {
  const out: { key: string; file: string; client: boolean }[] = [];
  for (const file of files(SRC)) {
    const src = readFileSync(file, "utf8");
    const client = src.startsWith('"use client"');
    for (const m of src.matchAll(/\b(?:t|tr)\(\s*"((?:[^"\\]|\\.)*)"/g)) out.push({ key: JSON.parse(`"${m[1]}"`), file: path.relative(SRC, file), client });
  }
  return out;
}

// Named placeholders ({name} or {count, plural, …}); plural branch bodies such as "one {course}" are not placeholders.
const placeholders = (s: string) => [...new Set([...s.matchAll(/(?<!(?:zero|one|two|few|many|other|=\d+)\s*)\{(\w+)[},]/g)].map((m) => m[1]))];

describe("translations", () => {
  const used = usedKeys();

  it("finds translatable strings in the source", () => {
    expect(used.length).toBeGreaterThan(50);
  });

  for (const locale of ["fr", "ar"] as const) {
    it(`has a ${locale} translation for every string`, () => {
      const missing = used.filter((u) => !(u.key in (u.client ? clientDictionary(locale) : serverDictionary(locale))));
      expect(missing.map((m) => `${m.file}: ${m.key}${m.client ? " (client)" : ""}`)).toEqual([]);
    });

    it(`keeps placeholders intact in ${locale}`, () => {
      const dict = serverDictionary(locale);
      const broken = Object.entries(dict).filter(([k, v]) => !placeholders(k).every((p) => v.includes(`{${p}`)));
      expect(broken.map(([k]) => k)).toEqual([]);
    });
  }

  it("interpolates and pluralises", () => {
    expect(format("Due {date}", "en", { date: "1 Nov" })).toBe("Due 1 Nov");
    expect(format("{count, plural, one {# course} other {# courses}}", "en", { count: 1 })).toBe("1 course");
    expect(format("{count, plural, one {# course} other {# courses}}", "en", { count: 3 })).toBe("3 courses");
    expect(format("{count, plural, zero {لا دورات} one {دورة واحدة} two {دورتان} few {# دورات} many {# دورة} other {# دورة}}", "ar", { count: 2 })).toBe("دورتان");
    expect(format("{count, plural, zero {لا دورات} one {دورة واحدة} two {دورتان} few {# دورات} many {# دورة} other {# دورة}}", "ar", { count: 5 })).toBe("5 دورات");
    expect(translate({}, "fr", "Untranslated text", undefined)).toBe("Untranslated text");
  });

  it("negotiates the browser language", () => {
    expect(negotiate("ar-IQ,ar;q=0.9,en;q=0.8")).toBe("ar");
    expect(negotiate("de-DE,fr;q=0.7")).toBe("fr");
    expect(negotiate("de-DE")).toBe("en");
    expect(negotiate(null)).toBe("en");
  });
});
