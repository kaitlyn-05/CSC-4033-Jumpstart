
const express = require("express");
const sql = require("mssql");
const authenticateToken = require("../middleware/auth");

const router = express.Router();

async function getDatabase(req) {
    return await req.app.locals.getPool();
}

// Record that the authenticated user is currently active
router.post("/heartbeat", authenticateToken, async (req, res) => {
    try {
        const userId = req.user.user_id;
        const pool = await getDatabase(req);

        await pool.request()
            .input("user_id", sql.Int, userId)
            .query(`
                MERGE dbo.active_user_sessions AS target
                USING (SELECT @user_id AS user_id) AS source
                ON target.user_id = source.user_id

                WHEN MATCHED THEN
                    UPDATE SET last_seen_at = SYSUTCDATETIME()

                WHEN NOT MATCHED THEN
                    INSERT (user_id, last_seen_at)
                    VALUES (source.user_id, SYSUTCDATETIME());
            `);

        res.json({
            success: true,
            message: "User activity updated"
        });

    } catch (error) {
        console.error("Heartbeat error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update user activity"
        });
    }
});

// Return the number of authenticated users active within five minutes
router.get("/concurrent", authenticateToken, async (req, res) => {
    try {
        const pool = await getDatabase(req);

        const result = await pool.request().query(`
            SELECT COUNT(*) AS concurrent_users
            FROM dbo.active_user_sessions
            WHERE last_seen_at >= DATEADD(
                MINUTE, -5, SYSUTCDATETIME()
            );
        `);

        res.json({
            success: true,
            concurrent_users: result.recordset[0].concurrent_users
        });

    } catch (error) {
        console.error("Concurrent users error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to retrieve concurrent users"
        });
    }
});

module.exports = router;
