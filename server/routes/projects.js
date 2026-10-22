
const express = require("express");
const router = express.Router();

// Get all projects
router.get("/", async (req, res) => {
    try {
        // Use the PostgreSQL pool attached to the Express app
        const pool = req.app.locals.pool;

        const result = await pool.query(`
            SELECT
                p.project_id,
                p.project_name,
                p.description,
                p.goal_hours,
                p.status,
                p.created_at,
                u.username,
                c.category_name
            FROM projects p
            JOIN users u
                ON p.owner_id = u.user_id
            LEFT JOIN project_categories c
                ON p.category_id = c.category_id
            ORDER BY p.created_at DESC
        `);

        res.json({
            success: true,
            count: result.rows.length,
            projects: result.rows
        });
    } catch (error) {
    console.error("Failed to retrieve projects:", error);

    res.status(500).json({
        success: false,
        error: error.message
    });
}
});

module.exports = router;
