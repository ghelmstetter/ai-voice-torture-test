// Pre-records sample clips so public visitors can listen without spending your credits.
//   npm run build-demo                      → every preset × every provider with a key
//   npm run build-demo -- numbers names     → only these presets
//   npm run build-demo -- --provider=openai → only this provider (comma-separate several)
//   (both can be combined: npm run build-demo -- numbers --provider=openai)
// Clips land in public/demo/clips, metadata in public/demo/manifest.json.
// Optional: put a lexicon in demo-lexicon.json (same format as the app's export).
import '../server/env.js';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { providerList, isConfigured } from '../server/providers/index.js';
import { synthesize } from '../server/synthesize.js';
import { presets } from '../public/presets.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'demo');
await mkdir(path.join(outDir, 'clips'), { recursive: true });

const lexPath = path.join(root, 'demo-lexicon.json');
const lexicon = existsSync(lexPath) ? JSON.parse(await readFile(lexPath, 'utf8')).entries || [] : [];

// Which model/voice each provider uses for samples. Edit to taste.
const lineup = {
  elevenlabs: { model: 'eleven_multilingual_v2', voice: 'JBFqnCBsd6RMkjVDRZzb' },
  cartesia: { model: 'sonic-3.6', voice: process.env.CARTESIA_DEMO_VOICE || 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4' },
  deepgram: { model: 'aura-2', voice: 'aura-2-thalia-en' },
  openai: { model: 'gpt-4o-mini-tts', voice: 'marin' },
  gemini: { model: 'gemini-3.8-flash-tts', voice: 'Kore' },
  mock: { model: 'tone-1', voice: 'hum' },
};

const args = process.argv.slice(2);
const only = args.filter((a) => !a.startsWith('--'));
const providerArg = args.find((a) => a.startsWith('--provider='));
const onlyProviders = providerArg ? providerArg.split('=')[1].split(',').map((s) => s.trim()) : [];
const chosen = presets.filter((p) => !only.length || only.includes(p.id));
const unknown = only.filter((id) => !presets.some((p) => p.id === id));
if (unknown.length) { console.error(`Unknown preset(s): ${unknown.join(', ')}. Use: ${presets.map((p) => p.id).join(', ')}`); process.exit(1); }
const ready = providerList.filter((p) => isConfigured(p) && lineup[p.id] && (!onlyProviders.length || onlyProviders.includes(p.id)));
if (!ready.length) { console.error('No provider keys found in .env.'); process.exit(1); }

const manifestPath = path.join(outDir, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, 'utf8')) : { takes: [] };
let chars = 0;

for (const preset of chosen) {
  for (const p of ready) {
    const { model, voice } = lineup[p.id];
    process.stdout.write(`${preset.id} · ${p.name} … `);
    try {
      const r = await synthesize({ provider: p.id, model, voice, text: preset.text, lexicon });
      const ext = r.contentType.includes('wav') ? 'wav' : 'mp3';
      const file = `clips/${preset.id}-${p.id}.${ext}`;
      await writeFile(path.join(outDir, file), Buffer.from(r.audio, 'base64'));
      const { audio, ...meta } = r;
      manifest.takes = manifest.takes.filter((t) => !(t.presetId === preset.id && t.provider === p.id));
      manifest.takes.push({ presetId: preset.id, file, recordedAt: new Date().toISOString(), ...meta });
      chars += preset.text.length;
      console.log(`${r.metrics.ttfaMs} ms to first audio`);
    } catch (e) {
      console.log(`failed: ${e.message}`);
    }
  }
}

manifest.updatedAt = new Date().toISOString();
await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`\nDone. ~${chars.toLocaleString()} characters used per provider set. Manifest: public/demo/manifest.json`);
