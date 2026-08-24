async function searchLocations(query) {
  const params = new URLSearchParams();

  params.set("q", query);

  const response = await fetch(
    `/api/searchLocations?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error("Failed to search locations");
  }

  return response.json();
}

export { searchLocations };