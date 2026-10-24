import { Router } from "express";
import pool from "../config/db.js";

const router = Router();

const productFields = `
    id,
    name,
    description,
    category,
    price,
    original_price AS originalPrice,
    image_url AS imageUrl,
    rating,
    stock
`;

// GET /api/products
router.get("/", async (req, res, next) => {
    try {
        const search =
            typeof req.query.search === "string"
                ? req.query.search.trim().slice(0, 100)
                : "";

        const category =
            typeof req.query.category === "string"
                ? req.query.category.trim().slice(0, 100)
                : "";

        const allowedSorts = {
            featured: "id DESC",
            price_asc: "price ASC",
            price_desc: "price DESC",
            rating: "rating DESC",
            newest: "created_at DESC"
        };

        const sort =
            allowedSorts[req.query.sort] || allowedSorts.featured;

        const page = Math.max(
            1,
            Math.min(100000, Number(req.query.page) || 1)
        );

        const limit = Math.max(
            1,
            Math.min(50, Number(req.query.limit) || 12)
        );

        const offset = (page - 1) * limit;

        const conditions = [];
        const values = [];

        if (search) {
            conditions.push("(name LIKE ? OR description LIKE ?)");
            values.push(`%${search}%`, `%${search}%`);
        }

        if (category) {
            conditions.push("category = ?");
            values.push(category);
        }

        const whereClause = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        const [countRows] = await pool.execute(
            `SELECT COUNT(*) AS total
             FROM products ${whereClause}`,
            values
        );

        const [products] = await pool.execute(
            `SELECT ${productFields}
             FROM products
             ${whereClause}
             ORDER BY ${sort}
             LIMIT ? OFFSET ?`,
            [...values, limit, offset]
        );

        res.json({
            success: true,
            products,
            pagination: {
                page,
                limit,
                total: Number(countRows[0].total),
                totalPages: Math.ceil(
                    Number(countRows[0].total) / limit
                )
            }
        });
    } catch (error) {
        console.error("Products API error:", error);
        next(error);
    }
});

// GET /api/products/categories
router.get("/categories", async (req, res, next) => {
    try {
        const [categories] = await pool.execute(`
            SELECT category, COUNT(*) AS productCount
            FROM products
            GROUP BY category
            ORDER BY category
        `);

        res.json({
            success: true,
            categories
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/products/:id
router.get("/:id", async (req, res, next) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isSafeInteger(id) || id < 1) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID."
            });
        }

        const [rows] = await pool.execute(
            `SELECT ${productFields}
             FROM products
             WHERE id = ?`,
            [id]
        );

        if (!rows.length) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        res.json({
            success: true,
            product: rows[0]
        });
    } catch (error) {
        next(error);
    }
});

export default router;