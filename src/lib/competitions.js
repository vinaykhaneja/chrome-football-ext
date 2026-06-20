/** Competition catalog — maps user-facing names to football-data.org codes where available. */
export const COMPETITIONS = [
  { id: 'WC', name: 'FIFA World Cup', category: 'FIFA', apiCode: 'WC', tournament: true },
  { id: 'WCQ_UEFA', name: 'FIFA World Cup Qualifiers (UEFA)', category: 'FIFA', apiCode: 'QUFA', tournament: true },
  { id: 'WCQ_AFC', name: 'FIFA World Cup Qualifiers (AFC)', category: 'FIFA', apiCode: 'QAFC', tournament: true },
  { id: 'WCQ_CAF', name: 'FIFA World Cup Qualifiers (CAF)', category: 'FIFA', apiCode: 'QCAF', tournament: true },
  { id: 'WCQ_CONCACAF', name: 'FIFA World Cup Qualifiers (CONCACAF)', category: 'FIFA', apiCode: 'QCCF', tournament: true },
  { id: 'WCQ_CONMEBOL', name: 'FIFA World Cup Qualifiers (CONMEBOL)', category: 'FIFA', apiCode: 'QCBL', tournament: true },
  { id: 'WCQ_OFC', name: 'FIFA World Cup Qualifiers (OFC)', category: 'FIFA', apiCode: 'QOFC', tournament: true },
  { id: 'CA', name: 'Copa América', category: 'FIFA', apiCode: 'CA', tournament: true },
  { id: 'OLY', name: 'Summer Olympics (Football)', category: 'FIFA', apiCode: 'OLY', tournament: true },
  { id: 'CL', name: 'UEFA Champions League', category: 'UEFA', apiCode: 'CL', tournament: true },
  { id: 'EL', name: 'UEFA Europa League', category: 'UEFA', apiCode: 'EL', tournament: true },
  { id: 'ECL', name: 'UEFA Conference League', category: 'UEFA', apiCode: 'UCL', tournament: true },
  { id: 'PL', name: 'English Premier League', category: 'England', apiCode: 'PL' },
  { id: 'FAC', name: 'FA Cup', category: 'England', apiCode: 'FAC' },
  { id: 'ELC_CUP', name: 'EFL Cup (Carabao Cup)', category: 'England', apiCode: 'FLC' },
  { id: 'CH', name: 'EFL Championship', category: 'England', apiCode: 'ELC' },
  { id: 'PD', name: 'La Liga', category: 'Spain', apiCode: 'PD' },
  { id: 'CDR', name: 'Copa del Rey', category: 'Spain', apiCode: 'CDR' },
  { id: 'BL1', name: 'Bundesliga', category: 'Germany', apiCode: 'BL1' },
  { id: 'DFB', name: 'DFB-Pokal', category: 'Germany', apiCode: 'DFB' },
  { id: 'SA', name: 'Serie A', category: 'Italy', apiCode: 'SA' },
  { id: 'CI', name: 'Coppa Italia', category: 'Italy', apiCode: 'CIT' },
  { id: 'FL1', name: 'Ligue 1', category: 'France', apiCode: 'FL1' },
  { id: 'CDF', name: 'Coupe de France', category: 'France', apiCode: null },
  { id: 'DED', name: 'Eredivisie', category: 'Netherlands', apiCode: 'DED' },
  { id: 'PPL', name: 'Primeira Liga', category: 'Portugal', apiCode: 'PPL' },
  { id: 'MLS', name: 'Major League Soccer (MLS)', category: 'Americas', apiCode: 'MLS' },
  { id: 'SPL', name: 'Saudi Pro League', category: 'Middle East', apiCode: null },
  { id: 'BSA', name: 'Brasileirão Série A', category: 'South America', apiCode: 'BSA' },
  { id: 'APD', name: 'Argentine Primera División', category: 'South America', apiCode: 'ASL' },
  { id: 'ACL', name: 'AFC Champions League', category: 'Asia', apiCode: null },
  { id: 'CCC', name: 'CONCACAF Champions Cup', category: 'Americas', apiCode: null },
  { id: 'CLI', name: 'Copa Libertadores', category: 'South America', apiCode: 'CLI', tournament: true },
  { id: 'CS', name: 'Copa Sudamericana', category: 'South America', apiCode: null },
  { id: 'IF', name: 'International Friendlies', category: 'International', apiCode: null },
  { id: 'ECQ', name: 'UEFA European Championship Qualifiers', category: 'UEFA', apiCode: null },
  { id: 'EC', name: 'UEFA European Championship', category: 'UEFA', apiCode: 'EC', tournament: true },
  { id: 'NL', name: 'UEFA Nations League', category: 'UEFA', apiCode: null },
  { id: 'WCL', name: "Women's Champions League", category: 'Women', apiCode: null },
  { id: 'WSL', name: "Women's Super League", category: 'Women', apiCode: null },
  { id: 'WWC', name: "Women's World Cup", category: 'Women', apiCode: null },
];

/** Competitions included in football-data.org free tier (approximate). */
export const FREE_TIER_CODES = new Set([
  'WC', 'CL', 'PL', 'PD', 'BL1', 'SA', 'FL1', 'DED', 'PPL', 'ELC', 'BSA', 'EC',
]);

/** Tournament/cup codes that need a season param to avoid stale historical data. */
export const TOURNAMENT_CODES = new Set(
  COMPETITIONS.filter((c) => c.tournament && c.apiCode).map((c) => c.apiCode)
);

export function getCompetitionById(id) {
  return COMPETITIONS.find((c) => c.id === id);
}

const FIFA_IDS = ['WC', 'WCQ_UEFA', 'WCQ_AFC', 'WCQ_CAF', 'WCQ_CONCACAF', 'WCQ_CONMEBOL', 'WCQ_OFC', 'CA', 'OLY'];

export const DEFAULT_ENABLED = [
  ...FIFA_IDS.filter((id) => getCompetitionById(id)?.apiCode),
  ...COMPETITIONS.filter((c) => c.apiCode && FREE_TIER_CODES.has(c.apiCode)).map((c) => c.id),
].filter((id, i, arr) => arr.indexOf(id) === i);

export function getApiCodesForEnabled(enabledIds) {
  return enabledIds
    .map((id) => getCompetitionById(id))
    .filter((c) => c?.apiCode)
    .map((c) => c.apiCode);
}

export function mergeNewCompetitions(storedIds) {
  const known = new Set(storedIds);
  const added = COMPETITIONS.filter((c) => !known.has(c.id)).map((c) => c.id);
  return [...storedIds, ...added];
}

/** Map legacy competition ids from earlier versions. */
export function migrateCompetitionIds(storedIds) {
  const aliases = { WCQ: 'WCQ_UEFA', ELC: 'ELC_CUP' };
  return storedIds.map((id) => aliases[id] || id);
}
