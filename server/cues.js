// Vocal cues: square-bracket tags like [laugh] or [whisper]…[/whisper] that the
// app translates into each provider's own syntax, the same way the pronunciation
// list is translated. Anything else in square brackets is an "unknown tag": it is
// passed through to providers that read bracket tags and removed for the rest.

/** Canonical cues and the spellings people are likely to type. */
export const CUES = {
  laugh: ['laugh', 'laughs', 'laughter', 'laughing', 'chuckle', 'chuckles'],
  sigh: ['sigh', 'sighs'],
  breath: ['breath', 'breathe', 'breathes', 'inhale', 'inhales', 'inhales deeply', 'breath in'],
  gasp: ['gasp', 'gasps'],
  pause: ['pause', 'short pause'],
  longPause: ['long pause'],
  whisper: ['whisper', 'whispers', 'whispering'],
  endWhisper: ['/whisper', '/whispers', 'end whisper'],
};

const LOOKUP = new Map(Object.entries(CUES).flatMap(([cue, names]) => names.map((n) => [n, cue])));
// [ … ] up to 40 characters, not a markdown link "[x](…)", not a bare number "[1]".
const TAG_RE = /\[([^\[\]\n]{1,40})\](?!\()/g;

/** The cue a tag stands for, or null for an unknown tag. */
export const cueOf = (inner) => LOOKUP.get(inner.trim().toLowerCase().replace(/\s+/g, ' ')) || null;

/** True when the text contains any square-bracket tag (known or not). */
export const hasTags = (text) => [...String(text || '').matchAll(TAG_RE)].some((m) => !/^\d+$/.test(m[1].trim()));

// The last few spoken words before a tag (tags, markup and bare ellipses left out), to anchor an instruction.
const lastWords = (s, n = 5) => s.replace(TAG_RE, ' ').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter((w) => w && !/^[.…]+$/.test(w)).slice(-n).join(' ');

/**
 * Translate cues in `text` with a provider's `rule(cue, info)` function.
 * `rule` gets the cue name ('laugh', … or 'unknown') and { tag, before, span }
 * and returns { out, method, note?, hint? }:
 *   out    – text to put in place of the tag ('' removes it)
 *   method – shown on the take: 'tag', 'passed through', 'SSML', 'punctuation', 'instructions', 'removed', …
 *   hint   – optional line for the provider's instructions prompt (OpenAI)
 */
export function compileCues(text, rule) {
  const report = new Map();
  const hints = [];
  let out = '';
  let last = 0;
  let whisperStart = null;
  const matches = [...text.matchAll(TAG_RE)].filter((m) => !/^\d+$/.test(m[1].trim()));

  // Text spoken inside each [whisper]…[/whisper], so a provider can describe it.
  const spans = new Map();
  for (const m of matches) {
    const c = cueOf(m[1]);
    if (c === 'whisper') whisperStart = m;
    else if (c === 'endWhisper' && whisperStart) {
      spans.set(whisperStart.index, text.slice(whisperStart.index + whisperStart[0].length, m.index).replace(TAG_RE, '').trim());
      whisperStart = null;
    }
  }

  for (const m of matches) {
    let chunk = text.slice(last, m.index);
    const cue = cueOf(m[1]) || 'unknown';
    const r = rule(cue, { tag: m[0], inner: m[1].trim(), before: lastWords(out + chunk), span: spans.get(m.index) ?? null }) || { out: '', method: 'removed' };
    let next = m.index + m[0].length;
    if (!r.out) {
      // Removing a tag shouldn't leave a double space or a space before punctuation.
      if (/\s$/.test(chunk) && /^\s/.test(text.slice(next))) chunk = chunk.replace(/\s+$/, '');
      else if (/\s$/.test(chunk) && /^[,.;:!?…]/.test(text.slice(next))) chunk = chunk.replace(/\s+$/, '');
    }
    out += chunk + (r.out || '');
    last = next;
    if (r.hint) hints.push(r.hint);
    const key = `${m[0]}→${r.method}→${r.out || ''}`;
    const prev = report.get(key);
    if (prev) prev.count++;
    else report.set(key, { tag: m[0], cue, method: r.method, sent: r.out || '', note: r.note || null, count: 1 });
  }
  out += text.slice(last);
  return { text: out.replace(/^\s+/, ''), cues: [...report.values()], hints };
}

/** Lexicon first, then cues. Used by /api/compile, /api/synthesize and the demo builder. */
export function compileFor(p, text, lexicon, opts) {
  const compiled = p.compile(text, lexicon, opts);
  if (!p.cueRule) return { ...compiled, cues: [] };
  const c = compileCues(compiled.text, (cue, info) => p.cueRule(cue, info, opts.model));
  const extra = [compiled.extraInstructions, ...c.hints].filter(Boolean).join(' ');
  const warnings = [...(compiled.warnings || [])];
  let out = c.text;
  if (p.cuePost) {
    const post = p.cuePost(out, opts.model);
    out = post.text;
    warnings.push(...post.warnings);
  }
  return { ...compiled, text: out, cues: c.cues, extraInstructions: extra || compiled.extraInstructions, warnings };
}

/** Shared result for a cue a provider can't do. */
export const removed = (note) => ({ out: '', method: 'removed', note });
