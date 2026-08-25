import products from "../data/mockData/products.js";
import stores from "../data/mockData/stores.js";

async function globalSearch(req, res) {
  const query = req.query.q?.trim().toLowerCase() || "";
  const city = req.query.city?.trim().toLowerCase() || null;
  const category =
    req.query.category?.trim().toLowerCase() || null;

  const productPage = Math.max(
    Number(req.query.productPage) || 1,
    1
  );

  const storePage = Math.max(
    Number(req.query.storePage) || 1,
    1
  );

  const limit = 10;

  if (!query) {
    return res.json({
      products: [],
      stores: [],
      pagination: {
        products: {
          page: productPage,
          limit,
          total: 0,
          hasMore: false,
        },
        stores: {
          page: storePage,
          limit,
          total: 0,
          hasMore: false,
        },
      },
    });
  }

  /*
   * -------------------------
   * Filter products
   * -------------------------
   */

  let filteredProducts = products.filter((product) => {
    const searchableText = [
      product.productName,
      product.shortDescription,
      product.brand,
      product.category,
      product.subCategory,
      ...(product.tags || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(query);
  });

  /*
   * -------------------------
   * Filter stores
   * -------------------------
   */

  let filteredStores = stores.filter((store) => {
    const searchableText = [
      store.storeName,
      store.description,
      store.storeCategory,
      store.city,
      store.address?.area,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(query);
  });

  /*
   * -------------------------
   * Location filter
   * -------------------------
   */

  if (city) {
    filteredProducts = filteredProducts.filter((product) => {
      const store = stores.find(
        (store) => store._id === product.storeId
      );

      return (
        store &&
        store.city.toLowerCase() === city
      );
    });

    filteredStores = filteredStores.filter(
      (store) => store.city.toLowerCase() === city
    );
  }

  /*
   * -------------------------
   * Category filter
   * -------------------------
   */

  if (category) {
    filteredProducts = filteredProducts.filter(
      (product) =>
        product.category?.toLowerCase() === category
    );

    filteredStores = filteredStores.filter(
      (store) =>
        store.storeCategory?.toLowerCase() === category
    );
  }

  /*
   * -------------------------
   * Product pagination
   * -------------------------
   */

  const productStart =
    (productPage - 1) * limit;

  const productEnd =
    productStart + limit;

  const paginatedProducts =
    filteredProducts.slice(
      productStart,
      productEnd
    );

  /*
   * -------------------------
   * Store pagination
   * -------------------------
   */

  const storeStart =
    (storePage - 1) * limit;

  const storeEnd =
    storeStart + limit;

  const paginatedStores =
    filteredStores.slice(
      storeStart,
      storeEnd
    );

  res.json({
    products: paginatedProducts,

    stores: paginatedStores,

    pagination: {
      products: {
        page: productPage,
        limit,
        total: filteredProducts.length,
        hasMore:
          productEnd < filteredProducts.length,
      },

      stores: {
        page: storePage,
        limit,
        total: filteredStores.length,
        hasMore:
          storeEnd < filteredStores.length,
      },
    },
  });
}

export { globalSearch };