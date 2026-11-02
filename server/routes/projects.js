
  
const express = require("express");
const sql = require("mssql");

const router = express.Router();

// Get the database connection
async function getDatabase(req) {
    return await req.app.locals.getPool();
}

// Check whether an ID is a positive integer
function isPositiveInteger(value) {
    return (
        value !== undefined &&
        value !== null &&
        value !== "" &&
        Number.isInteger(Number(value)) &&
        Number(value) > 0
    );
}

// Check whether goal hours is a positive decimal number
function isPositiveNumber(value) {
    return (
        value !== undefined &&
        value !== null &&
        value !== "" &&
        Number.isFinite(Number(value)) &&
        Number(value) > 0 &&
        Number(value) <= 99999999.99
    );
}

// GET /api/projects
// Retrieve projects with optional search, filters, sorting, and pagination
router.get("/", async (req, res) => {
    try {
        const pool = await getDatabase(req);

        const {
            search,
            status,
            category_id,
            sort = "newest",
            page = 1,
            limit = 20
        } = req.query;

        const pageNumber = isPositiveInteger(page) ? Number(page) : 1;
        const pageSize = isPositiveInteger(limit)
            ? Math.min(Number(limit), 100)
            : 20;

        const offset = (pageNumber - 1) * pageSize;

        let conditions = [];
        let parameters = [];

        if (search && typeof search === "string") {
            conditions.push(
                "(p.project_name LIKE @search OR p.description LIKE @search)"
            );

            parameters.push({
                name: "search",
                type: sql.NVarChar(500),
                value: `%${search}%`
            });
        }

        if (status && typeof status === "string") {
            conditions.push("p.status = @status");

            parameters.push({
                name: "status",
                type: sql.NVarChar(50),
                value: status
            });
        }

        if (category_id !== undefined) {
            if (!isPositiveInteger(category_id)) {
                return res.status(400).json({
                    success: false,
                    error: "Invalid category ID."
                });
            }

            conditions.push("p.category_id = @category_id");

            parameters.push({
                name: "category_id",
                type: sql.Int,
                value: Number(category_id)
            });
        }

        const whereClause = conditions.length
            ? "WHERE " + conditions.join(" AND ")
            : "";

        // Only allow predefined sorting options
        const sortOptions = {
            newest: "p.created_at DESC",
            oldest: "p.created_at ASC",
            name: "p.project_name ASC",
            goal: "p.goal_hours DESC"
        };

        const orderBy = sortOptions[sort] || sortOptions.newest;

        const request = pool.request();

        parameters.forEach(parameter => {
            request.input(
                parameter.name,
                parameter.type,
                parameter.value
            );
        });

        request.input("offset", sql.Int, offset);
        request.input("pageSize", sql.Int, pageSize);

        const result = await request.query(`
            SELECT
                p.project_id,
                p.owner_id,
                p.category_id,
                p.project_name,
                p.description,
                p.goal_hours,
                p.status,
                p.created_at,
                p.updated_at,
                u.username,
                c.category_name
            FROM dbo.projects AS p
            INNER JOIN dbo.users AS u
                ON p.owner_id = u.user_id
            LEFT JOIN dbo.project_categories AS c
                ON p.category_id = c.category_id
            ${whereClause}
            ORDER BY ${orderBy}
            OFFSET @offset ROWS
            FETCH NEXT @pageSize ROWS ONLY;
        `);

        const countRequest = pool.request();

        parameters.forEach(parameter => {
            countRequest.input(
                parameter.name,
                parameter.type,
                parameter.value
            );
        });

        const countResult = await countRequest.query(`
            SELECT COUNT(*) AS total
            FROM dbo.projects AS p
            ${whereClause};
        `);

        const total = countResult.recordset[0].total;

        res.json({
            success: true,
            count: result.recordset.length,
            total,
            page: pageNumber,
            limit: pageSize,
            totalPages: Math.ceil(total / pageSize),
            projects: result.recordset
        });

    } catch (error) {
        console.error("Failed to retrieve projects:", error);

        res.status(500).json({
            success: false,
            error: "Failed to retrieve projects."
        });
    }
});


// GET /api/projects/:id
// Retrieve one project
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        if (!isPositiveInteger(id)) {
            return res.status(400).json({
                success: false,
                error: "Invalid project ID."
            });
        }

        const pool = await getDatabase(req);

        const result = await pool.request()
            .input("project_id", sql.Int, Number(id))
            .query(`
                SELECT
                    p.project_id,
                    p.owner_id,
                    p.category_id,
                    p.project_name,
                    p.description,
                    p.goal_hours,
                    p.status,
                    p.created_at,
                    p.updated_at,
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
        console.error("Failed to retrieve project:", error);

        res.status(500).json({
            success: false,
            error: "Failed to retrieve project."
        });
    }
});


// POST /api/projects
// Create a new project
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
            project_name.trim().length > 255
        ) {
            return res.status(400).json({
                success: false,
                error: "A project name is required (maximum 255 characters)."
            });
        }

        if (typeof description !== "string") {
            return res.status(400).json({
                success: false,
                error: "A project description is required."
            });
        }

        if (!isPositiveNumber(goal_hours)) {
            return res.status(400).json({
                success: false,
                error: "Goal hours must be a positive number."
            });
        }

        if (!isPositiveInteger(owner_id)) {
            return res.status(400).json({
                success: false,
                error: "A valid owner ID is required."
            });
        }

        let categoryId = null;

        if (
            category_id !== undefined &&
            category_id !== null &&
            category_id !== ""
        ) {
            if (!isPositiveInteger(category_id)) {
                return res.status(400).json({
                    success: false,
                    error: "Invalid category ID."
                });
            }

            categoryId = Number(category_id);
        }

        const pool = await getDatabase(req);

        const result = await pool.request()
            .input("project_name", sql.NVarChar(255), project_name.trim())
            .input("description", sql.NVarChar(sql.MAX), description)
            .input("goal_hours", sql.Decimal(10, 2), Number(goal_hours))
            .input("owner_id", sql.Int, Number(owner_id))
            .input("category_id", sql.Int, categoryId)
            .query(`
                INSERT INTO dbo.projects (
                    owner_id,
                    category_id,
                    project_name,
                    description,
                    goal_hours
                )
                OUTPUT INSERTED.*
                VALUES (
                    @owner_id,
                    @category_id,
                    @project_name,
                    @description,
                    @goal_hours
                );
            `);

        res.status(201).json({
            success: true,
            message: "Project created successfully.",
            project: result.recordset[0]
        });

    } catch (error) {
        console.error("Failed to create project:", error);

        res.status(500).json({
            success: false,
            error: "Failed to create project."
        });
    }
});


// PUT /api/projects/:id
// Edit an existing project
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const {
            project_name,
            description,
            goal_hours,
            owner_id,
            category_id
        } = req.body;

        if (!isPositiveInteger(id) || !isPositiveInteger(owner_id)) {
            return res.status(400).json({
                success: false,
                error: "A valid project ID and owner ID are required."
            });
        }

        if (
            typeof project_name !== "string" ||
            !project_name.trim() ||
            project_name.trim().length > 255 ||
            typeof description !== "string" ||
            !isPositiveNumber(goal_hours)
        ) {
            return res.status(400).json({
                success: false,
                error: "Valid project name, description, and positive goal hours are required."
            });
        }

        let categoryId = null;

        if (
            category_id !== undefined &&
            category_id !== null &&
            category_id !== ""
        ) {
            if (!isPositiveInteger(category_id)) {
                return res.status(400).json({
                    success: false,
                    error: "Invalid category ID."
                });
            }

            categoryId = Number(category_id);
        }

        const pool = await getDatabase(req);

        const result = await pool.request()
            .input("project_id", sql.Int, Number(id))
            .input("owner_id", sql.Int, Number(owner_id))
            .input("project_name", sql.NVarChar(255), project_name.trim())
            .input("description", sql.NVarChar(sql.MAX), description)
            .input("goal_hours", sql.Decimal(10, 2), Number(goal_hours))
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
                error: "Project not found or owner ID does not match."
            });
        }

        res.json({
            success: true,
            message: "Project updated successfully.",
            project: result.recordset[0]
        });

    } catch (error) {
        console.error("Failed to update project:", error);

        res.status(500).json({
            success: false,
            error: "Failed to update project."
        });
    }
});


// PATCH /api/projects/:id/cancel
// Cancel a project without deleting it
router.patch("/:id/cancel", async (req, res) => {
    try {
        const { id } = req.params;
        const { owner_id } = req.body;

        if (!isPositiveInteger(id) || !isPositiveInteger(owner_id)) {
            return res.status(400).json({
                success: false,
                error: "A valid project ID and owner ID are required."
            });
        }

        const pool = await getDatabase(req);

        const result = await pool.request()
            .input("project_id", sql.Int, Number(id))
            .input("owner_id", sql.Int, Number(owner_id))
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
                error: "Project not found or owner ID does not match."
            });
        }

        res.json({
            success: true,
            message: "Project cancelled successfully.",
            project: result.recordset[0]
        });

    } catch (error) {
        console.error("Failed to cancel project:", error);

        res.status(500).json({
            success: false,
            error: "Failed to cancel project."
        });
    }
});

module.exports = router;
