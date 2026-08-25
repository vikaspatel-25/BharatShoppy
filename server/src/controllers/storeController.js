import stores from "../data/mockData/stores.js";

function getStores(req, res) {
  const page = Number(req.query.page) || 1;
  const city = req.query.city;
  const category = req.query.category;
  const limit = 10;

  const startingIndex = (page - 1) * limit;
  const lastIndex = startingIndex + limit;

  let filteredStores = stores;

  if (city) {
    filteredStores = filteredStores.filter(
      (store) =>
        store.city?.toLowerCase() === city.toLowerCase()
    );
  }

  if (category) {
    filteredStores = filteredStores.filter(
      (store) =>
        store.storeCategory?.toLowerCase() ===
        category.toLowerCase()
    );
  }

  filteredStores = filteredStores.filter(
    (store) => store.isActive
  );

  const paginatedStores = filteredStores.slice(
    startingIndex,
    lastIndex
  );

  res.json({
    stores: paginatedStores,
    pagination: {
      page,
      limit,
      total: filteredStores.length,
      hasMore: lastIndex < filteredStores.length,
    },
  });
}

export default getStores;