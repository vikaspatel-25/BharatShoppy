import mongoose from "mongoose";

async function searchStoreProducts(req, res) {
  const storeId = req.params.storeId;
  const query = req.query.q?.trim().toLowerCase() || "";

  const products = mongoose.connection.collection("products");
  const productsData = products.find({}).toArray();

  const page = Math.max(
    Number(req.query.page) || 1,
    1
  );

  const limit = 10;

  

  if (!query) {
    return res.json({
      products: [],
      pagination: {
        page,
        limit,
        total: 0,
        hasMore: false,
      },
    });
  }

 
  const filteredProducts = productsData.filter((product) => {
    if (
      product.storeId !== storeId ||
      product.isActive === false
    ) {
      return false;
    }

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


  const start =
    (page - 1) * limit;

  const end =
    start + limit;

  const paginatedProducts =
    filteredProducts.slice(
      start,
      end
    );

 

  res.json({
    products: paginatedProducts,

    pagination: {
      page,
      limit,
      total: filteredProducts.length,
      hasMore:
        end < filteredProducts.length,
    },
  });
}

export { searchStoreProducts };
