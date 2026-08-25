
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  MapPin,
  Phone,
  Store as StoreIcon,
  Tag,
  Package,
  LoaderCircle,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import Header from "@/components/layout/header/header";

import { getProductPage } from "@/services/productPageService";

function WhatsAppIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M20.52 3.48A11.86 11.86 0 0 0 12.07 0C5.51 0 .17 5.34.17 11.9c0 2.1.55 4.15 1.59 5.96L.07 24l6.28-1.65a11.9 11.9 0 0 0 5.72 1.46h.01c6.56 0 11.9-5.34 11.9-11.9 0-3.18-1.24-6.17-3.46-8.43ZM12.08 21.8h-.01a9.87 9.87 0 0 1-5.03-1.37l-.36-.21-3.73.98 1-3.64-.23-.37a9.87 9.87 0 1 1 8.36 4.61Z"
        fill="currentColor"
      />

      <path
        d="M17.82 13.99c-.32-.16-1.9-.94-2.19-1.04-.29-.11-.51-.16-.72.16-.21.31-.83 1.04-1.02 1.25-.19.21-.38.23-.7.08-.32-.16-1.33-.49-2.54-1.56-.94-.84-1.57-1.87-1.75-2.18-.18-.31-.02-.48.14-.64.14-.14.32-.37.48-.55.16-.18.21-.31.32-.52.11-.21.05-.39-.03-.55-.08-.16-.72-1.73-.99-2.37-.26-.62-.53-.54-.72-.55-.18-.01-.39-.01-.6-.01-.21 0-.55.08-.84.39-.29.31-1.1 1.08-1.1 2.63s1.13 3.05 1.29 3.26c.16.21 2.22 3.39 5.38 4.76.75.32 1.34.51 1.8.65.76.24 1.45.21 2 .13.61-.09 1.9-.78 2.17-1.53.27-.75.27-1.39.19-1.53-.08-.14-.29-.23-.61-.39Z"
        fill="currentColor"
      />
    </svg>
  );
}

function Product() {
  const navigate = useNavigate();
  const { productId } = useParams();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedImage, setSelectedImage] = useState(0);
  const [imageErrors, setImageErrors] = useState({});

  useEffect(() => {
    async function loadProduct() {
      try {
        setLoading(true);
        setError(null);

        const data = await getProductPage(productId);

        setProduct(data.product || null);
        setSelectedImage(0);
        setImageErrors({});
      } catch (error) {
        console.error(
          "Product page loading failed:",
          error
        );

        setError(
          error.message || "Failed to load product"
        );
      } finally {
        setLoading(false);
      }
    }

    loadProduct();
  }, [productId]);

  function handleImageError(index) {
    setImageErrors((current) => ({
      ...current,
      [index]: true,
    }));
  }

  function getPriceText() {
    if (product.price?.min == null) {
      return "Price not specified";
    }

    if (
      product.price.max != null &&
      product.price.max !== product.price.min
    ) {
      return `₹${product.price.min.toLocaleString(
        "en-IN"
      )} - ₹${product.price.max.toLocaleString(
        "en-IN"
      )}`;
    }

    return `₹${product.price.min.toLocaleString(
      "en-IN"
    )}`;
  }

  function openWhatsApp() {
    if (!product?.store?.contact?.whatsapp) {
      return;
    }

    const whatsappNumber =
      product.store.contact.whatsapp.replace(
        /\D/g,
        ""
      );

    const message = `Hello, I found this product on BharatShoppy.

Product: ${product.productName}
Price: ${getPriceText()}
Store: ${product.store.storeName}
Product ID: ${product._id}

I am interested in this product. Please share availability and further details.`;

    const whatsappUrl =
      `https://wa.me/${whatsappNumber}` +
      `?text=${encodeURIComponent(message)}`;

    window.open(
      whatsappUrl,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function callStore() {
    if (!product?.store?.contact?.phone) {
      return;
    }

    window.location.href =
      `tel:${product.store.contact.phone}`;
  }

  function openStore() {
    if (!product?.store?._id) {
      return;
    }

    navigate(`/store/${product.store._id}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />

        <main className="flex min-h-[70vh] items-center justify-center">
          <LoaderCircle
            className="h-7 w-7 animate-spin text-slate-400"
            strokeWidth={1.8}
          />
        </main>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-white">
        <Header />

        <main className="mx-auto flex min-h-[70vh] max-w-7xl items-center justify-center px-4">
          <div className="text-center">

            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
              <Package
                className="h-6 w-6 text-slate-400"
                strokeWidth={1.7}
              />
            </div>

            <h1 className="mt-4 text-base font-semibold text-slate-900">
              Product not found
            </h1>

            <p className="mt-1 text-sm text-slate-400">
              This product may no longer be available.
            </p>

            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#0f2747] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#16365f]"
            >
              <ArrowLeft
                className="h-4 w-4"
                strokeWidth={1.8}
              />

              Go back
            </button>

          </div>
        </main>
      </div>
    );
  }

  const images =
    product.images?.length > 0
      ? product.images
      : [null];

  const selectedImageUrl =
    images[selectedImage];

  const attributeEntries = Object.entries(
    product.attributes || {}
  );

  const price = getPriceText();

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">

        {/* Back */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-5 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-[#0f2747]"
        >
          <ArrowLeft
            className="h-4 w-4"
            strokeWidth={1.8}
          />

          Back
        </button>

        {/* Main Product */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(15,39,71,0.05)]">

          <div className="grid lg:grid-cols-[1.05fr_0.95fr]">

            {/* Images */}
            <div className="border-b border-slate-200 lg:border-b-0 lg:border-r">

              <div className="flex min-h-[360px] items-center justify-center bg-slate-50 p-5 sm:min-h-[480px] sm:p-8">
                {selectedImageUrl &&
                !imageErrors[selectedImage] ? (
                  <img
                    src={selectedImageUrl}
                    alt={product.productName}
                    onError={() =>
                      handleImageError(selectedImage)
                    }
                    className="h-full max-h-[440px] w-full object-contain"
                  />
                ) : (
                  <img
                    src="/assets/images/placeholders/productPlaceholder.jpeg"
                    alt="Product image unavailable"
                    className="h-full max-h-[440px] w-full object-contain"
                  />
                )}
              </div>

              {images.length > 1 && (
                <div className="flex gap-3 overflow-x-auto border-t border-slate-100 p-4">
                  {images.map((image, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() =>
                        setSelectedImage(index)
                      }
                      className={`flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border bg-white transition-all ${
                        selectedImage === index
                          ? "border-[#0f2747] ring-2 ring-slate-100"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {image &&
                      !imageErrors[index] ? (
                        <img
                          src={image}
                          alt={`${product.productName} ${
                            index + 1
                          }`}
                          onError={() =>
                            handleImageError(index)
                          }
                          className="h-full w-full object-contain p-1"
                        />
                      ) : (
                        <img
                          src="/assets/images/placeholders/productPlaceholder.jpeg"
                          alt="Product image unavailable"
                          className="h-full w-full object-contain p-1"
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}

            </div>

            {/* Product Information */}
            <div className="flex flex-col p-5 sm:p-7 lg:p-9">

              {/* Title */}
              <h1 className="text-2xl font-bold leading-tight tracking-tight text-[#0f2747] sm:text-3xl">
                {product.productName}
              </h1>

              {/* Category Tags */}
              {(product.category ||
                product.subCategory) && (
                <div className="mt-3 flex flex-wrap gap-1.5">

                  {product.category && (
                    <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                      {product.category}
                    </span>
                  )}

                  {product.subCategory && (
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-500">
                      {product.subCategory}
                    </span>
                  )}

                </div>
              )}

              {/* Brand */}
              {product.brand && (
                <p className="mt-3 text-base font-semibold text-[#0f2747] sm:text-lg">
                  {product.brand}
                </p>
              )}

              {/* Description */}
              {product.shortDescription && (
                <p className="mt-4 text-sm leading-6 text-slate-500">
                  {product.shortDescription}
                </p>
              )}

              {/* Price */}
              <div className="mt-7 rounded-xl border border-slate-200 bg-slate-50 p-4">

                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Price
                </p>

                <div className="mt-1 flex flex-wrap items-baseline gap-2">

                  <p className="text-2xl font-bold tracking-tight text-[#0f2747]">
                    {price}
                  </p>

                  {product.price?.unit && (
                    <span className="text-xs text-slate-500">
                      per {product.price.unit}
                    </span>
                  )}

                </div>

                <p className="mt-1 text-[11px] text-slate-400">
                  Final price and availability may vary.
                </p>

              </div>

              {/* WhatsApp */}
              <button
                type="button"
                onClick={openWhatsApp}
                className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-[#25D366] px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#20bd5a] hover:shadow-md active:scale-[0.99]"
              >
                <WhatsAppIcon className="h-5 w-5" />

                Enquire on WhatsApp
              </button>

              <p className="mt-2 text-center text-[11px] text-slate-400">
                Contact the store directly for availability,
                pricing and other details.
              </p>

              {/* Attributes */}
              {attributeEntries.length > 0 && (
                <div className="mt-8 border-t border-slate-200 pt-6">

                  <div className="flex items-center gap-2">
                    <Tag
                      className="h-4 w-4 text-slate-500"
                      strokeWidth={1.8}
                    />

                    <h2 className="text-sm font-semibold text-[#0f2747]">
                      Product details
                    </h2>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">

                    {attributeEntries.map(
                      ([key, value], index) => (
                        <div
                          key={key}
                          className={`grid grid-cols-2 gap-4 px-4 py-3.5 text-sm ${
                            index !==
                            attributeEntries.length - 1
                              ? "border-b border-slate-100"
                              : ""
                          }`}
                        >
                          <span className="font-medium text-slate-500">
                            {key}
                          </span>

                          <span className="text-right font-semibold text-slate-800">
                            {value}
                          </span>
                        </div>
                      )
                    )}

                  </div>
                </div>
              )}

              {/* Tags */}
              {product.tags?.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2">

                  {product.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-slate-100 px-2.5 py-1 text-[10px] text-slate-500"
                    >
                      {tag}
                    </span>
                  ))}

                </div>
              )}

            </div>
          </div>
        </section>

        {/* Store Section */}
        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(15,39,71,0.04)]">

          <div className="border-b border-slate-200 px-5 py-4 sm:px-6">

            <div className="flex items-center gap-2">

              <StoreIcon
                className="h-4 w-4 text-slate-500"
                strokeWidth={1.8}
              />

              <h2 className="text-sm font-semibold text-[#0f2747]">
                Sold by
              </h2>

            </div>

          </div>

          <div className="grid md:grid-cols-[1fr_auto]">

            {/* Clickable Store Information */}
            <div
              role="button"
              tabIndex={0}
              onClick={openStore}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" ||
                  event.key === " "
                ) {
                  event.preventDefault();
                  openStore();
                }
              }}
              className="cursor-pointer p-5 transition-colors hover:bg-slate-50 focus:outline-none focus:none focus:ring-inset focus:none sm:p-6"
            >
              <div className="flex gap-4">

                {/* Store Logo */}
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">

                  {product.store.logo ? (
                    <img
                      src={product.store.logo}
                      alt={product.store.storeName}
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src =
                          "/assets/images/placeholders/storeLogoPlaceholder.jpeg";
                      }}
                      className="h-full w-full object-contain p-1"
                    />
                  ) : (
                    <img
                      src="/assets/images/placeholders/storeLogoPlaceholder.jpeg"
                      alt="Store logo unavailable"
                      className="h-full w-full object-contain p-1"
                    />
                  )}

                </div>

                {/* Store Details */}
                <div className="min-w-0 flex-1">

                  <h3 className="text-base font-semibold text-[#0f2747]">
                    {product.store.storeName}
                  </h3>

                  {product.store.storeCategory && (
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      {product.store.storeCategory}
                    </p>
                  )}

                  {product.store.description && (
                    <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
                      {product.store.description}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">

                    {product.store.address?.area && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin
                          className="h-3.5 w-3.5 text-slate-400"
                          strokeWidth={1.8}
                        />

                        {product.store.address.area},{" "}
                        {product.store.city}
                      </span>
                    )}

                    {product.store.contact?.phone && (
                      <span className="inline-flex items-center gap-1.5">
                        <Phone
                          className="h-3.5 w-3.5 text-slate-400"
                          strokeWidth={1.8}
                        />

                        {product.store.contact.phone}
                      </span>
                    )}

                  </div>

                  <p className="mt-3 text-[11px] font-medium text-[#0f2747]">
                    View store
                  </p>

                </div>
              </div>
            </div>

           {/* Store Actions */}
        <div className="border-t border-slate-200 p-5 md:border-l md:border-t-0 sm:p-6">
          <div className="flex w-full flex-col gap-2 md:min-w-[230px]">

            {product.store.contact?.whatsapp && (
              <button
                type="button"
                onClick={openWhatsApp}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#20bd5a]"
              >
                <WhatsAppIcon className="h-4 w-4" />

                WhatsApp
              </button>
            )}

            {product.store.contact?.phone && (
              <button
                type="button"
                onClick={callStore}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#0f2747] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#16365f]"
              >
                <Phone
                  className="h-4 w-4"
                  strokeWidth={2}
                />

                Call
              </button>
            )}

          </div>
        </div>
          </div>

        </section>

        {/* Address */}
        {product.store.address && (
          <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_4px_20px_rgba(15,39,71,0.04)] sm:p-6">

            <div className="flex items-center gap-2">

              <MapPin
                className="h-4 w-4 text-slate-500"
                strokeWidth={1.8}
              />

              <h2 className="text-sm font-semibold text-[#0f2747]">
                Store location
              </h2>

            </div>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              {product.store.address.area},{" "}
              {product.store.address.city},{" "}
              {product.store.address.state}{" "}
              {product.store.address.pincode}
            </p>

          </section>
        )}

      </main>
    </div>
  );
}

export default Product;
