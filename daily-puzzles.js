import {legacyDailyPair} from './engine.js?v=12';
import {DAILY_ROUTES, DAILY_START} from './data/daily/catalog-v1.js';
import {HARD_LEGACY_ROUTES} from './data/daily/hard-legacy.js';

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

export function hardLegacyRoute(start, end) {
  const route = HARD_LEGACY_ROUTES.find(path =>
    (path[0] === start && path.at(-1) === end) || (path[0] === end && path.at(-1) === start)
  );
  if (!route) return [];
  return route[0] === start ? [...route] : route.slice().reverse();
}
