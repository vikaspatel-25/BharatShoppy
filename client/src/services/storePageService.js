
async function getStorePage(
  storeId,
  page = 1
) {
  const params = new URLSearchParams();

  params.set("page", page);

  const response = await fetch(
    `/api/store/${storeId}?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch store");
  }

  return response.json();
}

export { getStorePage };
