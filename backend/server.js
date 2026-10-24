import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import pool from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import productRoutes from "./routes/product.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import orderRoutes from "./routes/order.routes.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || [
        "http://127.0.0.1:5501",
        "http://localhost:5501",
        "http://127.0.0.1:5500",
        "http://localhost:5500"
    ],
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: true }));

// Serve local product images from the backend/uploads directory.
// Example URL: http://localhost:5000/uploads/shoes.jpg
app.use(
    "/uploads",
    express.static(path.join(__dirname, "uploads"))
);

// Health checks
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "NESTORA API is running",
        productsEndpoint: "/api/products"
    });
});

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Welcome to the NESTORA API!",
        version: "1.0.0"
    });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/product", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);

// Handle unknown API endpoints
app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: "API endpoint not found."
    });
});

// Central error handler
app.use((err, req, res, next) => {
    console.error("API error:", err.message);

    if (res.headersSent) {
        return next(err);
    }

    res.status(500).json({
        success: false,
        message: "An internal server error occurred."
    });
});

// Start server only when MySQL is reachable
async function startServer() {
    try {
        await pool.query("SELECT 1");

        app.listen(PORT, () => {
            console.log(
                `NESTORA API running at http://localhost:${PORT}`
            );
            console.log("MySQL connection successful.");
            console.log(
                "Products endpoint: http://localhost:" +
                PORT +
                "/api/products"
            );
        });
    } catch (error) {
        console.error(
            "Unable to connect to MySQL:",
            error.message
        );

        process.exit(1);
    }
}

startServer();