import locations from "../data/mockData/locations.js";

function searchLocations(req, res) {
  const query = req.query.q?.trim().toLowerCase();

  if (!query) {
    return res.json([]);
  }

  const results = locations
    .filter((location) => {
      return (
        location.city.toLowerCase().includes(query) ||
        location.state.toLowerCase().includes(query) ||
        location.displayName.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      return getRelevanceScore(b, query) - getRelevanceScore(a, query);
    })
    .slice(0, 5);

  return res.json(results);
}

function getRelevanceScore(location, query) {
  const city = location.city.toLowerCase();
  const state = location.state.toLowerCase();
  const displayName = location.displayName.toLowerCase();

  let score = 0;

  // Exact city match
  if (city === query) {
    score += 100;
  }

  // City starts with the query
  if (city.startsWith(query)) {
    score += 80;
  }

  // Query appears somewhere in city
  if (city.includes(query)) {
    score += 60;
  }

  // Exact state match
  if (state === query) {
    score += 40;
  }

  // Query appears in state
  if (state.includes(query)) {
    score += 20;
  }

  // Query appears in display name
  if (displayName.includes(query)) {
    score += 10;
  }

  return score;
}

export { searchLocations };