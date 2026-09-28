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

// ── Valid categories ───────────────────────────────────────────
// Centralised here so routes + validation always use the same list.
const VALID_CATEGORIES = ['Electronics', 'Accessories', 'Home', 'Lifestyle'];

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
    if (!category || !VALID_CATEGORIES.includes(category)) {
      errors.push(`category is required and must be one of: ${VALID_CATEGORIES.join(', ')}.`);
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
// GET /api/products
// GET /api/products?category=Electronics
// ════════════════════════════════════════════════════════════════
// Returns all products, optionally filtered by category.
// Always returns an array — empty array if no products exist.
const getAllProducts = async (req, res, next) => {
  try {
    const { category } = req.query;

    // If a category filter was given, validate it
    if (category && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        error:      'Invalid category',
        message:    `Category must be one of: ${VALID_CATEGORIES.join(', ')}.`,
        categories: VALID_CATEGORIES,
      });
    }

    const products = await productModel.getAllProducts(category);

    res.status(200).json({
      success: true,
      count:   products.length,
      data:    products,
    });
  } catch (err) {
    next(err);  // pass to global error handler in server.js
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
    const product = productModel.getProductById(id);
    if (!product) {
      return res.status(404).json({ error: 'Not Found', message: `No product found with ID ${id}.` });
    }
    res.status(200).json({
      success: true,
      summary: productReviewModel.getSummary(id),
      data: productReviewModel.getReviews(id),
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
    if (!productModel.getProductById(productId)) {
      return res.status(404).json({ error: 'Not Found', message: `No product found with ID ${productId}.` });
    }

    const review = productReviewModel.createReview({
      productId,
      userId: req.user.id,
      rating,
      title,
      body,
    });
    res.status(201).json({ success: true, data: review, summary: productReviewModel.getSummary(productId) });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
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
// NOTE: In a real app this would be protected (admin only).
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
      category,
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
// NOTE: In a real app this would be protected (admin only).
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
      category,
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
  getProductById,
  getProductReviews,
  createProductReview,
  createProduct,
  updateProduct,
  deleteProduct,
};
