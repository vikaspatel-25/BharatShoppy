async function getProducts(
  page = 1,
  city = null,
  category = null
) {
  const params = new URLSearchParams();

  params.set("page", page);

  if (city) {
    params.set("city", city);
  }

  if (category) {
    params.set("category", category);
  }

  const response = await fetch(
    `/api/products?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch products");
  }

  return response.json();
}

async function getProductById(productId) {
  const response = await fetch(
    `/api/products/${productId}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch product");
  }

  return response.json();
}

export {
  getProducts,
  getProductById,
};