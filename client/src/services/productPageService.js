async function getProductPage(productId) {
  const response = await fetch(
    `/api/products/${productId}`
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Product not found");
    }

    throw new Error(
      "Failed to fetch product"
    );
  }

  return response.json();
}

export { getProductPage };