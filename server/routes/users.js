
const express = require("express");
const sql = require("mssql");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

// Get database connection
async function getDatabase(req) {
    return await req.app.locals.getPool();
}

// Validate positive integer IDs
function isPositiveInteger(value) {
    return (
        value !== undefined &&
        value !== null &&
        Number.isInteger(Number(value)) &&
        Number(value) > 0
    );
}

// Validate email addresses
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Remove sensitive information from user records
function publicUser(user) {
    return {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        created_at: user.created_at,
        status: user.status
    };
}

// Create a JWT token
function createToken(user) {
    if (!JWT_SECRET) {
        throw new Error("JWT_SECRET is not configured.");
    }

    return jwt.sign(
        {
            user_id: user.user_id,
            username: user.username
        },
        JWT_SECRET,
        { expiresIn: "1d" }
    );
}

// POST /api/users/register
// Register a new user
router.post("/register", async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (
            typeof username !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                success: false,
                error: "Username, email, and password are required."
            });
        }

        const cleanUsername = username.trim();
        const cleanEmail = email.trim().toLowerCase();

        if (
            cleanUsername.length < 3 ||
            cleanUsername.length > 50
        ) {
            return res.status(400).json({
                success: false,
                error: "Username must be between 3 and 50 characters."
            });
        }

        if (
            cleanEmail.length > 254 ||
            !isValidEmail(cleanEmail)
        ) {
            return res.status(400).json({
                success: false,
                error: "Please provide a valid email address."
            });
        }

        if (password.length < 8 || password.length > 72) {
            return res.status(400).json({
                success: false,
                error: "Password must be between 8 and 72 characters."
            });
        }

        const pool = await getDatabase(req);

        // Check for existing username or email
        const existingUser = await pool.request()
            .input("username", sql.NVarChar(50), cleanUsername)
            .input("email", sql.NVarChar(254), cleanEmail)
            .query(`
                SELECT user_id
                FROM dbo.users
                WHERE username = @username
                   OR email = @email;
            `);

        if (existingUser.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                error: "Username or email is already registered."
            });
        }

        // Hash password before storing it
        const passwordHash = await bcrypt.hash(password, 12);

        const result = await pool.request()
            .input("username", sql.NVarChar(50), cleanUsername)
            .input("email", sql.NVarChar(254), cleanEmail)
            .input("password_hash", sql.NVarChar(sql.MAX), passwordHash)
            .query(`
                INSERT INTO dbo.users (
                    username,
                    email,
                    password_hash
                )
                OUTPUT
                    INSERTED.user_id,
                    INSERTED.username,
                    INSERTED.email,
                    INSERTED.created_at,
                    INSERTED.status
                VALUES (
                    @username,
                    @email,
                    @password_hash
                );
            `);

        const user = result.recordset[0];

        const token = createToken(user);

        res.status(201).json({
            success: true,
            message: "Account created successfully.",
            user,
            token
        });

    } catch (error) {
        console.error("Registration error:", error);

        res.status(500).json({
            success: false,
            error: "Unable to register user."
        });
    }
});


// POST /api/users/login
// Authenticate an existing user
router.post("/login", async (req, res) => {
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
                error: "Email and password are required."
            });
        }

        const pool = await getDatabase(req);

        const result = await pool.request()
            .input(
                "email",
                sql.NVarChar(254),
                email.trim().toLowerCase()
            )
            .query(`
                SELECT
                    user_id,
                    username,
                    email,
                    password_hash,
                    created_at,
                    status
                FROM dbo.users
                WHERE email = @email;
            `);

        if (result.recordset.length === 0) {
            return res.status(401).json({
                success: false,
                error: "Invalid email or password."
            });
        }

        const user = result.recordset[0];

        // Check password
        const passwordMatches = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                error: "Invalid email or password."
            });
        }

        // Prevent suspended or deleted accounts from logging in
        if (user.status !== "active") {
            return res.status(403).json({
                success: false,
                error: `This account is ${user.status}.`
            });
        }

        const token = createToken(user);

        res.json({
            success: true,
            message: "Login successful.",
            user: publicUser(user),
            token
        });

    } catch (error) {
        console.error("Login error:", error);

        res.status(500).json({
            success: false,
            error: "Unable to log in."
        });
    }
});


// GET /api/users/:id
// Retrieve a user's public information
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        if (!isPositiveInteger(id)) {
            return res.status(400).json({
                success: false,
                error: "Invalid user ID."
            });
        }

        const pool = await getDatabase(req);

        const result = await pool.request()
            .input("user_id", sql.Int, Number(id))
            .query(`
                SELECT
                    user_id,
                    username,
                    email,
                    created_at,
                    status
                FROM dbo.users
                WHERE user_id = @user_id;
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                error: "User not found."
            });
        }

        res.json({
            success: true,
            user: result.recordset[0]
        });

    } catch (error) {
        console.error("User retrieval error:", error);

        res.status(500).json({
            success: false,
            error: "Unable to retrieve user."
        });
    }
});


// PUT /api/users/:id
// Update a user's username or email
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { username, email } = req.body;

        if (!isPositiveInteger(id)) {
            return res.status(400).json({
                success: false,
                error: "Invalid user ID."
            });
        }

        if (
            typeof username !== "string" ||
            typeof email !== "string"
        ) {
            return res.status(400).json({
                success: false,
                error: "Username and email are required."
            });
        }

        const cleanUsername = username.trim();
        const cleanEmail = email.trim().toLowerCase();

        if (cleanUsername.length < 3 || cleanUsername.length > 50) {
            return res.status(400).json({
                success: false,
                error: "Username must be between 3 and 50 characters."
            });
        }

        if (
            cleanEmail.length > 254 ||
            !isValidEmail(cleanEmail)
        ) {
            return res.status(400).json({
                success: false,
                error: "Please provide a valid email address."
            });
        }

        const pool = await getDatabase(req);

        // Check whether another account uses the username or email
        const existingUser = await pool.request()
            .input("user_id", sql.Int, Number(id))
            .input("username", sql.NVarChar(50), cleanUsername)
            .input("email", sql.NVarChar(254), cleanEmail)
            .query(`
                SELECT user_id
                FROM dbo.users
                WHERE (username = @username OR email = @email)
                  AND user_id <> @user_id;
            `);

        if (existingUser.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                error: "Username or email is already in use."
            });
        }

        const result = await pool.request()
            .input("user_id", sql.Int, Number(id))
            .input("username", sql.NVarChar(50), cleanUsername)
            .input("email", sql.NVarChar(254), cleanEmail)
            .query(`
                UPDATE dbo.users
                SET
                    username = @username,
                    email = @email
                OUTPUT
                    INSERTED.user_id,
                    INSERTED.username,
                    INSERTED.email,
                    INSERTED.created_at,
                    INSERTED.status
                WHERE user_id = @user_id;
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                error: "User not found."
            });
        }

        res.json({
            success: true,
            message: "Account updated successfully.",
            user: result.recordset[0]
        });

    } catch (error) {
        console.error("User update error:", error);

        res.status(500).json({
            success: false,
            error: "Unable to update account."
        });
    }
});

module.exports = router;
