
const express = require("express");
const sql = require("mssql");

const router = express.Router();

async function getDatabase(req) {
    return await req.app.locals.getPool();
}

function isValidId(id) {
    return Number.isInteger(Number(id)) && Number(id) > 0;
}

// GET all comments for a project, including replies
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
                    c.comment_id,
                    c.project_id,
                    c.commenter_id,
                    u.username,
                    c.parent_comment_id,
                    c.comment_text,
                    c.created_at,
                    c.updated_at
                FROM dbo.project_comments c
                INNER JOIN dbo.users u
                    ON c.commenter_id = u.user_id
                WHERE c.project_id = @projectId
                ORDER BY c.created_at ASC;
            `);

        res.json({
            success: true,
            comments: result.recordset
        });

    } catch (error) {
        console.error("Get project comments error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to retrieve comments."
        });
    }
});

// GET one comment
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid comment ID."
            });
        }

        const pool = await getDatabase(req);

        const result = await pool.request()
            .input("id", sql.Int, Number(id))
            .query(`
                SELECT
                    c.comment_id,
                    c.project_id,
                    c.commenter_id,
                    u.username,
                    c.parent_comment_id,
                    c.comment_text,
                    c.created_at,
                    c.updated_at
                FROM dbo.project_comments c
                INNER JOIN dbo.users u
                    ON c.commenter_id = u.user_id
                WHERE c.comment_id = @id;
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Comment not found."
            });
        }

        res.json({
            success: true,
            comment: result.recordset[0]
        });

    } catch (error) {
        console.error("Get comment error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to retrieve comment."
        });
    }
});

// CREATE a top-level comment
router.post("/", async (req, res) => {
    try {
        const { project_id, commenter_id, comment_text } = req.body;

        if (!isValidId(project_id) || !isValidId(commenter_id)) {
            return res.status(400).json({
                success: false,
                message: "Valid project_id and commenter_id are required."
            });
        }

        if (
            typeof comment_text !== "string" ||
            comment_text.trim().length === 0 ||
            comment_text.trim().length > 2000
        ) {
            return res.status(400).json({
                success: false,
                message: "Comment must contain between 1 and 2000 characters."
            });
        }

        const pool = await getDatabase(req);

        const result = await pool.request()
            .input("projectId", sql.Int, Number(project_id))
            .input("commenterId", sql.Int, Number(commenter_id))
            .input("commentText", sql.NVarChar(2000), comment_text.trim())
            .query(`
                IF NOT EXISTS (
                    SELECT 1
                    FROM dbo.projects
                    WHERE project_id = @projectId
                )
                    THROW 50001, 'Project not found.', 1;

                IF NOT EXISTS (
                    SELECT 1
                    FROM dbo.users
                    WHERE user_id = @commenterId
                      AND status = 'active'
                )
                    THROW 50002, 'Active user not found.', 1;

                INSERT INTO dbo.project_comments
                    (project_id, commenter_id, comment_text)
                OUTPUT
                    INSERTED.comment_id,
                    INSERTED.project_id,
                    INSERTED.commenter_id,
                    INSERTED.parent_comment_id,
                    INSERTED.comment_text,
                    INSERTED.created_at,
                    INSERTED.updated_at
                VALUES
                    (@projectId, @commenterId, @commentText);
            `);

        res.status(201).json({
            success: true,
            message: "Comment created successfully.",
            comment: result.recordset[0]
        });

    } catch (error) {
        console.error("Create comment error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to create comment."
        });
    }
});

// REPLY to an existing comment
router.post("/:id/replies", async (req, res) => {
    try {
        const { id } = req.params;
        const { commenter_id, comment_text } = req.body;

        if (!isValidId(id) || !isValidId(commenter_id)) {
            return res.status(400).json({
                success: false,
                message: "Valid comment ID and commenter_id are required."
            });
        }

        if (
            typeof comment_text !== "string" ||
            comment_text.trim().length === 0 ||
            comment_text.trim().length > 2000
        ) {
            return res.status(400).json({
                success: false,
                message: "Reply must contain between 1 and 2000 characters."
            });
        }

        const pool = await getDatabase(req);

        const result = await pool.request()
            .input("parentId", sql.Int, Number(id))
            .input("commenterId", sql.Int, Number(commenter_id))
            .input("commentText", sql.NVarChar(2000), comment_text.trim())
            .query(`
                IF NOT EXISTS (
                    SELECT 1
                    FROM dbo.project_comments
                    WHERE comment_id = @parentId
                )
                    THROW 50001, 'Parent comment not found.', 1;

                IF NOT EXISTS (
                    SELECT 1
                    FROM dbo.users
                    WHERE user_id = @commenterId
                      AND status = 'active'
                )
                    THROW 50002, 'Active user not found.', 1;

                INSERT INTO dbo.project_comments
                    (project_id, commenter_id, parent_comment_id, comment_text)
                SELECT
                    project_id,
                    @commenterId,
                    comment_id,
                    @commentText
                FROM dbo.project_comments
                WHERE comment_id = @parentId;

                SELECT
                    c.comment_id,
                    c.project_id,
                    c.commenter_id,
                    u.username,
                    c.parent_comment_id,
                    c.comment_text,
                    c.created_at,
                    c.updated_at
                FROM dbo.project_comments c
                INNER JOIN dbo.users u
                    ON c.commenter_id = u.user_id
                WHERE c.comment_id = SCOPE_IDENTITY();
            `);

        res.status(201).json({
            success: true,
            message: "Reply created successfully.",
            reply: result.recordset[0]
        });

    } catch (error) {
        console.error("Create reply error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to create reply."
        });
    }
});

// UPDATE an existing comment
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { commenter_id, comment_text } = req.body;

        if (!isValidId(id) || !isValidId(commenter_id)) {
            return res.status(400).json({
                success: false,
                message: "Valid comment ID and commenter_id are required."
            });
        }

        if (
            typeof comment_text !== "string" ||
            comment_text.trim().length === 0 ||
            comment_text.trim().length > 2000
        ) {
            return res.status(400).json({
                success: false,
                message: "Comment must contain between 1 and 2000 characters."
            });
        }

        const pool = await getDatabase(req);

        const result = await pool.request()
            .input("id", sql.Int, Number(id))
            .input("commenterId", sql.Int, Number(commenter_id))
            .input("commentText", sql.NVarChar(2000), comment_text.trim())
            .query(`
                UPDATE dbo.project_comments
                SET
                    comment_text = @commentText,
                    updated_at = SYSUTCDATETIME()
                OUTPUT
                    INSERTED.comment_id,
                    INSERTED.project_id,
                    INSERTED.commenter_id,
                    INSERTED.parent_comment_id,
                    INSERTED.comment_text,
                    INSERTED.created_at,
                    INSERTED.updated_at
                WHERE comment_id = @id
                  AND commenter_id = @commenterId;
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Comment not found or you are not its owner."
            });
        }

        res.json({
            success: true,
            message: "Comment updated successfully.",
            comment: result.recordset[0]
        });

    } catch (error) {
        console.error("Update comment error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to update comment."
        });
    }
});

module.exports = router;
