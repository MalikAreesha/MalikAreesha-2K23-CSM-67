const db = require('../src/config/db');

async function runSeed() {
  console.log('--- Starting Sprint 2 Database Seeding ---');
  try {
    // 1. Clear existing catalog data
    await db.query('TRUNCATE categories, products, variants, skus, assets RESTART IDENTITY CASCADE');

    // 2. Insert Categories (2 Levels)
    const catRoot = await db.query(
      "INSERT INTO categories (name, slug, parent_id) VALUES ('Apparel', 'apparel', NULL) RETURNING id"
    );
    const rootId = catRoot.rows[0].id;

    const catChild = await db.query(
      "INSERT INTO categories (name, slug, parent_id) VALUES ('Womenswear', 'womenswear', $1) RETURNING id",
      [rootId]
    );
    const childId = catChild.rows[0].id;

    // 3. Insert Products (3 Products)
    const p1 = await db.query(
      `INSERT INTO products (category_id, name, slug, description, status, specifications)
       VALUES ($1, 'Silk Velvet Blazer', 'silk-velvet-blazer', 'Tailored velvet blazer', 'published', '{"fabric": "Silk-Velvet"}') RETURNING id`,
      [childId]
    );

    const p2 = await db.query(
      `INSERT INTO products (category_id, name, slug, description, status)
       VALUES ($1, 'Traditional Chiffon Dupatta', 'chiffon-dupatta', 'Elegant scarf', 'published') RETURNING id`,
      [childId]
    );

    const p3 = await db.query(
      `INSERT INTO products (category_id, name, slug, description, status)
       VALUES ($1, 'Linen Casual Trousers', 'linen-trousers', 'Comfort trousers', 'draft') RETURNING id`,
      [childId]
    );

    // 4. Insert Variants and SKUs (4 SKUs including 1 unavailable combination)
    // P1 Variants & SKUs
    const v1_S = await db.query("INSERT INTO variants (product_id, option_name, option_value) VALUES ($1, 'Size', 'Small') RETURNING id", [p1.rows[0].id]);
    const v1_M = await db.query("INSERT INTO variants (product_id, option_name, option_value) VALUES ($1, 'Size', 'Medium') RETURNING id", [p1.rows[0].id]);
    const v1_L = await db.query("INSERT INTO variants (product_id, option_name, option_value) VALUES ($1, 'Size', 'Large') RETURNING id", [p1.rows[0].id]);

    await db.query("INSERT INTO skus (variant_id, sku_code, price, stock_quantity, is_active) VALUES ($1, 'SVB-BLK-S', 149.99, 10, true)", [v1_S.rows[0].id]);
    await db.query("INSERT INTO skus (variant_id, sku_code, price, stock_quantity, is_active) VALUES ($1, 'SVB-BLK-M', 149.99, 25, true)", [v1_M.rows[0].id]);
    // Unavailable combination (Out of stock)
    await db.query("INSERT INTO skus (variant_id, sku_code, price, stock_quantity, is_active) VALUES ($1, 'SVB-BLK-L', 159.99, 0, false)", [v1_L.rows[0].id]);

    // P2 Variant & SKU
    const v2_OS = await db.query("INSERT INTO variants (product_id, option_name, option_value) VALUES ($1, 'Size', 'OneSize') RETURNING id", [p2.rows[0].id]);
    await db.query("INSERT INTO skus (variant_id, sku_code, price, stock_quantity, is_active) VALUES ($1, 'TCD-RED-OS', 29.99, 50, true)", [v2_OS.rows[0].id]);

    console.log(' Seed Data successfully created!');
    process.exit(0);
  } catch (err) {
    console.error(' Seed error:', err);
    process.exit(1);
  }
}

runSeed();