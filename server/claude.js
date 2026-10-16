// Generates sample text with Claude for TTS testing.

const MODEL = () => process.env.CLAUDE_MODEL || 'claude-haiku-5-5';

const KINDS = {
  torture: 'Write a short passage (2–4 sentences, under 450 characters) that is natural to read aloud but deliberately hard for text-to-speech. Pack in several of these: numbers, dates, money, phone numbers, units, acronyms that are spelled out vs. said as words, homographs (read/read, lead/lead, live/live), proper names, a URL or email, and a sentence where stress changes the meaning.',
  natural: 'Write a short, natural spoken paragraph (2–4 sentences, under 450 characters) that would sound good in a voice demo. Vary the sentence rhythm and include one question.',
  dialogue: 'Write a short exchange of 3–4 lines between two people (under 450 characters), with emotion that shifts from calm to surprised. Put each line on its own line, no speaker names.',
  names: 'Write 2–3 sentences (under 450 characters) that use the listed words several times each in different positions in the sentence (start, middle, end, possessive).',
};

/** Ask Claude for broad American IPA (and a sounds-like spelling) for a word. */
export async function suggestPronunciation({ word = '', soundsLike = '' }) {
  if (!word.trim()) throw Object.assign(new Error('Enter a word first.'), { status: 400 });
  const prompt = [
    `Give the pronunciation of "${word.trim().slice(0, 80)}" for a text-to-speech engine.`,
    soundsLike.trim() ? `The speaker says it sounds like: "${soundsLike.trim().slice(0, 80)}". Follow that, even if it differs from the common pronunciation.` : 'Use the most common American English pronunciation.',
    'Reply with JSON only: {"ipa": "<broad American IPA with primary stress ˈ before the stressed syllable, r written as ɹ, no slashes>", "soundsLike": "<simple respelling with the stressed syllable in CAPITALS, e.g. SOCK-uh-nee>"}',
  ].join('\n');
  const { text } = await callClaude(prompt, 200);
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw Object.assign(new Error('Claude didn’t return a pronunciation. Try again.'), { status: 502 });
  const j = JSON.parse(m[0]);
  return { ipa: String(j.ipa || '').replace(/^\/|\/$/g, ''), soundsLike: String(j.soundsLike || '') };
}

async function callClaude(content, maxTokens) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw Object.assign(new Error('Add ANTHROPIC_API_KEY to .env to use Claude.'), { status: 400 });
  const t0 = performance.now();
  const headers = { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };
  // Multi-workspace keys must say which workspace to bill (Console → Settings → Workspaces, id starts with wrkspc_).
  if (process.env.ANTHROPIC_WORKSPACE_ID) headers['anthropic-workspace-id'] = process.env.ANTHROPIC_WORKSPACE_ID.trim();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: MODEL(),
      // Thinking is on by default for current models and its tokens count toward max_tokens.
      // These are short, simple writing tasks, so turn it off and leave headroom.
      max_tokens: Math.max(maxTokens, 1500),
      thinking: { type: 'disabled' },
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content }],
    }),
  });
  const j = await res.json();
  if (!res.ok) throw Object.assign(new Error(`Claude returned ${res.status}: ${j?.error?.message || 'unknown error'}`), { status: 502 });
  const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('').trim();
  if (!text) {
    const kinds = (j.content || []).map((c) => c.type).join(', ') || 'nothing';
    throw Object.assign(new Error(`Claude returned no text (stop reason: ${j.stop_reason}; got ${kinds}). Try again.`), { status: 502 });
  }
  return { text, model: j.model, usage: j.usage, ms: Math.round(performance.now() - t0) };
}

export async function generateText({ kind = 'torture', topic = '', words = [] }) {
  const parts = [KINDS[kind] || KINDS.torture];
  if (topic.trim()) parts.push(`Topic: ${topic.trim().slice(0, 200)}.`);
  if (words.length) parts.push(`Work in these words naturally: ${words.slice(0, 12).join(', ')}.`);
  parts.push('Reply with the passage only: no title, no quotes, no notes.');
  return callClaude(parts.join('\n'), 400);
}
