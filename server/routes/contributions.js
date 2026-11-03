
const express = require("express");
const sql = require("mssql");

const router = express.Router();

async function getDatabase(req) {
    return await req.app.locals.getPool();
}

function isValidId(id) {
    return Number.isInteger(Number(id)) && Number(id) > 0;
}

function isValidHours(hours) {
    const value = Number(hours);
    return Number.isFinite(value) && value >= 0 && value <= 99999.99;
}

// GET all contributions
router.get("/", async (req, res) => {
    try {
        const pool = await getDatabase(req);

        const result = await pool.request().query(`
            SELECT
                c.contribution_id,
                c.project_id,
                c.user_id,
                u.username,
                c.hours_committed,
                c.hours_completed,
                c.status,
                c.committed_at,
                c.updated_at
            FROM dbo.project_contributions c
            INNER JOIN dbo.users u
                ON c.user_id = u.user_id
            ORDER BY c.committed_at DESC
        `);

        res.json({
            success: true,
            contributions: result.recordset
        });

    } catch (error) {
        console.error("Get contributions error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to retrieve contributions."
        });
    }
});

// GET contributions for a project
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
                    c.contribution_id,
                    c.project_id,
                    c.user_id,
                    u.username,
                    c.hours_committed,
                    c.hours_completed,
                    c.status,
                    c.committed_at,
                    c.updated_at
                FROM dbo.project_contributions c
                INNER JOIN dbo.users u
                    ON c.user_id = u.user_id
                WHERE c.project_id = @projectId
                ORDER BY c.committed_at DESC
            `);

        res.json({
            success: true,
            contributions: result.recordset
        });

    } catch (error) {
        console.error("Get project contributions error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to retrieve project contributions."
        });
    }
});

// GET contributions for a user
router.get("/user/:userId", async (req, res) => {
    try {
        const { userId } = req.params;

        if (!isValidId(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID."
            });
        }

        const pool = await getDatabase(req);

        const result = await pool.request()
            .input("userId", sql.Int, Number(userId))
            .query(`
                SELECT
                    c.contribution_id,
                    c.project_id,
                    p.project_name,
                    c.hours_committed,
                    c.hours_completed,
                    c.status,
                    c.committed_at,
                    c.updated_at
                FROM dbo.project_contributions c
                INNER JOIN dbo.projects p
                    ON c.project_id = p.project_id
                WHERE c.user_id = @userId
                ORDER BY c.committed_at DESC
            `);

        res.json({
            success: true,
            contributions: result.recordset
        });

    } catch (error) {
        console.error("Get user contributions error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to retrieve user contributions."
        });
    }
});

// CREATE a contribution
router.post("/", async (req, res) => {
    try {
        const { project_id, user_id, hours_committed } = req.body;

        if (!isValidId(project_id) || !isValidId(user_id)) {
            return res.status(400).json({
                success: false,
                message: "Valid project_id and user_id are required."
            });
        }

        if (!isValidHours(hours_committed) || Number(hours_committed) <= 0) {
            return res.status(400).json({
                success: false,
                message: "Committed hours must be greater than zero."
            });
        }

        const pool = await getDatabase(req);
        const transaction = new sql.Transaction(pool);

        await transaction.begin();

        try {
            const existing = await new sql.Request(transaction)
                .input("projectId", sql.Int, Number(project_id))
                .input("userId", sql.Int, Number(user_id))
                .query(`
                    SELECT project_id
                    FROM dbo.projects
                    WHERE project_id = @projectId
                      AND status = 'open';

                    SELECT user_id
                    FROM dbo.users
                    WHERE user_id = @userId
                      AND status = 'active';
                `);

            if (existing.recordsets[0].length === 0) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: "Project not found or is not open."
                });
            }

            if (existing.recordsets[1].length === 0) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: "Active user not found."
                });
            }

            const result = await new sql.Request(transaction)
                .input("projectId", sql.Int, Number(project_id))
                .input("userId", sql.Int, Number(user_id))
                .input("hours", sql.Decimal(7, 2), Number(hours_committed))
                .query(`
                    INSERT INTO dbo.project_contributions
                        (project_id, user_id, hours_committed)
                    OUTPUT
                        INSERTED.contribution_id,
                        INSERTED.project_id,
                        INSERTED.user_id,
                        INSERTED.hours_committed,
                        INSERTED.hours_completed,
                        INSERTED.status,
                        INSERTED.committed_at
                    VALUES
                        (@projectId, @userId, @hours);
                `);

            await transaction.commit();

            res.status(201).json({
                success: true,
                message: "Contribution created successfully.",
                contribution: result.recordset[0]
            });

        } catch (error) {
            await transaction.rollback();
            throw error;
        }

    } catch (error) {
        console.error("Create contribution error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to create contribution."
        });
    }
});

// UPDATE committed or completed hours
router.patch("/:id/hours", async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id, hours_type, hours } = req.body;

        if (!isValidId(id) || !isValidId(user_id)) {
            return res.status(400).json({
                success: false,
                message: "Valid contribution ID and user ID are required."
            });
        }

        if (!["committed", "completed"].includes(hours_type)) {
            return res.status(400).json({
                success: false,
                message: "hours_type must be committed or completed."
            });
        }

        if (!isValidHours(hours)) {
            return res.status(400).json({
                success: false,
                message: "Hours must be a valid non-negative number."
            });
        }

        const pool = await getDatabase(req);
        const transaction = new sql.Transaction(pool);

        await transaction.begin();

        try {
            const current = await new sql.Request(transaction)
                .input("id", sql.Int, Number(id))
                .input("userId", sql.Int, Number(user_id))
                .query(`
                    SELECT *
                    FROM dbo.project_contributions
                    WHERE contribution_id = @id
                      AND user_id = @userId;
                `);

            if (current.recordset.length === 0) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: "Contribution not found."
                });
            }

            const contribution = current.recordset[0];

            if (contribution.status !== "active") {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: "Only active contributions can be updated."
                });
            }

            const previousHours = Number(
                hours_type === "committed"
                    ? contribution.hours_committed
                    : contribution.hours_completed
            );

            const newHours = Number(Number(hours).toFixed(2));

            const committedHours = hours_type === "committed"
                ? newHours
                : Number(contribution.hours_committed);

            const completedHours = hours_type === "completed"
                ? newHours
                : Number(contribution.hours_completed);

            if (completedHours > committedHours) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: "Completed hours cannot exceed committed hours."
                });
            }

            const updated = await new sql.Request(transaction)
                .input("id", sql.Int, Number(id))
                .input("committed", sql.Decimal(7, 2), committedHours)
                .input("completed", sql.Decimal(7, 2), completedHours)
                .query(`
                    UPDATE dbo.project_contributions
                    SET
                        hours_committed = @committed,
                        hours_completed = @completed,
                        status = CASE
                            WHEN @committed > 0
                             AND @completed = @committed
                            THEN 'completed'
                            ELSE 'active'
                        END,
                        updated_at = SYSUTCDATETIME()
                    OUTPUT
                        INSERTED.contribution_id,
                        INSERTED.project_id,
                        INSERTED.user_id,
                        INSERTED.hours_committed,
                        INSERTED.hours_completed,
                        INSERTED.status,
                        INSERTED.updated_at
                    WHERE contribution_id = @id;
                `);

            await new sql.Request(transaction)
                .input("contributionId", sql.Int, Number(id))
                .input("changedBy", sql.Int, Number(user_id))
                .input("hoursType", sql.NVarChar(12), hours_type)
                .input("previousHours", sql.Decimal(7, 2), previousHours)
                .input("newHours", sql.Decimal(7, 2), newHours)
                .query(`
                    INSERT INTO dbo.contribution_history
                        (contribution_id, changed_by, hours_type,
                         previous_hours, new_hours)
                    VALUES
                        (@contributionId, @changedBy, @hoursType,
                         @previousHours, @newHours);
                `);

            await transaction.commit();

            res.json({
                success: true,
                message: "Contribution hours updated successfully.",
                contribution: updated.recordset[0]
            });

        } catch (error) {
            await transaction.rollback();
            throw error;
        }

    } catch (error) {
        console.error("Update contribution error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to update contribution hours."
        });
    }
});

// WITHDRAW a contribution
router.patch("/:id/withdraw", async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id } = req.body;

        if (!isValidId(id) || !isValidId(user_id)) {
            return res.status(400).json({
                success: false,
                message: "Valid contribution ID and user ID are required."
            });
        }

        const pool = await getDatabase(req);

        const result = await pool.request()
            .input("id", sql.Int, Number(id))
            .input("userId", sql.Int, Number(user_id))
            .query(`
                UPDATE dbo.project_contributions
                SET
                    status = 'withdrawn',
                    updated_at = SYSUTCDATETIME()
                OUTPUT
                    INSERTED.contribution_id,
                    INSERTED.status,
                    INSERTED.updated_at
                WHERE contribution_id = @id
                  AND user_id = @userId
                  AND status = 'active';
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Active contribution not found."
            });
        }

        res.json({
            success: true,
            message: "Contribution withdrawn successfully.",
            contribution: result.recordset[0]
        });

    } catch (error) {
        console.error("Withdraw contribution error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to withdraw contribution."
        });
    }
});

// GET contribution history
router.get("/:id/history", async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid contribution ID."
            });
        }

        const pool = await getDatabase(req);

        const result = await pool.request()
            .input("id", sql.Int, Number(id))
            .query(`
                SELECT
                    h.history_id,
                    h.contribution_id,
                    h.changed_by,
                    u.username,
                    h.hours_type,
                    h.previous_hours,
                    h.new_hours,
                    h.changed_at,
                    h.notes
                FROM dbo.contribution_history h
                INNER JOIN dbo.users u
                    ON h.changed_by = u.user_id
                WHERE h.contribution_id = @id
                ORDER BY h.changed_at DESC;
            `);

        res.json({
            success: true,
            history: result.recordset
        });

    } catch (error) {
        console.error("Get contribution history error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to retrieve contribution history."
        });
    }
});

module.exports = router;
