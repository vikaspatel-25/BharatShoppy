import mongoose from "mongoose";

async function getStorePage(req, res) {
  const { storeId } = req.params;

  const products = mongoose.connection.db.collection("products");
  const productsData = await products.find({}).toArray();

  const stores = mongoose.connection.db.collection("stores");
  const storesData = await stores.find({}).toArray();

  if (!storeId) {
    return res.status(400).json({
      message: "Store ID is required",
    });
  }

  const store = storesData.find(
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

  const storeProducts = productsData.filter(
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

