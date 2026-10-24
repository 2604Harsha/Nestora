
import { Router } from "express";
import pool from "../config/db.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

router.use(authenticateToken);

function clean(value, maxLength = 1000) {
    if (typeof value !== "string") return "";
    return value.trim().slice(0, maxLength);
}

function validateAddress(address) {
    if (!address || typeof address !== "object") return false;

    return Boolean(
        clean(address.name, 100) &&
        clean(address.address, 1000) &&
        clean(address.city, 100) &&
        clean(address.state, 100) &&
        /^[0-9]{6}$/.test(clean(address.pincode, 6)) &&
        clean(address.country || "India", 100)
    );
}

function formatAddress(address) {
    return [
        clean(address.address, 1000),
        clean(address.city, 100),
        clean(address.state, 100),
        clean(address.pincode, 6),
        clean(address.country || "India", 100)
    ].filter(Boolean).join(", ");
}

// POST /api/orders
// Create an order from the authenticated user's database cart.
router.post("/", async (req, res, next) => {
    let connection;

    try {
        const body = req.body || {};

        const shipping = {
            name: clean(body.shippingName, 100),
            address: clean(body.shippingAddress, 1000),
            city: clean(body.shippingCity, 100),
            state: clean(body.shippingState, 100),
            pincode: clean(body.shippingPincode, 6),
            country: clean(body.shippingCountry || "India", 100)
        };

        const email = clean(body.shippingEmail, 254);
        const phone = clean(body.shippingPhone, 20);
        const paymentMethod = clean(body.paymentMethod, 20).toUpperCase();

        if (!validateAddress(shipping)) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid shipping address and six-digit PIN code."
            });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid email address."
            });
        }

        if (!/^[0-9+\-\s()]{7,20}$/.test(phone)) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid phone number."
            });
        }

        if (paymentMethod !== "COD") {
            return res.status(400).json({
                success: false,
                message: "Only Cash on Delivery is currently available."
            });
        }

        const billing = body.billingAddress &&
            typeof body.billingAddress === "object"
            ? {
                name: clean(body.billingAddress.name, 100),
                address: clean(body.billingAddress.address, 1000),
                city: clean(body.billingAddress.city, 100),
                state: clean(body.billingAddress.state, 100),
                pincode: clean(body.billingAddress.pincode, 6),
                country: clean(
                    body.billingAddress.country || "India",
                    100
                )
            }
            : null;

        if (!validateAddress(billing)) {
            return res.status(400).json({
                success: false,
                message: "Enter valid billing address details."
            });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // The database cart is authoritative; do not trust frontend prices.
        const [items] = await connection.execute(
            `SELECT
                c.product_id AS productId,
                c.quantity,
                p.name AS productName,
                p.price,
                p.stock
             FROM cart_items c
             INNER JOIN products p ON p.id = c.product_id
             WHERE c.user_id = ?
             FOR UPDATE`,
            [req.user.id]
        );

        if (!items.length) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Your cart is empty."
            });
        }

        for (const item of items) {
            if (
                !Number.isInteger(Number(item.quantity)) ||
                Number(item.quantity) < 1
            ) {
                throw new Error("Invalid quantity in your cart.");
            }

            if (Number(item.quantity) > Number(item.stock)) {
                await connection.rollback();

                return res.status(409).json({
                    success: false,
                    message: `Insufficient stock for ${item.productName}.`
                });
            }

            if (!Number.isFinite(Number(item.price)) ||
                Number(item.price) < 0) {
                throw new Error(
                    `Invalid price for ${item.productName}.`
                );
            }
        }

        const total = items.reduce(
            (sum, item) =>
                sum + Number(item.price) * Number(item.quantity),
            0
        );

        const totalAmount = Number(total.toFixed(2));

        // Save the order using your existing orders table.
        const [orderResult] = await connection.execute(
            `INSERT INTO orders (
                user_id,
                total_amount,
                shipping_name,
                shipping_phone,
                shipping_address,
                status
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [
                req.user.id,
                totalAmount,
                shipping.name,
                phone,
                formatAddress(shipping),
                "placed"
            ]
        );

        const orderId = orderResult.insertId;

        // Save the complete shipping, billing and payment information.
        await connection.execute(
            `INSERT INTO order_checkout_details (
                order_id,
                shipping_email,
                shipping_city,
                shipping_state,
                shipping_pincode,
                shipping_country,
                billing_name,
                billing_address,
                billing_city,
                billing_state,
                billing_pincode,
                billing_country,
                payment_method,
                payment_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                orderId,
                email,
                shipping.city,
                shipping.state,
                shipping.pincode,
                shipping.country,
                billing.name,
                formatAddress(billing),
                billing.city,
                billing.state,
                billing.pincode,
                billing.country,
                "COD",
                "pending"
            ]
        );

        for (const item of items) {
            await connection.execute(
                `INSERT INTO order_items (
                    order_id,
                    product_id,
                    product_name,
                    price,
                    quantity
                ) VALUES (?, ?, ?, ?, ?)`,
                [
                    orderId,
                    item.productId,
                    item.productName,
                    item.price,
                    item.quantity
                ]
            );

            const [stockUpdate] = await connection.execute(
                `UPDATE products
                 SET stock = stock - ?
                 WHERE id = ? AND stock >= ?`,
                [
                    item.quantity,
                    item.productId,
                    item.quantity
                ]
            );

            if (stockUpdate.affectedRows !== 1) {
                throw new Error(
                    `Unable to update stock for ${item.productName}.`
                );
            }
        }

        await connection.execute(
            "DELETE FROM cart_items WHERE user_id = ?",
            [req.user.id]
        );

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: "Order placed successfully.",
            order: {
                id: orderId,
                totalAmount,
                status: "placed",
                paymentMethod: "COD",
                paymentStatus: "pending",
                createdAt: new Date().toISOString()
            }
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        next(error);
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// GET /api/orders
// Return the signed-in user's order history.
router.get("/", async (req, res, next) => {
    try {
        const [orders] = await pool.execute(
            `SELECT
                o.id,
                o.total_amount AS totalAmount,
                o.shipping_name AS shippingName,
                o.shipping_phone AS shippingPhone,
                o.shipping_address AS shippingAddress,
                o.status,
                o.created_at AS createdAt,
                d.shipping_email AS shippingEmail,
                d.shipping_city AS shippingCity,
                d.shipping_state AS shippingState,
                d.shipping_pincode AS shippingPincode,
                d.shipping_country AS shippingCountry,
                d.billing_name AS billingName,
                d.billing_address AS billingAddress,
                d.billing_city AS billingCity,
                d.billing_state AS billingState,
                d.billing_pincode AS billingPincode,
                d.billing_country AS billingCountry,
                d.payment_method AS paymentMethod,
                d.payment_status AS paymentStatus
             FROM orders o
             LEFT JOIN order_checkout_details d
                ON d.order_id = o.id
             WHERE o.user_id = ?
             ORDER BY o.created_at DESC`,
            [req.user.id]
        );

        return res.json({
            success: true,
            orders
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/orders/:id
// Only the owner of an order can access its details.
router.get("/:id", async (req, res, next) => {
    try {
        const orderId = Number(req.params.id);

        if (!Number.isSafeInteger(orderId) || orderId < 1) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID."
            });
        }

        const [orders] = await pool.execute(
            `SELECT
                o.id,
                o.total_amount AS totalAmount,
                o.shipping_name AS shippingName,
                o.shipping_phone AS shippingPhone,
                o.shipping_address AS shippingAddress,
                o.status,
                o.created_at AS createdAt,
                d.shipping_email AS shippingEmail,
                d.shipping_city AS shippingCity,
                d.shipping_state AS shippingState,
                d.shipping_pincode AS shippingPincode,
                d.shipping_country AS shippingCountry,
                d.billing_name AS billingName,
                d.billing_address AS billingAddress,
                d.billing_city AS billingCity,
                d.billing_state AS billingState,
                d.billing_pincode AS billingPincode,
                d.billing_country AS billingCountry,
                d.payment_method AS paymentMethod,
                d.payment_status AS paymentStatus
             FROM orders o
             LEFT JOIN order_checkout_details d
                ON d.order_id = o.id
             WHERE o.id = ? AND o.user_id = ?
             LIMIT 1`,
            [orderId, req.user.id]
        );

        if (!orders.length) {
            return res.status(404).json({
                success: false,
                message: "Order not found."
            });
        }

        const [items] = await pool.execute(
            `SELECT
                product_id AS productId,
                product_name AS productName,
                price,
                quantity
             FROM order_items
             WHERE order_id = ?`,
            [orderId]
        );

        return res.json({
            success: true,
            order: {
                ...orders[0],
                items
            }
        });
    } catch (error) {
        next(error);
    }
});

export default router;
