
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

// GET upvote and downvote counts
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
                SELECT
                    COALESCE(SUM(
                        CASE WHEN vote_type = 'upvote' THEN 1 ELSE 0 END
                    ), 0) AS upvote_count,

                    COALESCE(SUM(
                        CASE WHEN vote_type = 'downvote' THEN 1 ELSE 0 END
                    ), 0) AS downvote_count

                FROM dbo.project_votes
                WHERE project_id = @projectId;
            `);

        res.json({
            success: true,
            project_id: Number(projectId),
            upvote_count: result.recordset[0].upvote_count,
            downvote_count: result.recordset[0].downvote_count
        });

    } catch (error) {
        console.error("Get votes error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to retrieve votes."
        });
    }
});

// ADD or CHANGE a vote
router.post("/project/:projectId", authenticateToken, async (req, res) => {
    try {
        const { projectId } = req.params;
        const userId = req.user.user_id;
        const { vote_type } = req.body;

        if (!isValidId(projectId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid project ID."
            });
        }

        if (!["upvote", "downvote"].includes(vote_type)) {
            return res.status(400).json({
                success: false,
                message: "Vote type must be upvote or downvote."
            });
        }

        const pool = await getDatabase(req);

        const result = await pool.request()
            .input("projectId", sql.Int, Number(projectId))
            .input("userId", sql.Int, userId)
            .input("voteType", sql.NVarChar(10), vote_type)
            .query(`
                IF NOT EXISTS (
                    SELECT 1
                    FROM dbo.projects
                    WHERE project_id = @projectId
                )
                    THROW 50001, 'Project not found.', 1;

                UPDATE dbo.project_votes
                SET
                    vote_type = @voteType,
                    created_at = SYSUTCDATETIME()
                WHERE project_id = @projectId
                  AND user_id = @userId;

                IF @@ROWCOUNT = 0
                BEGIN
                    INSERT INTO dbo.project_votes
                        (user_id, project_id, vote_type)
                    VALUES
                        (@userId, @projectId, @voteType);
                END;

                SELECT
                    COALESCE(SUM(
                        CASE WHEN vote_type = 'upvote' THEN 1 ELSE 0 END
                    ), 0) AS upvote_count,

                    COALESCE(SUM(
                        CASE WHEN vote_type = 'downvote' THEN 1 ELSE 0 END
                    ), 0) AS downvote_count

                FROM dbo.project_votes
                WHERE project_id = @projectId;
            `);

        res.json({
            success: true,
            message: "Vote recorded successfully.",
            project_id: Number(projectId),
            user_vote: vote_type,
            upvote_count: result.recordset[0].upvote_count,
            downvote_count: result.recordset[0].downvote_count
        });

    } catch (error) {
        console.error("Record vote error:", error);

        res.status(error.number === 50001 ? 404 : 500).json({
            success: false,
            message: error.number === 50001
                ? "Project not found."
                : "Unable to record vote."
        });
    }
});

// REMOVE the current user's vote
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
                DELETE FROM dbo.project_votes
                WHERE project_id = @projectId
                  AND user_id = @userId;

                SELECT
                    COALESCE(SUM(
                        CASE WHEN vote_type = 'upvote' THEN 1 ELSE 0 END
                    ), 0) AS upvote_count,

                    COALESCE(SUM(
                        CASE WHEN vote_type = 'downvote' THEN 1 ELSE 0 END
                    ), 0) AS downvote_count

                FROM dbo.project_votes
                WHERE project_id = @projectId;
            `);

        res.json({
            success: true,
            message: "Vote removed.",
            upvote_count: result.recordset[0].upvote_count,
            downvote_count: result.recordset[0].downvote_count
        });

    } catch (error) {
        console.error("Remove vote error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to remove vote."
        });
    }
});

module.exports = router;
