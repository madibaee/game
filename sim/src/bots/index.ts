import type { Bot } from './planner.ts';
import { SCRIPTED, scriptedBot } from './scripted.ts';
import { searchBot } from './search.ts';

export { SCRIPTED, PERSONAS, scriptedBot } from './scripted.ts';
export { searchBot } from './search.ts';
export type { Bot } from './planner.ts';

/** Bot by name: one of the six scripted bots, or "search". */
export function makeBot(name: string): Bot {
  if (name === 'search') return searchBot();
  if (SCRIPTED.includes(name)) return scriptedBot(name);
  throw new Error(`Unknown bot ${name}; known: ${SCRIPTED.join(', ')}, search`);
}
