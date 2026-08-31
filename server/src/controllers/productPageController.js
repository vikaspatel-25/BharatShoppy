import mongoose from "mongoose";

async function getProductPage(req, res) {

  const products = mongoose.connection.db.collection("products");
  const stores = mongoose.connection.db.collection("stores");

  const productsData = await products.find({}).toArray();
  const storesData = await stores.find({}).toArray();

  const { productId } = req.params;

  const product = productsData.find(
    (product) => product._id === productId
  );

  if (!product) {
    return res.status(404).json({
      message: "Product not found",
    });
  }

  const store = storesData.find(
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