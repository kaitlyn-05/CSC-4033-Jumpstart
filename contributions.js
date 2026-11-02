const express = require("express");
const sql = require("mssql");
const router = express.Router({ mergeParams: true });

// Mounted at /api/projects/:id/contributors by projects.js.
// Also supports /api/contributors/:id through the existing server mount.
async function readContributors(req, res) {
    const id = req.params.id;
    if (!/^\d+$/.test(String(id)) || Number(id) < 1 || Number(id) > 2147483647) {
        return res.status(400).json({ success: false, error: "Invalid project ID." });
    }
    try {
        const pool = await req.app.locals.getPool();
        const project = await pool.request().input("id", sql.Int, Number(id))
            .query("SELECT project_id FROM dbo.projects WHERE project_id = @id;");
        if (!project.recordset.length) {
            return res.status(404).json({ success: false, error: "Project not found." });
        }
        const result = await pool.request().input("id", sql.Int, Number(id)).query(`
            SELECT u.user_id, u.username, pc.hours_committed, pc.hours_completed, pc.status
            FROM dbo.project_contributions pc
            INNER JOIN dbo.users u ON u.user_id = pc.user_id
            WHERE pc.project_id = @id AND pc.status <> 'withdrawn'
            ORDER BY u.username, u.user_id;
            SELECT COALESCE(SUM(hours_committed), 0) AS total_hours_committed,
                   COALESCE(SUM(hours_completed), 0) AS total_hours_completed
            FROM dbo.project_contributions
            WHERE project_id = @id AND status <> 'withdrawn';
        `);
        res.json({ success: true, contributors: result.recordsets[0], ...result.recordsets[1][0] });
    } catch (error) {
        console.error("Failed to retrieve contributors:", error);
        res.status(500).json({ success: false, error: "Failed to retrieve contributors." });
    }
}
router.get("/", readContributors);
router.get("/:id", readContributors);
module.exports = router;
