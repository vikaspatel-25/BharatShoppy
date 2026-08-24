async function getProducts(page = 1, city = null) {
  const params = new URLSearchParams();

  params.set("page", page);

  if (city) {
    params.set("city", city);
  }

  const response = await fetch(`/api/products?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Failed to fetch products");
  }

  return response.json();
}

export { getProducts };