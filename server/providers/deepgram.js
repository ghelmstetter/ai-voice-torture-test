import { timedFetch, compileLexicon, cleanIpa } from './util.js';

const API = 'https://api.deepgram.com';

const AURA2_VOICES = ['thalia', 'andromeda', 'helena', 'apollo', 'arcas', 'aries', 'asteria', 'athena', 'atlas', 'aurora', 'cora', 'delia', 'draco', 'hera', 'hermes', 'iris', 'juno', 'luna', 'orion', 'orpheus', 'pandora', 'phoebe', 'saturn', 'selene', 'theia', 'vesta', 'zeus'];

export default {
  id: 'deepgram',
  name: 'Deepgram',
  color: '#9AA6FF',
  envKey: 'DEEPGRAM_API_KEY',
  docs: [
    { label: 'Formatting text for Aura-2', url: 'https://developers.deepgram.com/docs/improving-aura-2-formatting' },
    { label: 'Speed, pause, pronunciation', url: 'https://developers.deepgram.com/docs/tts-voice-controls' },
    { label: 'Pricing', url: 'https://deepgram.com/pricing' },
  ],
  models: [
    { id: 'aura-2', label: 'Aura-2', price: { per1k: 0.03 }, notes: 'English + Spanish. Input max 2,000 characters.' },
    { id: 'flux', label: 'Flux TTS', price: { per1k: 0.045 }, notes: 'English. Pronunciation is Early Access and can’t be combined with speed.' },
  ],
  defaultModel: 'aura-2',
  // Voice ids are model-specific; the UI filters by the `model` field.
  fallbackVoices: [
    ...AURA2_VOICES.map((v) => ({ id: `aura-2-${v}-en`, name: v[0].toUpperCase() + v.slice(1), tags: 'Aura-2', model: 'aura-2' })),
    { id: 'flux-haley-en', name: 'Haley', tags: 'Flux', model: 'flux' },
  ],
  staticVoices: true,
  speed: { min: 0.7, max: 1.5, step: 0.05 },
  options: [],

  lexiconHow: 'IPA becomes an inline \\{"word": …, "pronounce": …\\} override (up to 500 per request). Otherwise the sounds-like spelling is swapped in.',

  compile(text, lexicon) {
    return { ...compileLexicon(text, lexicon, (e, matched) => {
      const ipa = cleanIpa(e.ipa);
      if (ipa) return { replacement: `\\{"word": "${matched}", "pronounce": "${ipa}"\\}`, method: 'inline IPA override' };
      if (e.soundsLike?.trim()) return { replacement: e.soundsLike.trim(), method: 'respelling' };
      return { skip: 'No IPA or sounds-like spelling.' };
    }), warnings: [] };
  },

  async synthesize({ key, text, model, voice, speed, compiled }) {
    const warnings = [];
    const isFlux = model === 'flux' || voice.startsWith('flux');
    const params = new URLSearchParams({ model: voice, encoding: 'mp3' });
    const usesPronunciation = compiled?.applied?.some((a) => a.method === 'inline IPA override');
    if (speed && speed !== 1) {
      if (isFlux && usesPronunciation) warnings.push('Flux can’t combine pronunciation overrides with speed, so speed was left at 1.0.');
      else params.set('speed', String(speed));
    }
    const url = `${API}/${isFlux ? 'v2' : 'v1'}/speak?${params}`;
    const body = { text };
    const r = await timedFetch('Deepgram', url, {
      method: 'POST',
      headers: { Authorization: `Token ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const providerReport = {};
    for (const h of ['dg-pronunciations-applied', 'dg-breaks-applied', 'dg-warnings', 'dg-char-count']) {
      const v = r.headers.get(h);
      if (v) providerReport[h] = v;
    }
    return { ...r, sent: { query: Object.fromEntries(params), ...body }, warnings, providerReport };
  },

  tips: [
    { title: 'Inline IPA overrides', body: 'Wrap a word in an escaped JSON object with its IPA. Use broad American IPA, write r as ɹ, and on Aura-2 put the stress mark directly before the vowel. Output varies between runs, so check by ear.', example: 'Take \\{"word": "dupilumab", "pronounce": "duːˈpɪljuːmæb"\\} daily.' },
    { title: 'Check what was applied', body: 'Responses include dg-pronunciations-applied and dg-warnings headers (PRON-### codes). This app shows them under each take.' },
    { title: 'Acronyms and codes', body: 'Put acronyms in quotes. Spell names and codes with spaces between letters, not dashes or commas.', example: '2020 Acura "RX" 350 · J O H N' },
    { title: 'Pauses come from punctuation', body: 'Aura-2 has no pause tag. Use commas, periods, and a spaced hyphen for an extra beat. Flux batch supports \\{pause:500ms\\} (500–3000 ms, max 8).', example: 'Your total is $45.82 - please pull forward.' },
    { title: 'Go easy on emphasis', body: 'Overusing ALL CAPS or “!!!” is a listed pitfall. Aura-2 picks pacing and expressiveness from context and word choice.' },
    { title: 'URLs and emails', body: 'Put a space before a question mark that follows a URL or email address.' },
  ],
};
