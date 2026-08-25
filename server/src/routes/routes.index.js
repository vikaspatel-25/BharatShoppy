import express from "express";

import { searchLocations } from "../controllers/locationController.js";

import { getProducts } from "../controllers/productController.js";

import { getProductPage } from "../controllers/productPageController.js";

import { globalSearch } from "../controllers/globalSearchController.js";

import getStores from "../controllers/storeController.js";

import {getStorePage} from "../controllers/storePageController.js";

import { searchStoreProducts, } from "../controllers/storeProductSearchController.js";

const router = express.Router();

router.get("/searchLocations", searchLocations);

router.get("/products", getProducts);

router.get("/products/:productId", getProductPage);

router.get("/stores", getStores);

router.get( "/store/:storeId", getStorePage );

router.get( "/stores/:storeId/products/search", searchStoreProducts );

router.get("/search", globalSearch);

export default router;
