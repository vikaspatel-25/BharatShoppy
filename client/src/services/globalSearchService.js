async function searchGlobal(
  query,
  city = null,
  category = null,
  productPage = 1,
  storePage = 1
) {
  const params = new URLSearchParams();

  params.set("q", query);
  params.set("productPage", productPage);
  params.set("storePage", storePage);

  if (city) {
    params.set("city", city);
  }

  if (category) {
    params.set("category", category);
  }

  const response = await fetch(
    `/api/search?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error("Search request failed");
  }

  return response.json();
}

export { searchGlobal };