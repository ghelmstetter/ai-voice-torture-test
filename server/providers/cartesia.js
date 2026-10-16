import { timedFetch, compileLexicon, cleanIpa } from './util.js';

const API = 'https://api.cartesia.ai';
const VERSION = '2026-08-14';

// Multi-character IPA units that should stay together inside Cartesia's <<a|b|c>> notation.
const UNITS = ['tʃ', 'dʒ', 'aɪ', 'aʊ', 'ɔɪ', 'eɪ', 'oʊ', 'əʊ', 'ɪə', 'eə', 'ʊə', 'ɝ', 'ɚ'];
const MODIFIERS = /[ːˑʰʲʷ̩̯̃ˀ]/u; // attach to the previous symbol

/** "ˈbaɪu" → "ˈ|b|aɪ|u"  (already-piped input is left alone) */
export function toCartesiaPhonemes(ipa) {
  if (ipa.includes('|')) return ipa;
  const out = [];
  const chars = [...ipa.replace(/\s+/g, '')];
  for (let i = 0; i < chars.length; i++) {
    const two = chars[i] + (chars[i + 1] || '');
    if (UNITS.includes(two)) { out.push(two); i++; continue; }
    if (MODIFIERS.test(chars[i]) && out.length) { out[out.length - 1] += chars[i]; continue; }
    out.push(chars[i]);
  }
  return out.join('|');
}

export default {
  id: 'cartesia',
  name: 'Cartesia',
  color: '#6FD3C1',
  envKey: 'CARTESIA_API_KEY',
  docs: [
    { label: 'Custom pronunciations', url: 'https://docs.cartesia.ai/build-with-cartesia/sonic-3/custom-pronunciations' },
    { label: 'SSML tags', url: 'https://docs.cartesia.ai/build-with-cartesia/capability-guides/ssml-tags' },
    { label: 'Pricing', url: 'https://cartesia.ai/pricing' },
  ],
  models: [
    { id: 'sonic-3.6', label: 'Sonic 3.6', price: { per1k: 0.05 }, notes: 'Default. Case-insensitive pronunciation dictionaries.' },
    { id: 'sonic-3.5', label: 'Sonic 3.5', price: { per1k: 0.05 } },
    { id: 'sonic-3', label: 'Sonic 3', price: { per1k: 0.05 } },
  ],
  defaultModel: 'sonic-3.6',
  fallbackVoices: [
    { id: 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4', name: 'Docs example voice', tags: '' },
  ],
  speed: { min: 0.6, max: 1.5, step: 0.05 },
  options: [
    { key: 'emotion', label: 'Emotion (beta)', type: 'select', default: '', choices: ['', 'neutral', 'calm', 'content', 'excited', 'sad', 'angry', 'scared'] },
  ],

  async listVoices(key) {
    const res = await fetch(`${API}/voices?limit=100`, {
      headers: { Authorization: `Bearer ${key}`, 'Cartesia-Version': VERSION },
    });
    if (!res.ok) throw new Error(`voices ${res.status}`);
    const j = await res.json();
    const list = Array.isArray(j) ? j : j.data || [];
    return list
      .filter((v) => !v.language || v.language.startsWith('en'))
      .map((v) => ({ id: v.id, name: v.name, tags: (v.description || '').slice(0, 60) }));
  },

  lexiconHow: 'IPA becomes inline <<p|h|o|n|e|m|e|s>>; otherwise the sounds-like spelling is swapped in. Same notation a saved pronunciation dictionary (pronunciation_dict_id) uses.',

  compile(text, lexicon) {
    const result = compileLexicon(text, lexicon, (e) => {
      const ipa = cleanIpa(e.ipa);
      if (ipa) {
        const groups = ipa.split(/\s+/).map((w) => `<<${toCartesiaPhonemes(w)}>>`).join(' ');
        return { replacement: groups, method: 'inline <<IPA>>' };
      }
      if (e.soundsLike?.trim()) return { replacement: e.soundsLike.trim(), method: 'sounds-like spelling' };
      return { skip: 'No IPA or sounds-like spelling.' };
    });
    const warnings = [];
    if (/<spell>[^<]*<\/spell>\s*<break/i.test(result.text)) warnings.push('Cartesia advises against chaining <spell> and <break> tags.');
    return { ...result, warnings };
  },

  async synthesize({ key, text, model, voice, speed, options = {} }) {
    const body = {
      model_id: model,
      transcript: text,
      voice: { id: voice },
      language: 'en',
      output_format: { container: 'mp3', sample_rate: 44100, bit_rate: 128000 },
    };
    const gc = {};
    if (speed && speed !== 1) gc.speed = speed;
    if (options.emotion) gc.emotion = options.emotion;
    if (Object.keys(gc).length) body.generation_config = gc;
    const r = await timedFetch('Cartesia', `${API}/tts/bytes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Cartesia-Version': VERSION, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { ...r, sent: body };
  },

  tips: [
    { title: 'Inline phonemes', body: 'Wrap IPA in double angle brackets with each sound separated by a pipe. The app splits your IPA into sounds for you.', example: 'I ate <<ˈ|b|aɪ|u>> gumbo.' },
    { title: 'Sounds-like spelling', body: 'A plain respelling with the stressed syllable in capitals is often enough and easier to tweak than IPA.', example: 'tchoupitoulas → chop-uh-TOO-liss' },
    { title: 'Saved dictionaries', body: 'Create a pronunciation dictionary (API or the playground’s Pronunciation tab) and pass pronunciation_dict_id on each request. Case-insensitive matching needs Sonic 3.6+.' },
    { title: 'Spell things out', body: 'Wrap codes and acronyms in <spell>. A space inside forces a longer pause; other punctuation may be read aloud.', example: 'Your code is <spell>A7X 92</spell>.' },
    { title: 'Pauses, speed, volume', body: '<break time="500ms"/>, <speed ratio="1.2"/> (0.6–1.5) and <volume ratio="1.5"/> (0.5–2.0). Speed is guidance, so small changes are hard to hear. Each break counts as one billed character.' },
    { title: 'Emotion (beta)', body: '<emotion value="sad"/> or the emotion option here. Works best with voices tagged “Emotive”.' },
  ],
};
