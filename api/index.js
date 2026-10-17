// Vercel entry point: every /api/* request is routed here (see vercel.json)
// and handled by the same code as `npm start`. Static files come from public/.
import { handler } from '../server/index.js';

export default handler;
