
const express = require("express");
const sql = require("mssql");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const router = express.Router();

// Database connection
async function getDatabase(req) {
    return await req.app.locals.getPool();
}

// Validate user ID
function isValidId(id) {
    return Number.isInteger(Number(id)) && Number(id) > 0;
}

// Validate email
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Generate authentication token
function generateToken(user) {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is not configured.");
    }

    return jwt.sign(
        {
            user_id: user.user_id,
            username: user.username
        },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    );
}

// Remove password hash from returned user data
function formatUser(user) {
    return {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        created_at: user.created_at,
        status: user.status
    };
}


// ==========================================
// POST /api/users/register
// Register a new account
// ==========================================

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

        if (cleanUsername.length < 3 || cleanUsername.length > 50) {
            return res.status(400).json({
                success: false,
                error: "Username must be between 3 and 50 characters."
            });
        }

        if (!isValidEmail(cleanEmail) || cleanEmail.length > 254) {
            return res.status(400).json({
                success: false,
                error: "Please enter a valid email address."
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

        // Hash password
        const passwordHash = await bcrypt.hash(password, 12);

        // Insert user into database
        const result = await pool.request()
            .input("username", sql.NVarChar(50), cleanUsername)
            .input("email", sql.NVarChar(254), cleanEmail)
            .input("password_hash", sql.NVarChar(255), passwordHash)
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

        res.status(201).json({
            success: true,
            message: "Account created successfully.",
            user: formatUser(user),
            token: generateToken(user)
        });

    } catch (error) {
        console.error("Registration error:", error);

        res.status(500).json({
            success: false,
            error: "Unable to register account."
        });
    }
});


// ==========================================
// POST /api/users/login
// Log into an existing account
// ==========================================

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
            .input("email", sql.NVarChar(254), email.trim().toLowerCase())
            .query(`
                SELECT *
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

        // Verify password
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

        // Check account status
        if (user.status !== "active") {
            return res.status(403).json({
                success: false,
                error: `Account is ${user.status}.`
            });
        }

        res.json({
            success: true,
            message: "Login successful.",
            user: formatUser(user),
            token: generateToken(user)
        });

    } catch (error) {
        console.error("Login error:", error);

        res.status(500).json({
            success: false,
            error: "Unable to log in."
        });
    }
});


// ==========================================
// GET /api/users/:id
// Retrieve a user
// ==========================================

router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
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
            user: formatUser(result.recordset[0])
        });

    } catch (error) {
        console.error("User retrieval error:", error);

        res.status(500).json({
            success: false,
            error: "Unable to retrieve user."
        });
    }
});


// ==========================================
// PUT /api/users/:id
// Update username and email
// ==========================================

router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { username, email } = req.body;

        if (!isValidId(id)) {
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
                error: "Invalid username length."
            });
        }

        if (!isValidEmail(cleanEmail) || cleanEmail.length > 254) {
            return res.status(400).json({
                success: false,
                error: "Invalid email address."
            });
        }

        const pool = await getDatabase(req);

        // Check for duplicate usernames or emails
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
            user: formatUser(result.recordset[0])
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

    }
});

module.exports = router;
