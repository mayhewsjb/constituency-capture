/**
 * Manual email overrides for MPs whose addresses aren't returned by the
 * Parliament Contact API, or who use non-standard addresses.
 *
 * Applied after every sync run — these survive future refreshes.
 * Keyed by constituency name (the permanent anchor).
 *
 * Notes captured at time of entry (2026-03-23):
 *
 * Bristol West / Thangam Debbonaire — lost seat in 2024 general election;
 *   address may be outdated. Keep until constituency record is updated with
 *   new MP via sync.
 *
 * Cardiff Central / Jo Stevens — now Secretary of State for Wales; still MP
 *   for the constituency but may have different ministerial contact route.
 *
 * Chorley / Sir Lindsay Hoyle — he is the Speaker; speaker@parliament.uk
 *   is the correct address rather than the standard .mp@ format.
 *
 * New Forest East / Sir Julian Lewis — his website explicitly states
 *   constituency correspondence is not handled by email and requests letters
 *   only. julian.lewis.mp@parliament.uk exists as a standard address but may
 *   not be actively monitored.
 *
 * West Tyrone / Órfhlaith Begley — Sinn Féin MP; uses her party address
 *   rather than parliament.uk, consistent with Sinn Féin abstentionist policy
 *   of not taking seats at Westminster.
 */

export const MP_EMAIL_OVERRIDES: Record<string, string> = {
  "Bristol West": "thangam.debbonaire.mp@parliament.uk",
  "Cardiff Central": "jo.stevens.mp@parliament.uk",
  "Chorley": "speaker@parliament.uk",
  "East Wiltshire": "danny.kruger.mp@parliament.uk",
  "Eastbourne": "josh.babarinde.mp@parliament.uk",
  "Eltham and Chislehurst": "clive.efford.mp@parliament.uk",
  "Erith and Thamesmead": "abena.oppongasare.mp@parliament.uk",
  "Leeds Central": "alex.sobel.mp@parliament.uk",
  "New Forest East": "julian.lewis.mp@parliament.uk",
  "West Tyrone": "orfhlaith.begley@sinnfein.ie",
};
