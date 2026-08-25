async function searchStoreProducts(
  storeId,
  query,
  page = 1
) {
  const params = new URLSearchParams();

  params.set("q", query);
  params.set("page", page);

  const response = await fetch(
    `/api/stores/${storeId}/products/search?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error("Store product search failed");
  }

  return response.json();
}

export { searchStoreProducts };

