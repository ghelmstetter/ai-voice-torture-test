import { timedFetch, compileLexicon, cleanIpa, ProviderError } from './util.js';

// Gemini TTS through the Gemini API (AI Studio key), using the Interactions endpoint.
const API = 'https://generativelanguage.googleapis.com/v1beta/interactions';

const VOICES = [
  ['Kore', 'Firm'], ['Charon', 'Informative'], ['Puck', 'Upbeat'], ['Zephyr', 'Bright'], ['Fenrir', 'Excitable'],
  ['Leda', 'Youthful'], ['Orus', 'Firm'], ['Aoede', 'Breezy'], ['Callirrhoe', 'Easy-going'], ['Autonoe', 'Bright'],
  ['Enceladus', 'Breathy'], ['Iapetus', 'Clear'], ['Umbriel', 'Easy-going'], ['Algieba', 'Smooth'], ['Despina', 'Smooth'],
  ['Erinome', 'Clear'], ['Algenib', 'Gravelly'], ['Rasalgethi', 'Informative'], ['Laomedeia', 'Upbeat'], ['Achernar', 'Soft'],
  ['Alnilam', 'Firm'], ['Schedar', 'Even'], ['Gacrux', 'Mature'], ['Pulcherrima', 'Forward'], ['Achird', 'Friendly'],
  ['Zubenelgenubi', 'Casual'], ['Vindemiatrix', 'Gentle'], ['Sadachbia', 'Lively'], ['Sadaltager', 'Knowledgeable'], ['Sulafat', 'Warm'],
];

export default {
  id: 'gemini',
  name: 'Google Gemini',
  color: '#8AB4F8',
  envKey: 'GEMINI_API_KEY',
  docs: [
    { label: 'Speech generation guide', url: 'https://ai.google.dev/gemini-api/docs/speech-generation' },
    { label: 'Pricing', url: 'https://ai.google.dev/gemini-api/docs/pricing' },
  ],
  // Billed per audio token (25 tokens per second). Prices are for 2026 and double on Jan 1, 2027.
  models: [
    { id: 'gemini-3.8-flash-tts', label: 'Gemini 3.8 Flash TTS', price: { perMin: 0.0135 }, notes: 'Steerable with a style prompt and inline tags like <sigh>. Price is an estimate per audio minute.' },
    { id: 'gemini-3.8-flash-lite-tts', label: 'Gemini 3.8 Flash-Lite TTS', price: { perMin: 0.009 }, notes: 'Cheaper and faster; fewer languages. Price is an estimate per audio minute.' },
  ],
  defaultModel: 'gemini-3.8-flash-tts',
  fallbackVoices: VOICES.map(([id, tag]) => ({ id, name: id, tags: tag })),
  staticVoices: true,
  speed: null, // no speed parameter; ask for a pace in Style instead
  options: [
    { key: 'style', label: 'Style', type: 'text', default: '', placeholder: 'e.g. Warm and clear, at a relaxed pace.' },
  ],

  lexiconHow: 'No phoneme support. The sounds-like spelling is swapped into the text; IPA-only entries become a line in the style prompt.',

  compile(text, lexicon) {
    const hints = [];
    const result = compileLexicon(text, lexicon, (e, matched) => {
      if (e.soundsLike?.trim()) return { replacement: e.soundsLike.trim(), method: 'respelling' };
      const ipa = cleanIpa(e.ipa);
      if (ipa) {
        hints.push(`Pronounce "${matched}" as /${ipa}/.`);
        return { replacement: matched, method: 'style hint' };
      }
      return { skip: 'No IPA or sounds-like spelling.' };
    });
    return { ...result, extraInstructions: [...new Set(hints)].join(' '), warnings: [] };
  },

  async synthesize({ key, text, model, voice, options = {}, compiled }) {
    const warnings = [];
    const style = [options.style, compiled?.extraInstructions].filter(Boolean).join(' ').trim();
    const item = { type: 'text', text };
    if (style) item.annotations = [{ type: 'speech_metadata', style }];
    const body = {
      model,
      input: [{ type: 'user_input', content: [item] }],
      response_format: { type: 'audio', mime_type: 'audio/wav' },
      generation_config: { speech_config: [{ voice: voice || 'Kore' }] },
    };
    const r = await timedFetch('Gemini', API, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // The audio comes back as base64 inside JSON.
    let audio = null;
    try {
      const j = JSON.parse(r.buffer.toString('utf8'));
      for (const step of j.steps || []) {
        for (const c of step.content || []) if (c.type === 'audio' && c.data) audio = c;
      }
      audio ||= j.output_audio;
    } catch { /* fall through */ }
    if (!audio?.data) throw new ProviderError('Gemini', 502, 'The response had no audio. ' + r.buffer.toString('utf8').slice(0, 300));

    return {
      ...r,
      buffer: Buffer.from(audio.data, 'base64'),
      contentType: audio.mime_type || 'audio/wav',
      sent: body,
      warnings,
    };
  },

  tips: [
    { title: 'Steer with Style', body: 'Gemini reads your text word for word; tone, emotion, pace and volume go in the Style prompt, not in the script.', example: 'Speak slowly and warmly, like a late-night radio host.' },
    { title: 'Inline sound tags', body: 'Put human sounds and pauses in angle brackets right in the text. Keep the tags in English, even in other languages.', example: 'Well <sigh> I guess we start over. <short pause> Okay!' },
    { title: 'No SSML or phonemes', body: 'There’s no phoneme markup. Respell tricky words, or describe the pronunciation in Style.', example: 'Siobhan → shi-VAWN' },
    { title: 'Emphasis and pacing', body: 'Capitalize a word to stress it. Commas, dashes and ellipses shape the rhythm.', example: 'I didn’t say SHE stole it… I said she BORROWED it.' },
    { title: 'Accents', body: 'Google advises against asking for an accent in Style. Pick a regional voice from the extended voice library instead.' },
    { title: 'Prices double in 2027', body: 'Audio is billed at 25 tokens per second; the per-token rate doubles on January 1, 2027.' },
  ],
};
