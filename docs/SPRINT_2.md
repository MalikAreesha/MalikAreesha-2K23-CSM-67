# Sprint 2: Catalog Data Foundation \& Admin APIs

## Overview

Sprint 2 establishes the relational catalog data foundation for StyleAI\[cite: 1, 3]. It includes a PostgreSQL database schema supporting hierarchical categories, normalized product variants/SKUs, and JSONB product specifications\[cite: 1, 3, 4]. Additionally, it provides an administrative Express backend API secured with JWT authentication for catalog management\[cite: 1, 3, 5].

\---

## Technical Stack

* **Runtime**: Node.js\[cite: 3]
* **Framework**: Express.js\[cite: 1]
* **Database**: PostgreSQL\[cite: 1, 4]
* **Query Client**: `pg` (Node-Postgres)\[cite: 1]
* **Authentication**: JSON Web Tokens (`jsonwebtoken`) \& `bcryptjs`\[cite: 1, 3]
* **Testing**: Jest \& Supertest\[cite: 3]

\---

## Database Schema \& Data Model

### Tables Summary

1. **`categories`**: Stores product categories with hierarchical parent-child relationships and unique URL slugs\[cite: 3].
2. **`products`**: Stores base product metadata, linked to a category, with support for flexible JSONB specifications\[cite: 1, 3, 4].
3. **`variants`**: Manages product variations (e.g., Color, Material) linked to a parent product\[cite: 3, 5].
4. **`skus`**: Represents sellable inventory units with specific attributes (e.g., Size), stock quantities, prices, and override pricing\[cite: 3, 5].
5. **`assets`**: Stores media URLs associated with products or specific variants\[cite: 3].

\---

## API Endpoints

### Authorization

All administrative endpoints require a valid JWT passed in the Authorization header:
`Authorization: Bearer <ADMIN\_JWT\_TOKEN>`\[cite: 1, 3]

### Key Endpoints

* `POST /api/admin/categories` – Create category (validates unique slugs and parent category existence)\[cite: 3].
* `GET /api/admin/categories` – Retrieve hierarchical or flat category listing\[cite: 3].
* `POST /api/admin/products` – Create base product with JSONB specifications\[cite: 3, 4].
* `POST /api/admin/skus` – Create/update sellable SKU items with inventory levels and prices\[cite: 3, 5].

\---

## Verification \& Testing

### 1\. Database Migrations

Executes the schema migration against PostgreSQL:

```bash
node migrations/runMigration.js

