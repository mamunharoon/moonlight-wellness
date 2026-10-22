// Library.jsx's real `itemsByCategory` grouping, extracted into its own
// pure, dependency-free module so a regression test can call the EXACT
// function Library.jsx invokes at render time — not a copy of its logic,
// and not a source-text pattern match (this repo's Vitest has no DOM
// rendering capability; see libraryCategoryNavigation.test.js's own header
// comment for the established precedent this works around). Behaviour is
// unchanged from the inline version this replaces inside Library.jsx's own
// useMemo.
export const groupLibraryItems = (catalog, categories, { query = '', journeyPool = null } = {}) => {
  const grouped = {};
  for (const category of categories) grouped[category] = [];
  const trimmedQuery = query.trim().toLowerCase();
  const matchesQuery = (entry) => {
    if (!trimmedQuery) return true;
    return `${entry.title} ${entry.description}`.toLowerCase().includes(trimmedQuery);
  };
  const matchesJourneyPool = (entry) => !journeyPool || journeyPool.has(entry.id);
  for (const entry of catalog) {
    if (!matchesJourneyPool(entry) || !matchesQuery(entry)) continue;
    grouped[entry.category].push(entry);
  }
  return grouped;
};
