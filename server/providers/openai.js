import { timedFetch, compileLexicon, cleanIpa } from './util.js';

const API = 'https://api.openai.com/v1';
const VOICES = ['marin', 'cedar', 'alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse'];
const LEGACY_VOICES = new Set(['alloy', 'ash', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer']);

export default {
  id: 'openai',
  name: 'OpenAI',
  color: '#F28DB2',
  envKey: 'OPENAI_API_KEY',
  docs: [
    { label: 'Text to speech guide', url: 'https://developers.openai.com/api/docs/guides/text-to-speech' },
  ],
  models: [
    { id: 'gpt-4o-mini-tts', label: 'gpt-4o-mini-tts', price: { perMin: 0.015 }, notes: 'Steerable with an instructions prompt. Price is an estimate per audio minute.' },
    { id: 'tts-1', label: 'tts-1', price: { per1k: 0.015 }, notes: 'Lower latency, lower quality. No instructions.' },
    { id: 'tts-1-hd', label: 'tts-1-hd', price: { per1k: 0.03 }, notes: 'Higher quality, slower. No instructions.' },
  ],
  defaultModel: 'gpt-4o-mini-tts',
  fallbackVoices: VOICES.map((v) => ({ id: v, name: v[0].toUpperCase() + v.slice(1), tags: v === 'marin' || v === 'cedar' ? 'best quality' : '' })),
  staticVoices: true,
  speed: { min: 0.25, max: 4, step: 0.05 },
  options: [
    { key: 'instructions', label: 'Instructions', type: 'text', default: '', placeholder: 'e.g. Calm, clear, mid-pace narrator.', models: ['gpt-4o-mini-tts'] },
  ],

  lexiconHow: 'No phoneme support. The sounds-like spelling is swapped into the text; on gpt-4o-mini-tts, IPA-only entries become a line in the instructions prompt.',

  compile(text, lexicon, { model }) {
    const hints = [];
    const result = compileLexicon(text, lexicon, (e, matched) => {
      if (e.soundsLike?.trim()) return { replacement: e.soundsLike.trim(), method: 'respelling' };
      const ipa = cleanIpa(e.ipa);
      if (ipa && model === 'gpt-4o-mini-tts') {
        hints.push(`Pronounce "${matched}" as /${ipa}/.`);
        return { replacement: matched, method: 'instructions hint' };
      }
      return { skip: ipa ? 'tts-1 models can’t take IPA; add a sounds-like spelling.' : 'No sounds-like spelling.' };
    });
    return { ...result, extraInstructions: [...new Set(hints)].join(' '), warnings: [] };
  },

  async synthesize({ key, text, model, voice, speed, options = {}, compiled }) {
    const warnings = [];
    let v = voice;
    if (model !== 'gpt-4o-mini-tts' && !LEGACY_VOICES.has(v)) {
      warnings.push(`${model} doesn’t have the “${voice}” voice, so Alloy was used.`);
      v = 'alloy';
    }
    const body = { model, voice: v, input: text, response_format: 'mp3' };
    if (speed && speed !== 1) body.speed = speed;
    if (model === 'gpt-4o-mini-tts') {
      const instr = [options.instructions, compiled?.extraInstructions].filter(Boolean).join(' ').trim();
      if (instr) body.instructions = instr;
    }
    const r = await timedFetch('OpenAI', `${API}/audio/speech`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { ...r, sent: body, warnings };
  },

  tips: [
    { title: 'Steer with instructions', body: 'gpt-4o-mini-tts takes a plain-language prompt for accent, emotion, intonation, pace, tone and whispering. It’s also the only lever for pronunciation hints.', example: 'Speak like a warm radio host. Say "Saucony" as "SOCK-uh-nee".' },
    { title: 'No SSML or phonemes', body: 'Tags like <break> or <phoneme> are read as text or ignored. Respell tricky words in the input instead.', example: 'Siobhan → shi-VAWN' },
    { title: 'Pick marin or cedar', body: 'OpenAI recommends these two voices for best quality. tts-1 and tts-1-hd only have nine of the thirteen voices.' },
    { title: 'Latency', body: 'For the fastest first audio, stream wav or pcm instead of mp3.' },
    { title: 'Disclosure', body: 'OpenAI’s usage policy requires telling listeners the voice is AI-generated.' },
  ],
};
