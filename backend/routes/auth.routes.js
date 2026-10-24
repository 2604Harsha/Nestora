import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";

const router = Router();

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d"
    }
  );
}

// POST /api/auth/register
router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !name.trim() ||
      !email.trim() ||
      password.length < 8 ||
      password.length > 72
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter your name, a valid email, and a password of at least 8 characters."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address."
      });
    }

    const [existing] = await pool.execute(
      "SELECT id FROM users WHERE email = ?",
      [normalizedEmail]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [result] = await pool.execute(
      `INSERT INTO users (name, email, password_hash)
       VALUES (?, ?, ?)`,
      [name.trim(), normalizedEmail, passwordHash]
    );

    const user = {
      id: result.insertId,
      name: name.trim(),
      email: normalizedEmail
    };

    return res.status(201).json({
      success: true,
      message: "Registration successful.",
      token: createToken(user),
      user
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists."
      });
    }

    next(error);
  }
});

// POST /api/auth/login
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required."
      });
    }

    const [rows] = await pool.execute(
      `SELECT id, name, email, password_hash
       FROM users
       WHERE email = ?`,
      [email.trim().toLowerCase()]
    );

    if (
      rows.length === 0 ||
      !(await bcrypt.compare(password, rows[0].password_hash))
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    const user = {
      id: rows[0].id,
      name: rows[0].name,
      email: rows[0].email
    };

    return res.json({
      success: true,
      message: "Login successful.",
      token: createToken(user),
      user
    });
  } catch (error) {
    next(error);
  }
});

export default router;
