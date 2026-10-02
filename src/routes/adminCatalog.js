const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Apply auth middleware to all admin routes
router.use(authenticateToken, requireAdmin);

// CAT-01: Create Category
router.post('/categories', async (req, res) => {
  const { name, slug, parent_id } = req.body;

  if (!name || !slug) {
    return res.status(400).json({ status: 'fail', message: 'Name and slug are required' });
  }

  try {
    // Check cycle if parent_id is supplied
    if (parent_id) {
      const parentCheck = await db.query('SELECT id FROM categories WHERE id = $1', [parent_id]);
      if (parentCheck.rows.length === 0) {
        return res.status(400).json({ status: 'fail', message: 'Parent category does not exist' });
      }
    }

    const result = await db.query(
      'INSERT INTO categories (name, slug, parent_id) VALUES ($1, $2, $3) RETURNING *',
      [name, slug, parent_id || null]
    );

    return res.status(201).json({ status: 'success', data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') { // Unique constraint violation
      return res.status(409).json({ status: 'fail', error_code: 'DUPLICATE_SLUG', message: 'Category slug already exists' });
    }
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// CAT-01: Get Category Tree
router.get('/categories', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM categories ORDER BY parent_id NULLS FIRST, id ASC');
    return res.status(200).json({ status: 'success', data: result.rows });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// CAT-02: Create Product
router.post('/products', async (req, res) => {
  const { category_id, name, slug, description, status, specifications } = req.body;

  if (!category_id || !name || !slug) {
    return res.status(400).json({ status: 'fail', message: 'category_id, name, and slug are required' });
  }

  try {
    const result = await db.query(
      `INSERT INTO products (category_id, name, slug, description, status, specifications)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [category_id, name, slug, description || null, status || 'draft', specifications || {}]
    );

    return res.status(201).json({ status: 'success', data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ status: 'fail', error_code: 'DUPLICATE_SLUG', message: 'Product slug already exists' });
    }
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// CAT-02: List Administrative Products
router.get('/products', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.*, c.name as category_name 
      FROM products p 
      JOIN categories c ON p.category_id = c.id 
      ORDER BY p.id DESC
    `);
    return res.status(200).json({ status: 'success', data: result.rows });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// CAT-02: Update Product
router.patch('/products/:id', async (req, res) => {
  const { id } = req.params;
  const { name, slug, description, status, category_id, specifications } = req.body;

  try {
    const result = await db.query(
      `UPDATE products 
       SET name = COALESCE($1, name),
           slug = COALESCE($2, slug),
           description = COALESCE($3, description),
           status = COALESCE($4, status),
           category_id = COALESCE($5, category_id),
           specifications = COALESCE($6, specifications),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 RETURNING *`,
      [name, slug, description, status, category_id, specifications, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'fail', message: 'Product not found' });
    }

    return res.status(200).json({ status: 'success', data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ status: 'fail', message: 'Product slug already exists' });
    }
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// CAT-03 & CAT-04: Add Variant and Materialize SKU
router.post('/products/:id/skus', async (req, res) => {
  const { id: product_id } = req.params;
  const { option_name, option_value, sku_code, price, stock_quantity, is_active } = req.body;

  if (!option_name || !option_value || !sku_code || price === undefined || stock_quantity === undefined) {
    return res.status(400).json({ status: 'fail', message: 'Missing required variant/SKU fields' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert or find variant
    let variantRes = await client.query(
      'SELECT id FROM variants WHERE product_id = $1 AND option_name = $2 AND option_value = $3',
      [product_id, option_name, option_value]
    );

    let variant_id;
    if (variantRes.rows.length > 0) {
      variant_id = variantRes.rows[0].id;
    } else {
      const newVariant = await client.query(
        'INSERT INTO variants (product_id, option_name, option_value) VALUES ($1, $2, $3) RETURNING id',
        [product_id, option_name, option_value]
      );
      variant_id = newVariant.rows[0].id;
    }

    // 2. Materialize SKU
    const skuRes = await client.query(
      `INSERT INTO skus (variant_id, sku_code, price, stock_quantity, is_active)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [variant_id, sku_code, price, stock_quantity, is_active !== undefined ? is_active : true]
    );

    await client.query('COMMIT');
    return res.status(201).json({ status: 'success', data: { sku: skuRes.rows[0], variant_id } });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ status: 'fail', error_code: 'DUPLICATE_SKU_CODE', message: `A SKU with code '${sku_code}' already exists.` });
    }
    if (err.code === '23514') { // Check violation (e.g., stock or price < 0)
      return res.status(400).json({ status: 'fail', message: 'Invalid numeric constraints: price and stock must be non-negative.' });
    }
    return res.status(500).json({ status: 'error', message: err.message });
  } finally {
    client.release();
  }
});

// CAT-03: Update SKU
router.patch('/skus/:id', async (req, res) => {
  const { id } = req.params;
  const { price, stock_quantity, is_active } = req.body;

  try {
    const result = await db.query(
      `UPDATE skus
       SET price = COALESCE($1, price),
           stock_quantity = COALESCE($2, stock_quantity),
           is_active = COALESCE($3, is_active)
       WHERE id = $4 RETURNING *`,
      [price, stock_quantity, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'fail', message: 'SKU not found' });
    }

    return res.status(200).json({ status: 'success', data: result.rows[0] });
  } catch (err) {
    if (err.code === '23514') {
      return res.status(400).json({ status: 'fail', message: 'Price and stock_quantity must be non-negative.' });
    }
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;