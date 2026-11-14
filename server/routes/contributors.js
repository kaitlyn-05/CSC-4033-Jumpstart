
const express = require("express");
const sql = require("mssql");

const router = express.Router();

async function getDatabase(req) {
    return await req.app.locals.getPool();
}

function isValidId(id) {
    return Number.isInteger(Number(id)) && Number(id) > 0;
}

// GET contributors for a project
router.get("/project/:projectId", async (req, res) => {
    try {
        const { projectId } = req.params;

        if (!isValidId(projectId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid project ID."
            });
        }

        const pool = await getDatabase(req);

        // Check that the project exists
        const project = await pool.request()
            .input("projectId", sql.Int, Number(projectId))
            .query(`
                SELECT project_id
                FROM dbo.projects
                WHERE project_id = @projectId;
            `);

        if (project.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Project not found."
            });
        }

        // Retrieve contributor summaries
        const result = await pool.request()
            .input("projectId", sql.Int, Number(projectId))
            .query(`
                SELECT
                    u.user_id,
                    u.username,
                    SUM(c.hours_committed) AS total_hours_committed,
                    SUM(c.hours_completed) AS total_hours_completed,
                    COUNT(c.contribution_id) AS contribution_count
                FROM dbo.project_contributions c
                INNER JOIN dbo.users u
                    ON c.user_id = u.user_id
                WHERE c.project_id = @projectId
                  AND c.status IN ('active', 'completed')
                GROUP BY
                    u.user_id,
                    u.username
                ORDER BY total_hours_completed DESC,
                         total_hours_committed DESC;
            `);

        res.json({
            success: true,
            project_id: Number(projectId),
            contributor_count: result.recordset.length,
            contributors: result.recordset
        });

    } catch (error) {
        console.error("Get contributors error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to retrieve project contributors."
        });
    }
});

module.exports = router;
