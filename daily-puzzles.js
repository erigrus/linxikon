import {legacyDailyPair} from './engine.js?v=11';
import {DAILY_ROUTES, DAILY_START} from './data/daily/catalog-v1.js';

const MS_PER_DAY = 86_400_000;
const firstDate = Date.parse(DAILY_START + 'T00:00:00Z');

export function dailyRoute(key) {
  const day = (Date.parse(key + 'T00:00:00Z') - firstDate) / MS_PER_DAY;
  if (!Number.isInteger(day) || day < 0) return null;
  return [...DAILY_ROUTES[day % DAILY_ROUTES.length]];
}

export function dailyPair(key) {
  const route = dailyRoute(key);
  return route ? [route[0], route.at(-1)] : legacyDailyPair(key);
}
