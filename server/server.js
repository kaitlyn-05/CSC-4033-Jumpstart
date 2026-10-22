
 // Load the environment variables
require("dotenv").config({
    path: require("path").join(__dirname, ".env")
});

const express = require("express");
const cors = require("cors");

// Import PostgreSQL's connection pool
const { Pool } = require("pg");

const helloRoutes = require("./routes/hello");
const projectRoutes = require("./routes/projects");

const app = express();

// Configure port
const PORT = process.env.PORT || 5000;

// Configure connection
const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});
// Make the PostgreSQL connection pool accessible to all route files through the Express app.
app.locals.pool = pool;
app.use(cors());
app.use(express.json());

// Keep existing API routes
app.use("/api/hello", helloRoutes);
app.use("/api/projects", projectRoutes);

// Test connection
app.get("/api/projects-test", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT COUNT(*) AS total FROM projects"
        );

        res.json({
            success: true,
            projectCount: Number(result.rows[0].total)
        });
    } catch (error) {
        console.error("Project query failed:", error.message);

        res.status(500).json({
            success: false,
            error: "Could not query projects"
        });
    }
});

app.listen(PORT, () => {
    console.log(`Jumpstart server running on port ${PORT}`);
});
