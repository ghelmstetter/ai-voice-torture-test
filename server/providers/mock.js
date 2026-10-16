// A fake provider for testing the UI without API keys. Enabled with MOCK_PROVIDER=1.
// It "speaks" by generating a tone pattern whose length follows the text.

function toneWav(text) {
  const rate = 16000;
  const seconds = Math.min(20, Math.max(1, text.length / 15));
  const n = Math.floor(rate * seconds);
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const syllable = Math.abs(Math.sin(Math.PI * t * 4.2)) ** 0.6; // speech-like envelope
    const pause = Math.sin(Math.PI * t * 0.7) > -0.85 ? 1 : 0.05;
    const s = Math.sin(2 * Math.PI * (180 + 40 * Math.sin(t * 3)) * t) * syllable * pause * 0.4;
    data.writeInt16LE(Math.round(s * 32767), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

import { compileLexicon } from './util.js';

export default {
  id: 'mock',
  name: 'Test tone',
  color: '#C9C2D8',
  envKey: null,
  docs: [],
  models: [{ id: 'tone-1', label: 'Tone v1', price: { per1k: 0.01 } }],
  defaultModel: 'tone-1',
  fallbackVoices: [{ id: 'hum', name: 'Hum', tags: 'not a voice' }],
  staticVoices: true,
  speed: null,
  options: [],
  lexiconHow: 'Swaps in the sounds-like spelling, so you can see the lexicon working without a key.',
  compile(text, lexicon) {
    return { ...compileLexicon(text, lexicon, (e) => (e.soundsLike ? { replacement: e.soundsLike, method: 'respelling' } : { skip: 'No sounds-like spelling.' })), warnings: [] };
  },
  async synthesize({ text }) {
    const t0 = performance.now();
    await new Promise((r) => setTimeout(r, 120 + Math.random() * 200));
    const ttfa = performance.now() - t0;
    await new Promise((r) => setTimeout(r, 150 + text.length));
    const buffer = toneWav(text);
    return { buffer, contentType: 'audio/wav', timing: { ttfaMs: Math.round(ttfa), totalMs: Math.round(performance.now() - t0), bytes: buffer.length }, sent: { text } };
  },
  tips: [{ title: 'Testing only', body: 'This provider plays a tone instead of speech. Turn it off by removing MOCK_PROVIDER from .env.' }],
};
