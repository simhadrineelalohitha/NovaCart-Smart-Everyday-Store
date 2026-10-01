// ════════════════════════════════════════════════════════════════
// controllers/productController.js — Product HTTP Handlers
// ════════════════════════════════════════════════════════════════
//
// Each function in this file:
//   1. Reads data from the HTTP request (req.params, req.query, req.body)
//   2. Validates the input
//   3. Calls the matching model function (database operation)
//   4. Sends back a clean JSON response
//
// Errors are caught by try/catch and passed to Express's global
// error handler via next(err).
// ════════════════════════════════════════════════════════════════

const productModel = require('../models/productModel');
const productReviewModel = require('../models/productReviewModel');

// ── Category validation ────────────────────────────────────────
// Categories are labels from the catalog, not a fixed enum.
const MAX_CATEGORY_LENGTH = 100;
const MAX_PAGE_SIZE = 100;
const PRODUCT_SORTS = new Set(['default', 'price-asc', 'price-desc', 'name-asc', 'name-desc']);

function isValidCategory(category) {
  return typeof category === 'string'
    && category.trim().length > 0
    && category.trim().length <= MAX_CATEGORY_LENGTH;
}

// ════════════════════════════════════════════════════════════════
// VALIDATION HELPER
// ════════════════════════════════════════════════════════════════
//
// validateProduct(body, requireAll)
//   body       → the req.body object
//   requireAll → true for CREATE (all required fields must be present)
//                false for UPDATE (only validate fields that were sent)
//
// Returns an array of error strings.
// An empty array means no errors — input is valid.
// ════════════════════════════════════════════════════════════════
function validateProduct(body, requireAll = false) {
  const errors = [];
  const { name, price, stock, category, description } = body;

  // ── name ────────────────────────────────────────────────────
  if (requireAll || name !== undefined) {
    if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 200) {
      errors.push('name is required and must be between 2 and 200 characters.');
    }
  }

  // ── price ───────────────────────────────────────────────────
  if (requireAll || price !== undefined) {
    const priceNum = Number(price);
    if (price === undefined || price === null || price === '' || isNaN(priceNum) || priceNum < 0) {
      errors.push('price is required and must be a non-negative number (e.g. 29.99).');
    }
  }

  // ── stock ───────────────────────────────────────────────────
  if (requireAll || stock !== undefined) {
    const stockNum = Number(stock);
    if (stock === undefined || stock === null || stock === '' || !Number.isInteger(stockNum) || stockNum < 0) {
      errors.push('stock is required and must be a non-negative whole number (e.g. 10).');
    }
  }

  // ── category ────────────────────────────────────────────────
  if (requireAll || category !== undefined) {
    if (!isValidCategory(category)) {
      errors.push(`category is required and must be a non-empty string up to ${MAX_CATEGORY_LENGTH} characters.`);
    }
  }

  // ── description (optional, but validated if present) ────────
  if (description !== undefined && description !== null) {
    if (typeof description !== 'string' || description.length > 2000) {
      errors.push('description must be a string of up to 2000 characters.');
    }
  }

  return errors;
}

// ════════════════════════════════════════════════════════════════
// GET /api/products?page=1&limit=24&category=Electronics&q=fan&sort=price-asc
// ════════════════════════════════════════════════════════════════
// Returns all products, optionally filtered by category.
// Always returns an array — empty array if no products exist.
const getAllProducts = async (req, res, next) => {
  try {
    const requestedCategory = req.query.category;
    const requestedSearch = req.query.q === undefined ? '' : req.query.q;
    const requestedPage = req.query.page === undefined ? '1' : req.query.page;
    const requestedLimit = req.query.limit === undefined ? '24' : req.query.limit;
    const requestedSort = req.query.sort === undefined ? 'default' : req.query.sort;

    if (requestedCategory !== undefined && !isValidCategory(requestedCategory)) {
      return res.status(400).json({
        error:      'Invalid category',
        message:    `Category must be a non-empty string up to ${MAX_CATEGORY_LENGTH} characters.`,
      });
    }
    if (typeof requestedSearch !== 'string' || requestedSearch.length > 200) {
      return res.status(400).json({ error: 'Invalid search', message: 'Search must be a string up to 200 characters.' });
    }
    if (!/^\d+$/.test(String(requestedPage)) || Number(requestedPage) < 1) {
      return res.status(400).json({ error: 'Invalid page', message: 'Page must be a positive integer.' });
    }
    if (!/^\d+$/.test(String(requestedLimit)) || Number(requestedLimit) < 1 || Number(requestedLimit) > MAX_PAGE_SIZE) {
      return res.status(400).json({ error: 'Invalid limit', message: `Limit must be between 1 and ${MAX_PAGE_SIZE}.` });
    }
    if (typeof requestedSort !== 'string' || !PRODUCT_SORTS.has(requestedSort)) {
      return res.status(400).json({ error: 'Invalid sort', message: 'Sort option is not supported.' });
    }

    const category = typeof requestedCategory === 'string' ? requestedCategory.trim() : undefined;
    const page = Number(requestedPage);
    const limit = Number(requestedLimit);
    const { rows, total } = await productModel.getAllProducts({
      category,
      search: requestedSearch.trim(),
      sort: requestedSort,
      limit,
      offset: (page - 1) * limit,
    });

    res.status(200).json({
      success: true,
      count: total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: rows,
    });
  } catch (err) {
    next(err);  // pass to global error handler in server.js
  }
};

const getProductCategories = async (_req, res, next) => {
  try {
    const categories = await productModel.getProductCategories();
    res.status(200).json({ success: true, count: categories.length, data: categories });
  } catch (err) {
    next(err);
  }
};

// ════════════════════════════════════════════════════════════════
// GET /api/products/:id
// ════════════════════════════════════════════════════════════════
// Returns a single product by its numeric ID.
// Responds 404 if no product with that ID exists.
const getProductById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);

    // Validate that :id is actually a number
    if (isNaN(id)) {
      return res.status(400).json({
        error:   'Invalid ID',
        message: 'Product ID must be a number.',
      });
    }

    const product = await productModel.getProductById(id);

    if (!product) {
      return res.status(404).json({
        error:   'Not Found',
        message: `No product found with ID ${id}.`,
      });
    }

    res.status(200).json({
      success: true,
      data:    product,
    });
  } catch (err) {
    next(err);
  }
};

const getProductReviews = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid ID', message: 'Product ID must be a positive number.' });
    }
    const product = await productModel.getProductById(id);
    if (!product) {
      return res.status(404).json({ error: 'Not Found', message: `No product found with ID ${id}.` });
    }
    const [summary, reviews] = await Promise.all([
      productReviewModel.getSummary(id),
      productReviewModel.getReviews(id),
    ]);
    res.status(200).json({
      success: true,
      summary,
      data: reviews,
    });
  } catch (err) {
    next(err);
  }
};

const createProductReview = async (req, res, next) => {
  try {
    const productId = parseInt(req.params.id, 10);
    const rating = Number(req.body.rating);
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: 'Invalid ID', message: 'Product ID must be a positive number.' });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Invalid Rating', message: 'Choose a rating from 1 to 5 stars.' });
    }
    if (title.length < 3 || title.length > 120 || body.length < 10 || body.length > 2000) {
      return res.status(400).json({
        error: 'Invalid Review',
        message: 'Review title must be 3-120 characters and review text must be 10-2000 characters.',
      });
    }
    if (!await productModel.getProductById(productId)) {
      return res.status(404).json({ error: 'Not Found', message: `No product found with ID ${productId}.` });
    }

    const review = await productReviewModel.createReview({
      productId,
      userId: req.user.id,
      rating,
      title,
      body,
    });
    const summary = await productReviewModel.getSummary(productId);
    res.status(201).json({ success: true, data: review, summary });
  } catch (err) {
    if (err.code === '23505' || err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Review Exists', message: 'You have already reviewed this product.' });
    }
    next(err);
  }
};

// ════════════════════════════════════════════════════════════════
// POST /api/products
// Body: { name, description?, price, image_url?, category, stock }
// ════════════════════════════════════════════════════════════════
// Creates a new product. All required fields must be present.
// Returns 201 Created with the newly inserted product.
//
// Access is restricted to authenticated administrators by productRoutes.js.
//       Auth middleware will be wired in Stage 2.
const createProduct = async (req, res, next) => {
  try {
    // Validate all required fields (requireAll = true)
    const errors = validateProduct(req.body, true);
    if (errors.length > 0) {
      return res.status(400).json({
        error:   'Validation Failed',
        message: 'Please fix the following errors before submitting.',
        errors,
      });
    }

    const { name, description, price, image_url, category, stock } = req.body;

    const newProduct = await productModel.createProduct({
      name:        name.trim(),
      description: description ? description.trim() : null,
      price:       Number(price),
      image_url:   image_url   ? image_url.trim() : null,
      category:    category.trim(),
      stock:       Number(stock),
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully.',
      data:    newProduct,
    });
  } catch (err) {
    next(err);
  }
};

// ════════════════════════════════════════════════════════════════
// PUT /api/products/:id
// Body: { name?, description?, price?, image_url?, category?, stock? }
// ════════════════════════════════════════════════════════════════
// Updates an existing product. Only fields you send will change.
// Returns the full updated product row.
//
// Access is restricted to authenticated administrators by productRoutes.js.
const updateProduct = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        error:   'Invalid ID',
        message: 'Product ID must be a number.',
      });
    }

    // Check that the product exists first
    const existing = await productModel.getProductById(id);
    if (!existing) {
      return res.status(404).json({
        error:   'Not Found',
        message: `No product found with ID ${id}.`,
      });
    }

    // Check the request body has at least one field
    if (Object.keys(req.body).length === 0) {
      return res.status(400).json({
        error:   'Empty Request',
        message: 'Please provide at least one field to update.',
      });
    }

    // Validate only the fields that were actually sent (requireAll = false)
    const errors = validateProduct(req.body, false);
    if (errors.length > 0) {
      return res.status(400).json({
        error:   'Validation Failed',
        message: 'Please fix the following errors before submitting.',
        errors,
      });
    }

    const { name, description, price, image_url, category, stock } = req.body;

    const updated = await productModel.updateProduct(id, {
      name:        name        ? name.trim()        : undefined,
      description: description ? description.trim() : description,
      price:       price       !== undefined ? Number(price)  : undefined,
      image_url:   image_url   ? image_url.trim()   : image_url,
      category:    category !== undefined ? category.trim() : undefined,
      stock:       stock       !== undefined ? Number(stock)  : undefined,
    });

    res.status(200).json({
      success: true,
      message: 'Product updated successfully.',
      data:    updated,
    });
  } catch (err) {
    next(err);
  }
};

// ════════════════════════════════════════════════════════════════
// DELETE /api/products/:id
// ════════════════════════════════════════════════════════════════
// Permanently deletes a product. Returns the deleted product data.
// Responds 404 if the product doesn't exist.
//
// NOTE: In a real app this would be protected (admin only).
const deleteProduct = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        error:   'Invalid ID',
        message: 'Product ID must be a number.',
      });
    }

    const deleted = await productModel.deleteProduct(id);

    if (!deleted) {
      return res.status(404).json({
        error:   'Not Found',
        message: `No product found with ID ${id}.`,
      });
    }

    res.status(200).json({
      success: true,
      message: `Product "${deleted.name}" was deleted successfully.`,
      data:    deleted,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllProducts,
  getProductCategories,
  getProductById,
  getProductReviews,
  createProductReview,
  createProduct,
  updateProduct,
  deleteProduct,
};
