import { timedFetch, compileLexicon, cleanIpa } from './util.js';
import { removed } from '../cues.js';

const API = 'https://api.elevenlabs.io/v1';

// Models that accept SSML <phoneme> tags (per ElevenLabs best-practices docs).
const PHONEME_TAG_MODELS = new Set(['eleven_flash_v2', 'eleven_turbo_v2', 'eleven_monolingual_v1']);
// Models that accept inline IPA between slashes: "/ˈsɑkəni/".
const INLINE_IPA_MODELS = (m) => m.startsWith('eleven_v4');
// Models that accept <break time="1s"/> (not v3/v4).
const BREAK_TAG_MODELS = (m) => !m.startsWith('eleven_v3') && !m.startsWith('eleven_v4');
// Models that read audio tags like [laughs] (v3 and v4).
const AUDIO_TAG_MODELS = (m) => m.startsWith('eleven_v3') || m.startsWith('eleven_v4');
const AUDIO_TAGS = { laugh: '[laughs]', sigh: '[sighs]', breath: '[inhales deeply]', gasp: '[gasps]', pause: '[short pause]', longPause: '[long pause]', whisper: '[whispers]' };

export default {
  id: 'elevenlabs',
  name: 'ElevenLabs',
  color: '#F2C14E',
  envKey: 'ELEVENLABS_API_KEY',
  docs: [
    { label: 'TTS best practices', url: 'https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices' },
    { label: 'API pricing', url: 'https://elevenlabs.io/pricing/api' },
  ],
  models: [
    { id: 'eleven_v4', label: 'Eleven v4', price: { per1k: 0.08 }, notes: 'Newest. Inline IPA in /slashes/, audio tags like [whispers]. No <break> tags.' },
    { id: 'eleven_v3', label: 'Eleven v3', price: { per1k: 0.08 }, notes: 'Expressive, audio tags. No phoneme or <break> tags.' },
    { id: 'eleven_multilingual_v2', label: 'Multilingual v2', price: { per1k: 0.08 }, notes: 'Strong at numbers and currency. Use alias/respelling for names.' },
    { id: 'eleven_flash_v2_5', label: 'Flash v2.5', price: { per1k: 0.04 }, notes: 'Low latency, 32 languages. Weaker number normalization.' },
    { id: 'eleven_flash_v2', label: 'Flash v2 (English)', price: { per1k: 0.04 }, notes: 'The model that honors <phoneme> tags.' },
  ],
  defaultModel: 'eleven_multilingual_v2',
  fallbackVoices: [
    { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', tags: 'British, warm' },
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', tags: 'American, calm' },
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', tags: 'American, soft' },
  ],
  speed: { min: 0.7, max: 1.2, step: 0.05 },
  options: [],
  // The app suggests switching to cueUpgrade when the text has cues and the model isn't in cueModels.
  cueModels: ['eleven_v4', 'eleven_v3'],
  cueUpgrade: 'eleven_v4',

  async listVoices(key) {
    const res = await fetch(`${API}/voices`, { headers: { 'xi-api-key': key } });
    if (!res.ok) throw new Error(`voices ${res.status}`);
    const j = await res.json();
    return (j.voices || []).map((v) => ({
      id: v.voice_id,
      name: v.name,
      tags: [v.labels?.accent, v.labels?.gender, v.category].filter(Boolean).join(', '),
    }));
  },

  lexiconHow: 'Eleven v4: inline IPA (/…/). Flash v2: <phoneme alphabet="ipa"> tags (single words). Other models: the sounds-like spelling is swapped in, which is what an alias rule does.',

  compile(text, lexicon, { model }) {
    const warnings = [];
    const result = compileLexicon(text, lexicon, (e, matched) => {
      const ipa = cleanIpa(e.ipa);
      if (ipa && INLINE_IPA_MODELS(model)) return { replacement: `/${ipa}/`, method: 'inline IPA' };
      if (ipa && PHONEME_TAG_MODELS.has(model) && !/\s/.test(matched)) {
        return { replacement: `<phoneme alphabet="ipa" ph="${ipa}">${matched}</phoneme>`, method: '<phoneme> tag' };
      }
      if (e.soundsLike?.trim()) return { replacement: e.soundsLike.trim(), method: 'respelling (alias)' };
      return { skip: ipa ? 'This model ignores IPA; add a sounds-like spelling.' : 'No IPA or sounds-like spelling.' };
    });
    if (!BREAK_TAG_MODELS(model) && /<break\b/i.test(result.text)) {
      warnings.push('This model ignores <break> tags. Use ellipses (…) or dashes for pauses.');
    }
    return { ...result, warnings };
  },

  cueHow: 'Eleven v3/v4: audio tags such as [laughs], [sighs] and [whispers]; other bracket tags pass through. Older models: <break> tags for pauses, other cues removed.',

  cueRule(cue, { tag }, model) {
    if (AUDIO_TAG_MODELS(model)) {
      if (cue === 'unknown') return { out: tag, method: 'passed through', note: 'Sent as an audio tag; results vary by voice.' };
      if (cue === 'endWhisper') return removed('Audio tags have no closing tag; the whisper may run to the end of the sentence.');
      return { out: AUDIO_TAGS[cue], method: 'audio tag' };
    }
    if (cue === 'pause') return { out: '<break time="0.6s" />', method: '<break> tag' };
    if (cue === 'longPause') return { out: '<break time="1.5s" />', method: '<break> tag' };
    return removed('This model doesn’t read audio tags. Switch to Eleven v3 or v4.');
  },

  async synthesize({ key, text, model, voice, speed }) {
    const body = { text, model_id: model };
    if (speed && speed !== 1) body.voice_settings = { speed };
    const url = `${API}/text-to-speech/${encodeURIComponent(voice)}/stream?output_format=mp3_44100_128`;
    const r = await timedFetch('ElevenLabs', url, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify(body),
    });
    return { ...r, sent: body };
  },

  tips: [
    { title: 'Phoneme tags only work on some models', body: 'SSML <phoneme> tags work on Flash v2 (English). Multilingual v2 and v3 ignore them; use an alias or a respelling there. Each tag covers a single word, so tag a first and last name separately.', example: '<phoneme alphabet="cmu-arpabet" ph="M AE1 D IH0 S AH0 N">Madison</phoneme>' },
    { title: 'Eleven v4 reads IPA inline', body: 'Wrap IPA in forward slashes inside the text. Include stress marks (ˈ ˌ) on multi-syllable words and use it sparingly.', example: 'The term "/ˌbaɪoʊˈkemɪstri/" refers to…' },
    { title: 'Alias rules swap a word for words', body: 'In a pronunciation dictionary, an alias replaces a word with another spelling or phrase. Handy for acronyms and brand names on any model.', example: '<lexeme><grapheme>UN</grapheme><alias>United Nations</alias></lexeme>' },
    { title: 'Pronunciation dictionaries', body: 'Upload a .pls or TXT file of phoneme/alias rules and reference it per request. Matching is case-sensitive and only the first matching rule applies.' },
    { title: 'Pauses', body: '<break time="1.5s" /> works up to 3 s on older models, but too many cause speed-ups and artifacts. v3/v4 ignore breaks; use ellipses (…) or dashes instead.', example: '"Hold on." <break time="1.5s" /> "Got it."' },
    { title: 'Emphasis and emotion', body: 'CAPITALS add stress, ellipses add weight. On v3/v4, audio tags steer delivery. Tags that describe a voice quality are less likely to be read aloud.', example: '[whispers] I never knew it could be this way.' },
    { title: 'Laughs, sighs and breaths', body: 'On v3 and v4, audio tags make nonverbal sounds: [laughs], [chuckles], [sighs], [exhales], [inhales deeply], [clears throat], [gasps]. They work best when the voice has that sound in its training data, so test with your voice. Multilingual v2 and Flash ignore them.', example: 'It was a disaster. [laughs] Honestly? [sighs] I give up.' },
    { title: 'Fillers and hesitation', body: 'Type “um” and “uh” as plain words, and use ellipses for a hesitant pause. Voices trained on filler sounds handle them more naturally.', example: 'So, um… I was thinking — uh — maybe not.' },
    { title: 'Numbers and normalization', body: 'Text normalization is on by default. Multilingual v2 reads "$1,000,000" better than Flash v2.5. For low latency, write numbers out yourself or have an LLM normalize first.' },
  ],
};
