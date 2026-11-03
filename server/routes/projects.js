
const express = require("express");
const sql = require("mssql");

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

// Format errors consistently.
function handleError(res, error, operation) {
    console.error(`${operation} failed:`, error);

    res.status(500).json({
        success: false,
        error: `${operation} failed.`,
        details: error.message
    });
}

// GET /api/projects
// Retrieve projects with search, filters, sorting, and pagination.
router.get("/", async (req, res) => {
    try {
        const pool = await getDatabase(req);

        const {
            search,
            status,
            category_id,
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

        const conditions = [];

        const request = pool.request();

        if (search) {
            request.input(
                "search",
                sql.NVarChar(255),
                `%${String(search).trim()}%`
            );

            conditions.push(
                "(p.project_name LIKE @search OR p.description LIKE @search)"
            );
        }

        if (status) {
            request.input("status", sql.NVarChar(30), status);
            conditions.push("p.status = @status");
        }

        if (category_id !== undefined) {
            if (!isPositiveInteger(category_id)) {
                return res.status(400).json({
                    success: false,
                    error: "Invalid category ID."
                });
            }

            request.input(
                "category_id",
                sql.Int,
                Number(category_id)
            );

            conditions.push("p.category_id = @category_id");
        }

        const whereClause = conditions.length
            ? "WHERE " + conditions.join(" AND ")
            : "";

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

        const offset = (pageNumber - 1) * pageLimit;

        request.input("offset", sql.Int, offset);
        request.input("limit", sql.Int, pageLimit);

        const result = await request.query(`
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
                c.category_name
            FROM dbo.projects AS p
            INNER JOIN dbo.users AS u
                ON p.owner_id = u.user_id
            LEFT JOIN dbo.project_categories AS c
                ON p.category_id = c.category_id
            ${whereClause}
            ORDER BY ${sortOptions[sort]}
            OFFSET @offset ROWS
            FETCH NEXT @limit ROWS ONLY;
        `);

        const countRequest = pool.request();

        if (search) {
            countRequest.input(
                "search",
                sql.NVarChar(255),
                `%${String(search).trim()}%`
            );
        }

        if (status) {
            countRequest.input("status", sql.NVarChar(30), status);
        }

        if (category_id !== undefined) {
            countRequest.input(
                "category_id",
                sql.Int,
                Number(category_id)
            );
        }

        const countResult = await countRequest.query(`
            SELECT COUNT(*) AS total
            FROM dbo.projects AS p
            INNER JOIN dbo.users AS u
                ON p.owner_id = u.user_id
            LEFT JOIN dbo.project_categories AS c
                ON p.category_id = c.category_id
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
router.get("/:id", async (req, res) => {
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
            .query(`
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
                    c.category_name
                FROM dbo.projects AS p
                INNER JOIN dbo.users AS u
                    ON p.owner_id = u.user_id
                LEFT JOIN dbo.project_categories AS c
                    ON p.category_id = c.category_id
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
router.post("/", async (req, res) => {
    try {
        const {
            project_name,
            description,
            goal_hours,
            owner_id,
            category_id
        } = req.body;

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
router.put("/:id", async (req, res) => {
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
            !isPositiveInteger(owner_id) ||
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
            .input("owner_id", sql.Int, Number(owner_id))
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
router.patch("/:id/cancel", async (req, res) => {
    try {
        const projectId = Number(req.params.id);
        const ownerId = Number(req.body.owner_id);

        if (
            !isPositiveInteger(projectId) ||
            !isPositiveInteger(ownerId)
        ) {
            return res.status(400).json({
                success: false,
                error: "Valid project ID and owner ID are required."
            });
        }

        const pool = await getDatabase(req);

        const result = await pool.request()
            .input("project_id", sql.Int, projectId)
            .input("owner_id", sql.Int, ownerId)
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

module.exports = router;
