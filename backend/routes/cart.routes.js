import { Router } from "express";
import pool from "../config/db.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

router.use(authenticateToken);

// GET /api/cart
router.get("/", async (req, res, next) => {
  try {
    const [items] = await pool.execute(
      `SELECT
         p.id AS productId,
         p.name,
         p.image_url AS imageUrl,
         p.price,
         p.stock,
         c.quantity,
         (p.price * c.quantity) AS subtotal
       FROM cart_items c
       JOIN products p ON p.id = c.product_id
       WHERE c.user_id = ?
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );

    const total = items.reduce(
      (sum, item) => sum + Number(item.subtotal),
      0
    );

    res.json({
      success: true,
      items,
      total: Number(total.toFixed(2))
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/cart
// Body: { "productId": 1, "quantity": 1 }
router.post("/", async (req, res, next) => {
  try {
    const productId = Number(req.body.productId);
    const quantity = req.body.quantity === undefined
      ? 1
      : Number(req.body.quantity);

    if (
      !Number.isSafeInteger(productId) ||
      productId < 1 ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > 99
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide a valid product ID and quantity."
      });
    }

    const [products] = await pool.execute(
      "SELECT id, stock FROM products WHERE id = ?",
      [productId]
    );

    if (!products.length) {
      return res.status(404).json({
        success: false,
        message: "Product not found."
      });
    }

    const [existing] = await pool.execute(
      `SELECT quantity FROM cart_items
       WHERE user_id = ? AND product_id = ?`,
      [req.user.id, productId]
    );

    const newQuantity = quantity + (
      existing.length ? Number(existing[0].quantity) : 0
    );

    if (newQuantity > products[0].stock) {
      return res.status(400).json({
        success: false,
        message: "Requested quantity exceeds available stock."
      });
    }

    await pool.execute(
      `INSERT INTO cart_items (user_id, product_id, quantity)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + ?`,
      [req.user.id, productId, quantity, quantity]
    );

    res.status(201).json({
      success: true,
      message: "Product added to cart."
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/cart/:productId
// Body: { "quantity": 2 }
router.patch("/:productId", async (req, res, next) => {
  try {
    const productId = Number(req.params.productId);
    const quantity = Number(req.body.quantity);

    if (
      !Number.isSafeInteger(productId) ||
      productId < 1 ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > 99
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide a valid product ID and quantity."
      });
    }

    const [products] = await pool.execute(
      "SELECT stock FROM products WHERE id = ?",
      [productId]
    );

    if (!products.length) {
      return res.status(404).json({
        success: false,
        message: "Product not found."
      });
    }

    if (quantity > products[0].stock) {
      return res.status(400).json({
        success: false,
        message: "Requested quantity exceeds available stock."
      });
    }

    const [result] = await pool.execute(
      `UPDATE cart_items
       SET quantity = ?
       WHERE user_id = ? AND product_id = ?`,
      [quantity, req.user.id, productId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Product is not in your cart."
      });
    }

    res.json({
      success: true,
      message: "Cart quantity updated."
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/cart/:productId
router.delete("/:productId", async (req, res, next) => {
  try {
    const productId = Number(req.params.productId);

    if (!Number.isSafeInteger(productId) || productId < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID."
      });
    }

    const [result] = await pool.execute(
      `DELETE FROM cart_items
       WHERE user_id = ? AND product_id = ?`,
      [req.user.id, productId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Product is not in your cart."
      });
    }

    res.json({
      success: true,
      message: "Product removed from cart."
    });
  } catch (error) {
    next(error);
  }
});

export default router;
