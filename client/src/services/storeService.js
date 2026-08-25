export async function getStores(
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
    `/api/stores?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch stores");
  }

  return response.json();
}