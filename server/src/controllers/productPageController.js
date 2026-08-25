import products from "../data/mockData/products.js";
import stores from "../data/mockData/stores.js";

function getProductPage(req, res) {
  const { productId } = req.params;

  const product = products.find(
    (product) => product._id === productId
  );

  if (!product) {
    return res.status(404).json({
      message: "Product not found",
    });
  }

  const store = stores.find(
    (store) => store._id === product.storeId
  );

  if (!store) {
    return res.status(404).json({
      message: "Store for this product not found",
    });
  }

  res.json({
    product: {
      ...product,

      store: {
        _id: store._id,
        storeName: store.storeName,
        slug: store.slug,
        description: store.description,
        logo: store.logo,
        images: store.images,
        storeCategory: store.storeCategory,
        city: store.city,
        state: store.state,
        location: store.location,
        address: store.address,
        contact: store.contact,
        businessHours: store.businessHours,
      },
    },
  });
}

export { getProductPage };