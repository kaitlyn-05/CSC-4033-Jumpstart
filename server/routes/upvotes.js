
const express = require("express");
const sql = require("mssql");
const authenticateToken = require("../middleware/auth");

const router = express.Router();

async function getDatabase(req) {
    return await req.app.locals.getPool();
}

function isValidId(id) {
    return Number.isInteger(Number(id)) && Number(id) > 0;
}

// GET upvote count and current user's vote status
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

        const result = await pool.request()
            .input("projectId", sql.Int, Number(projectId))
            .query(`
                SELECT COUNT(*) AS upvote_count
                FROM dbo.project_upvotes
                WHERE project_id = @projectId;
            `);

        res.json({
            success: true,
            project_id: Number(projectId),
            upvote_count: result.recordset[0].upvote_count
        });

    } catch (error) {
        console.error("Get upvotes error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to retrieve upvotes."
        });
    }
});

// ADD an upvote
router.post("/project/:projectId", authenticateToken, async (req, res) => {
    try {
        const { projectId } = req.params;
        const userId = req.user.user_id;

        if (!isValidId(projectId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid project ID."
            });
        }

        const pool = await getDatabase(req);

        const result = await pool.request()
            .input("projectId", sql.Int, Number(projectId))
            .input("userId", sql.Int, userId)
            .query(`
                IF NOT EXISTS (
                    SELECT 1 FROM dbo.projects
                    WHERE project_id = @projectId
                )
                    THROW 50001, 'Project not found.', 1;

                IF NOT EXISTS (
                    SELECT 1 FROM dbo.project_upvotes
                    WHERE project_id = @projectId
                      AND user_id = @userId
                )
                BEGIN
                    INSERT INTO dbo.project_upvotes
                        (user_id, project_id)
                    VALUES
                        (@userId, @projectId);
                END;

                SELECT COUNT(*) AS upvote_count
                FROM dbo.project_upvotes
                WHERE project_id = @projectId;
            `);

        res.json({
            success: true,
            message: "Upvote recorded.",
            upvote_count: result.recordset[0].upvote_count
        });

    } catch (error) {
        console.error("Add upvote error:", error);

        res.status(error.number === 50001 ? 404 : 500).json({
            success: false,
            message: error.number === 50001
                ? "Project not found."
                : "Unable to add upvote."
        });
    }
});

// REMOVE an upvote
router.delete("/project/:projectId", authenticateToken, async (req, res) => {
    try {
        const { projectId } = req.params;
        const userId = req.user.user_id;

        if (!isValidId(projectId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid project ID."
            });
        }

        const pool = await getDatabase(req);

        const result = await pool.request()
            .input("projectId", sql.Int, Number(projectId))
            .input("userId", sql.Int, userId)
            .query(`
                DELETE FROM dbo.project_upvotes
                WHERE project_id = @projectId
                  AND user_id = @userId;

                SELECT COUNT(*) AS upvote_count
                FROM dbo.project_upvotes
                WHERE project_id = @projectId;
            `);

        res.json({
            success: true,
            upvote_count: result.recordset[0].upvote_count
        });

    } catch (error) {
        console.error("Remove upvote error:", error);
        res.status(500).json({
            success: false,
        });
    }
});

module.exports = router;
