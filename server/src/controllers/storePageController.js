import products from "../data/mockData/products.js";
import stores from "../data/mockData/stores.js";

async function getStorePage(req, res) {
  const { storeId } = req.params;

  if (!storeId) {
    return res.status(400).json({
      message: "Store ID is required",
    });
  }

  const store = stores.find(
    (store) => store._id === storeId
  );

  if (!store || !store.isActive) {
    return res.status(404).json({
      message: "Store not found",
    });
  }

  const page = Math.max(
    Number(req.query.page) || 1,
    1
  );

  const limit = 10;

  const storeProducts = products.filter(
    (product) => product.storeId === storeId
  );

  const productStart =
    (page - 1) * limit;

  const productEnd =
    productStart + limit;

  const paginatedProducts =
    storeProducts.slice(
      productStart,
      productEnd
    );

  res.json({
    store,
    products: paginatedProducts,
    pagination: {
      page,
      limit,
      total: storeProducts.length,
      hasMore:
        productEnd < storeProducts.length,
    },
  });
}

export { getStorePage };

