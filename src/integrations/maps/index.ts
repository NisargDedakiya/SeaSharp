// Google Maps adapter — reserved for warehouse/port geocoding and route
// visualization (see docs/06-api-integration-spec.md's integrations table).
// Not called by any route yet: the Logistics Engine (src/core/logistics/)
// currently works with plain country-code strings, not coordinates. Add the
// real client + a `geocode()` export here once a warehouse/port picker UI
// needs it — no code depends on this file existing yet, so there's nothing
// to keep in sync with until then.
export {};
