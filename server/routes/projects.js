
const express = require("express");
const sql = require("mssql");
const authenticateToken = require("../middleware/auth");
const router = express.Router();

// Validate positive integer IDs.
function isPositiveInteger(value) {
    return Number.isInteger(Number(value)) && Number(value) > 0;
}

// Validate positive hour amounts.
function isPositiveHours(value) {
    return (
        value !== undefined &&
        value !== null &&
        value !== "" &&
        Number.isFinite(Number(value)) &&
        Number(value) > 0
    );
}

// Get the database connection.
async function getDatabase(req) {
    if (!req.app.locals.getPool) {
        throw new Error("Database connection function is not configured.");
    }

    return await req.app.locals.getPool();
}

// Format errors consistently. The full error is logged, not sent to the browser.
function handleError(res, error, operation) {
    console.error(`${operation} failed:`, error);

    res.status(500).json({
        success: false,
        error: `${operation} failed.`
    });
}

// Columns returned for every project, including pledge, like, and comment totals.
// @current_user_id is NULL when nobody is logged in.
const PROJECT_SELECT = `
    SELECT
        p.project_id,
        p.project_name,
        p.description,
        p.goal_hours,
        p.status,
        p.created_at,
        p.updated_at,
        p.owner_id,
        p.category_id,
        u.username,
        c.category_name,
        h.total_hours_committed,
        h.total_hours_completed,
        h.contributor_count,
        (
            SELECT COUNT(*)
            FROM dbo.project_upvotes AS uv
            WHERE uv.project_id = p.project_id
        ) AS upvote_count,
        (
            SELECT COUNT(*)
            FROM dbo.project_comments AS pc
            WHERE pc.project_id = p.project_id
        ) AS comment_count,
        CAST(
            CASE WHEN EXISTS (
                SELECT 1
                FROM dbo.project_upvotes AS uv
                WHERE uv.project_id = p.project_id
                  AND uv.user_id = @current_user_id
            ) THEN 1 ELSE 0 END
        AS BIT) AS user_has_upvoted
    FROM dbo.projects AS p
    INNER JOIN dbo.users AS u
        ON p.owner_id = u.user_id
    LEFT JOIN dbo.project_categories AS c
        ON p.category_id = c.category_id
    OUTER APPLY (
        SELECT
            COALESCE(SUM(pc.hours_committed), 0) AS total_hours_committed,
            COALESCE(SUM(pc.hours_completed), 0) AS total_hours_completed,
            COUNT(*) AS contributor_count
        FROM dbo.project_contributions AS pc
        WHERE pc.project_id = p.project_id
          AND pc.status IN ('active', 'completed')
    ) AS h
`;

// The logged-in user's ID, or null for visitors.
function currentUserId(req) {
    return req.user && isPositiveInteger(req.user.user_id)
        ? Number(req.user.user_id)
        : null;
}

// GET /api/projects
// Retrieve projects with search, filters, sorting, and pagination.
router.get("/", authenticateToken.optional, async (req, res) => {
    try {
        const pool = await getDatabase(req);

        const {
            search,
            status,
            category_id,
            owner_id,
            sort = "newest",
            page = "1",
            limit = "10"
        } = req.query;

        const pageNumber = Number(page);
        const pageLimit = Number(limit);

        if (
            !Number.isInteger(pageNumber) ||
            pageNumber < 1 ||
            !Number.isInteger(pageLimit) ||
            pageLimit < 1 ||
            pageLimit > 100
        ) {
            return res.status(400).json({
                success: false,
                error: "Invalid page or limit."
            });
        }

        if (category_id !== undefined && !isPositiveInteger(category_id)) {
            return res.status(400).json({
                success: false,
                error: "Invalid category ID."
            });
        }

        if (owner_id !== undefined && !isPositiveInteger(owner_id)) {
            return res.status(400).json({
                success: false,
                error: "Invalid owner ID."
            });
        }

        const sortOptions = {
            newest: "p.created_at DESC",
            oldest: "p.created_at ASC",
            name: "p.project_name ASC",
            goal: "p.goal_hours DESC"
        };

        if (!sortOptions[sort]) {
            return res.status(400).json({
                success: false,
                error: "Invalid sort option."
            });
        }

        // Build the filters once and apply them to both queries below.
        const conditions = [];
        const filters = [];

        if (search) {
            conditions.push(
                "(p.project_name LIKE @search OR p.description LIKE @search)"
            );
            filters.push(["search", sql.NVarChar(255), `%${String(search).trim()}%`]);
        }

        if (status) {
            conditions.push("p.status = @status");
            filters.push(["status", sql.NVarChar(30), String(status)]);
        }

        if (category_id !== undefined) {
            conditions.push("p.category_id = @category_id");
            filters.push(["category_id", sql.Int, Number(category_id)]);
        }

        if (owner_id !== undefined) {
            conditions.push("p.owner_id = @owner_id");
            filters.push(["owner_id", sql.Int, Number(owner_id)]);
        }

        const whereClause = conditions.length
            ? "WHERE " + conditions.join(" AND ")
            : "";

        const request = pool.request();
        const countRequest = pool.request();

        for (const [name, type, value] of filters) {
            request.input(name, type, value);
            countRequest.input(name, type, value);
        }

        request.input("current_user_id", sql.Int, currentUserId(req));
        request.input("offset", sql.Int, (pageNumber - 1) * pageLimit);
        request.input("limit", sql.Int, pageLimit);

        const result = await request.query(`
            ${PROJECT_SELECT}
            ${whereClause}
            ORDER BY ${sortOptions[sort]}
            OFFSET @offset ROWS
            FETCH NEXT @limit ROWS ONLY;
        `);

        const countResult = await countRequest.query(`
            SELECT COUNT(*) AS total
            FROM dbo.projects AS p
            ${whereClause};
        `);

        const total = Number(countResult.recordset[0].total);

        res.json({
            success: true,
            count: result.recordset.length,
            total,
            page: pageNumber,
            totalPages: Math.ceil(total / pageLimit),
            projects: result.recordset
        });

    } catch (error) {
        handleError(res, error, "Retrieve projects");
    }
});

// GET /api/projects/:id
// Retrieve an individual project.
router.get("/:id", authenticateToken.optional, async (req, res) => {
    try {
        const projectId = Number(req.params.id);

        if (!isPositiveInteger(projectId)) {
            return res.status(400).json({
                success: false,
                error: "Invalid project ID."
            });
        }

        const pool = await getDatabase(req);

        const result = await pool.request()
            .input("project_id", sql.Int, projectId)
            .input("current_user_id", sql.Int, currentUserId(req))
            .query(`
                ${PROJECT_SELECT}
                WHERE p.project_id = @project_id;
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                error: "Project not found."
            });
        }

        res.json({
            success: true,
            project: result.recordset[0]
        });

    } catch (error) {
        handleError(res, error, "Retrieve project");
    }
});

// POST /api/projects
// Create a project.
router.post("/", authenticateToken, async (req, res) => {
    try {
        const {
            project_name,
            description,
            goal_hours,
            category_id
        } = req.body;
        // Get the owner ID from the verified login token.
        const owner_id = req.user.user_id;
        if (
            typeof project_name !== "string" ||
            !project_name.trim() ||
            project_name.trim().length > 255 ||
            typeof (description ?? "") !== "string" ||
            !isPositiveHours(goal_hours) ||
            !isPositiveInteger(owner_id)
        ) {
            return res.status(400).json({
                success: false,
                error: "Provide a project name, description, positive goal hours, and valid owner ID."
            });
        }

        const categoryId =
            category_id === undefined ||
            category_id === null ||
            category_id === ""
                ? null
                : Number(category_id);

        if (
            categoryId !== null &&
            !isPositiveInteger(categoryId)
        ) {
            return res.status(400).json({
                success: false,
                error: "Invalid category ID."
            });
        }

        const pool = await getDatabase(req);

        const result = await pool.request()
            .input(
                "project_name",
                sql.NVarChar(255),
                project_name.trim()
            )
            .input(
                "description",
                sql.NVarChar(sql.MAX),
                description ?? ""
            )
            .input(
                "goal_hours",
                sql.Decimal(7, 2),
                Number(goal_hours)
            )
            .input("owner_id", sql.Int, Number(owner_id))
            .input("category_id", sql.Int, categoryId)
            .query(`
                INSERT INTO dbo.projects
                    (
                        project_name,
                        description,
                        goal_hours,
                        owner_id,
                        category_id,
                        status
                    )
                OUTPUT INSERTED.*
                VALUES
                    (
                        @project_name,
                        @description,
                        @goal_hours,
                        @owner_id,
                        @category_id,
                        'open'
                    );
            `);

        res.status(201).json({
            success: true,
            message: "Project created successfully.",
            project: result.recordset[0]
        });

    } catch (error) {
        handleError(res, error, "Create project");
    }
});

// PUT /api/projects/:id
// Update a project.
router.put("/:id", authenticateToken, async (req, res) => {
    try {
        const projectId = Number(req.params.id);

        const {
            project_name,
            description,
            goal_hours,
            owner_id,
            category_id
        } = req.body;

        if (
            !isPositiveInteger(projectId) ||
            typeof project_name !== "string" ||
            !project_name.trim() ||
            project_name.trim().length > 255 ||
            typeof (description ?? "") !== "string" ||
            !isPositiveHours(goal_hours)
        ) {
            return res.status(400).json({
                success: false,
                error: "Invalid project information."
            });
        }

        const categoryId =
            category_id === undefined ||
            category_id === null ||
            category_id === ""
                ? null
                : Number(category_id);

        if (
            categoryId !== null &&
            !isPositiveInteger(categoryId)
        ) {
            return res.status(400).json({
                success: false,
                error: "Invalid category ID."
            });
        }

        const pool = await getDatabase(req);

        const result = await pool.request()
            .input("project_id", sql.Int, projectId)
            .input("project_name", sql.NVarChar(255), project_name.trim())
            .input("description", sql.NVarChar(sql.MAX), description ?? "")
            .input("goal_hours", sql.Decimal(7, 2), Number(goal_hours))
            .input("owner_id", sql.Int, req.user.user_id)
            .input("category_id", sql.Int, categoryId)
            .query(`
                UPDATE dbo.projects
                SET
                    project_name = @project_name,
                    description = @description,
                    goal_hours = @goal_hours,
                    category_id = @category_id,
                    updated_at = SYSUTCDATETIME()
                OUTPUT INSERTED.*
                WHERE project_id = @project_id
                  AND owner_id = @owner_id;
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                error: "Project not found or does not belong to this owner."
            });
        }

        res.json({
            success: true,
            message: "Project updated successfully.",
            project: result.recordset[0]
        });

    } catch (error) {
        handleError(res, error, "Update project");
    }
});

// PATCH /api/projects/:id/cancel
// Cancel a project.
router.patch("/:id/cancel", authenticateToken, async (req, res) => {
    try {
        const projectId = Number(req.params.id);
        

        if (!isPositiveInteger(projectId)) {
            return res.status(400).json({
                success: false,
                error: "Valid project ID is required."
            });
        }

        const pool = await getDatabase(req);

        const result = await pool.request()
            .input("project_id", sql.Int, projectId)
            .input("owner_id", sql.Int, req.user.user_id)
            .query(`
                UPDATE dbo.projects
                SET
                    status = 'cancelled',
                    updated_at = SYSUTCDATETIME()
                OUTPUT INSERTED.*
                WHERE project_id = @project_id
                  AND owner_id = @owner_id;
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                error: "Project not found or does not belong to this owner."
            });
        }

        res.json({
            success: true,
            message: "Project cancelled successfully.",
            project: result.recordset[0]
        });

    } catch (error) {
        handleError(res, error, "Cancel project");
    }
});

// DELETE /api/projects/:id
// Permanently delete a project and everything attached to it. Owner only.
router.delete("/:id", authenticateToken, async (req, res) => {
    try {
        const projectId = Number(req.params.id);

        if (!isPositiveInteger(projectId)) {
            return res.status(400).json({
                success: false,
                error: "Valid project ID is required."
            });
        }

        const pool = await getDatabase(req);

        // Remove the child rows first so the delete works whether or not
        // the database cascades them. XACT_ABORT rolls everything back on error.
        await pool.request()
            .input("project_id", sql.Int, projectId)
            .input("owner_id", sql.Int, req.user.user_id)
            .query(`
                SET XACT_ABORT ON;

                IF NOT EXISTS (
                    SELECT 1 FROM dbo.projects
                    WHERE project_id = @project_id
                )
                    THROW 50001, 'Project not found.', 1;

                IF NOT EXISTS (
                    SELECT 1 FROM dbo.projects
                    WHERE project_id = @project_id
                      AND owner_id = @owner_id
                )
                    THROW 50002, 'Only the project owner can delete this project.', 1;

                BEGIN TRANSACTION;

                DELETE FROM dbo.contribution_history
                WHERE contribution_id IN (
                    SELECT contribution_id
                    FROM dbo.project_contributions
                    WHERE project_id = @project_id
                );

                DELETE FROM dbo.project_contributions
                WHERE project_id = @project_id;

                DELETE FROM dbo.project_upvotes
                WHERE project_id = @project_id;

                -- Only present if the downvotes feature's table was created.
                IF OBJECT_ID('dbo.project_votes', 'U') IS NOT NULL
                    DELETE FROM dbo.project_votes
                    WHERE project_id = @project_id;

                -- Comments and their replies go in one statement.
                DELETE FROM dbo.project_comments
                WHERE project_id = @project_id;

                DELETE FROM dbo.project_files
                WHERE project_id = @project_id;

                DELETE FROM dbo.projects
                WHERE project_id = @project_id;

                COMMIT TRANSACTION;
            `);

        res.json({
            success: true,
            message: "Project deleted successfully.",
            project_id: projectId
        });

    } catch (error) {
        const knownErrors = {
            50001: [404, "Project not found."],
            50002: [403, "Only the project owner can delete this project."]
        };

        if (knownErrors[error.number]) {
            return res.status(knownErrors[error.number][0]).json({
                success: false,
                error: knownErrors[error.number][1]
            });
        }

        handleError(res, error, "Delete project");
    }
});

module.exports = router;
