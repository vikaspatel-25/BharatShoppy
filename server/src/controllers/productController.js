
import mongoose from "mongoose";

 async function getProducts(req, res) {

    const products = mongoose.connection.db.collection("products")
    const stores = mongoose.connection.db.collection("stores")

    const productsData = await products.find({}).toArray();
    const storesData = await stores.find({}).toArray();

    const page = Number(req.query.page) || 1;
    const city = req.query.city;
    const category = req.query.category;
    const limit = 10;

    const startingIndex = (page - 1) * limit;
    const lastIndex = startingIndex + limit;

    let filteredProducts = productsData;

    if (city) {
      const filteredStores = storesData.filter(
        (store) => store.city.toLowerCase() === city.toLowerCase()
      );

      const filteredStoreIds = filteredStores.map(
        (store) => store._id
      );

      filteredProducts = filteredProducts.filter((product) =>
        filteredStoreIds.includes(product.storeId)
      );
    }

    if (category) {
      filteredProducts = filteredProducts.filter(
        (product) =>
          product.category?.toLowerCase() === category.toLowerCase()
      );
    }

    const paginatedProducts = filteredProducts.slice(
      startingIndex,
      lastIndex
    );

    const productsWithStore = paginatedProducts.map((product) => {
      const store = storesData.find(
        (store) => store._id === product.storeId
      );

      return {
        ...product,
        store: store
          ? {
              _id: store._id,
              storeName: store.storeName,
              slug: store.slug,
            }
          : null,
      };
    });

    res.json({
      products: productsWithStore,
      pagination: {
        page,
        limit,
        total: filteredProducts.length,
        hasMore: lastIndex < filteredProducts.length,
      },
    });
  }

  export { getProducts };