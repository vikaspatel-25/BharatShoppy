import products from "../data/mockData/products.js";
import stores from "../data/mockData/stores.js";

function getProducts(req, res) {
  const page = Number(req.query.page) || 1;
  const city = req.query.city;
  const limit = 10;

  const startingIndex = (page - 1) * limit;
  const lastIndex = startingIndex + limit;

  let filteredProducts = products;

  if (city) {
    const filteredStores = stores.filter(
      (store) => store.city.toLowerCase() === city.toLowerCase()
    );

    const filteredStoreIds = filteredStores.map((store) => store._id);

    filteredProducts = products.filter((product) =>
      filteredStoreIds.includes(product.storeId)
    );
  }

  const paginatedProducts = filteredProducts.slice(
    startingIndex,
    lastIndex
  );

const productsWithStore = paginatedProducts.map((product) => {
  const store = stores.find((store) => store._id === product.storeId);

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