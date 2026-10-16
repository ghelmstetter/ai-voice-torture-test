// Protects your API credits when the app is public.
//   LIVE_PASSCODE        – if set, live generation needs this passcode (sent as x-passcode)
//   DAILY_REQUESTS_PER_IP – max live requests per visitor per day (0 = unlimited)
//   DAILY_CHAR_BUDGET     – max characters synthesized per day across everyone (0 = unlimited)
// Counters live in memory, so they reset when the server restarts.

const day = () => new Date().toISOString().slice(0, 10);
let state = { day: day(), perIp: new Map(), chars: 0 };

function roll() {
  if (state.day !== day()) state = { day: day(), perIp: new Map(), chars: 0 };
}

export function guardInfo() {
  roll();
  const budget = Number(process.env.DAILY_CHAR_BUDGET || 0);
  return {
    passcodeRequired: Boolean(process.env.LIVE_PASSCODE),
    liveEnabled: process.env.LIVE_MODE !== 'off',
    charsLeftToday: budget ? Math.max(0, budget - state.chars) : null,
  };
}

export function checkLive(req, chars = 0) {
  roll();
  if (process.env.LIVE_MODE === 'off') return 'Live generation is turned off on this server. Listen to the samples instead.';
  const pass = process.env.LIVE_PASSCODE;
  if (pass && req.headers['x-passcode'] !== pass) return 'Enter the passcode to generate live audio.';

  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const perIp = Number(process.env.DAILY_REQUESTS_PER_IP || 0);
  const used = state.perIp.get(ip) || 0;
  if (perIp && used >= perIp) return `Daily limit reached (${perIp} requests). Try again tomorrow.`;

  const budget = Number(process.env.DAILY_CHAR_BUDGET || 0);
  if (budget && state.chars + chars > budget) return 'Today’s character budget is used up. Try again tomorrow.';

  state.perIp.set(ip, used + 1);
  state.chars += chars;
  return null;
}
