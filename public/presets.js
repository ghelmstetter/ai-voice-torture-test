// Test passages that target common TTS failure modes.
// Shared by the UI and scripts/build-demo.js.
export const presets = [
  {
    id: 'numbers',
    title: 'Numbers and money',
    checks: 'Dates, currency with decimals and suffixes, percentages, phone numbers, extensions, times and time zones.',
    text: 'On 03/04/2025 we closed a $1.5M round at a 12.5% discount: 2,026 shares at $740.25 each. Call 406-555-0142 ext. 3 before 5:30pm MST, or on 1/2 days, by noon.',
  },
  {
    id: 'acronyms',
    title: 'Acronyms and initialisms',
    checks: 'Which get spelled out (FBI, SQL?), which become words (NASA, GIF), versions and mixed tokens.',
    text: 'The CEO asked NASA, the FBI, and a SQL DBA whether GIF rhymes with gift. The IEEE, AWS, and GPT-5 teams stayed quiet. Read the FAQ ASAP, then file the RFP by EOD Thursday.',
  },
  {
    id: 'homographs',
    title: 'Homographs',
    checks: 'Same spelling, different pronunciation depending on meaning or tense.',
    text: 'I read the lead story yesterday, and I’ll read it again tomorrow. The wind was too strong to wind the sail. She will present the present to the bass player, who keeps a bass in his tank. We must polish the Polish desk before the live show goes live.',
  },
  {
    id: 'names',
    title: 'Names and brands',
    checks: 'Personal names, place names, loanwords and brand names. Add the ones that matter to you in Pronunciations.',
    text: 'Siobhan Nguyen and Joaquin Reyes flew from Spokane to Worcester for the Saucony launch. They toasted with Moët, drove a Porsche past the Hermès store, and argued about how to say Xiaomi and Boise.',
  },
  {
    id: 'web',
    title: 'URLs, emails and code',
    checks: 'Symbols, slashes, query strings, @ handles and command-line syntax.',
    text: 'Email hello@example.com or visit https://docs.example.dev/v2/api?id=42#auth. Then run npm i -D @types/node and cd ~/src && ls -la. Follow @voice_torture_test for updates.',
  },
  {
    id: 'emphasis',
    title: 'Emphasis and tone',
    checks: 'Stress that changes meaning, rhetorical pauses, interruptions, questions and asides.',
    text: 'I didn’t say she stole the money. I didn’t say SHE stole the money. Wait... you’re serious? Really?! Okay — fine. (Quietly) Let’s never speak of this again.',
  },
  {
    id: 'units',
    title: 'Units and symbols',
    checks: 'Fractions, degrees, ranges, ratios, ordinals, chemical formulas and ± signs.',
    text: 'Mix 3/4 cup and bake at 350°F for 25–30 min. The 10 km trail gains 1,200 ft at a 7:45/mi pace. Shoot in 16:9 at 2x, keep it within ±0.5 mm, and note the CO₂ and H2O levels for 1st, 22nd and 103rd place.',
  },
  {
    id: 'longform',
    title: 'Long sentence',
    checks: 'Breath, pacing and pitch over a long, clause-heavy sentence.',
    text: 'If you have ever tried to explain to a room full of tired engineers, at the end of a long Friday, why the dashboard that everyone had agreed was finished on Tuesday now needs a completely different layout because a single customer asked a single question during a single demo, you already know exactly how this story ends.',
  },
];
