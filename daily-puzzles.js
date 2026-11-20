import {legacyDailyPair} from './engine.js?v=13';
import {DAILY_ROUTES, DAILY_START} from './data/daily/catalog-v1.js';
import {HARD_LEGACY_ROUTES} from './data/daily/hard-legacy.js';
import {HARD_DAILY_STEPS, HARD_PRACTICE_ROUTES} from './data/daily/hard-v2.js';

const MS_PER_DAY = 86_400_000;
const firstDate = Date.parse(DAILY_START + 'T00:00:00Z');

export function dailyRoute(key, hard = false) {
  const day = (Date.parse(key + 'T00:00:00Z') - firstDate) / MS_PER_DAY;
  if (!Number.isInteger(day) || day < 0) return null;
  const index = day % DAILY_ROUTES.length;
  const route = DAILY_ROUTES[index];
  return hard ? [route[0], ...HARD_DAILY_STEPS[index], route.at(-1)] : [...route];
}

export function dailyPair(key) {
  const route = dailyRoute(key);
  return route ? [route[0], route.at(-1)] : legacyDailyPair(key);
}

export function hardLegacyRoute(start, end, previousRules = false) {
  const routes = previousRules ? HARD_LEGACY_ROUTES : HARD_PRACTICE_ROUTES;
  const route = routes.find(path =>
    (path[0] === start && path.at(-1) === end) || (path[0] === end && path.at(-1) === start)
  );
  if (!route) return [];
  return route[0] === start ? [...route] : route.slice().reverse();
}
