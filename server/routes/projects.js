
const express = require("express");
const router = express.Router();

// Get all projects
router.get("/", async (req, res) => {
    try {
        const pool = req.app.locals.getPool;

        const result = await pool.request().query(`
            SELECT
                p.project_id,
                p.project_name,
                p.description,
                p.goal_hours,
                p.status,
                p.created_at,
                u.username,
                c.category_name
            FROM dbo.projects AS p
            INNER JOIN dbo.users AS u
                ON p.owner_id = u.user_id
            LEFT JOIN dbo.project_categories AS c
                ON p.category_id = c.category_id
            ORDER BY p.created_at DESC;
        `);

        res.json({
            success: true,
            count: result.recordset.length,
            projects: result.recordset
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
