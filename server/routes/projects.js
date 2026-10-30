
const express = require("express");
const sql = require("mssql");

const router = express.Router();

// Helper: Validate positive integer IDs.
function isPositiveInteger(value) {
    return Number.isInteger(Number(value)) && Number(value) > 0;
}

// Helper: Get the database connection.
async function getDatabase(req) {
    return await req.app.locals.getPool();
}

// GET /api/projects
// Retrieve projects with optional search, filters, sorting, and pagination.
router.get("/", async (req, res) => {
    try {
        const pool = await getDatabase(req);
        const request = pool.request();

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
            !Number.isInteger(pageNumber) || pageNumber < 1 ||
            !Number.isInteger(pageLimit) || pageLimit < 1 || pageLimit > 100
        ) {
            return res.status(400).json({
                success: false,
                error: "Page must be positive and limit must be between 1 and 100."
            });
        }

        let conditions = [];

        // Search project name and description.
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

        // Filter by project status.
        if (status) {
            request.input("status", sql.NVarChar(30), status);
            conditions.push("p.status = @status");
        }

        // Filter by category.
        if (category_id !== undefined) {
            if (!isPositiveInteger(category_id)) {
                return res.status(400).json({
                    success: false,
                    error: "Category ID must be a positive integer."
                });
            }

            request.input("category_id", sql.Int, Number(category_id));
            conditions.push("p.category_id = @category_id");
        }

        const whereClause = conditions.length
            ? "WHERE " + conditions.join(" AND ")
            : "";

        // Only allow predefined sort options.
        const sortOptions = {
            newest: "p.created_at DESC",
            oldest: "p.created_at ASC",
            name: "p.project_name ASC",
            goal: "p.goal_hours DESC"
        };

        if (!sortOptions[sort]) {
            return res.status(400).json({
                success: false,
                error: "Invalid sort option. Use newest, oldest, name, or goal."
            });
        }

        const offset = (pageNumber - 1) * pageLimit;

        request.input("offset", sql.Int, offset);
        request.input("limit", sql.Int, pageLimit);

        // Retrieve matching projects.
        const result = await request.query(`
            SELECT
                p.project_id,
                p.project_name,
                p.description,
                p.goal_hours,
                p.status,
                p.created_at,
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

        // Count all matching projects for pagination.
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
            ${whereClause};
        `);

        const total = Number(countResult.recordset[0].total);

        res.json({
            success: true,
            count: result.recordset.length,
            total: total,
            page: pageNumber,
            totalPages: Math.ceil(total / pageLimit),
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
// Retrieve one project by its ID.
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
        console.error("Failed to retrieve project:", error);

        res.status(500).json({
            success: false,
            error: "Failed to retrieve project."
        });
    }
});


// POST /api/projects
// Create a new project.
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
            !isPositiveInteger(goal_hours) ||
            !isPositiveInteger(owner_id)
        ) {
            return res.status(400).json({
                success: false,
                error: "Provide a project name (up to 255 characters), description, positive goal hours, and valid owner ID."
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
                error: "Category ID must be a positive integer."
            });
        }

        const pool = await getDatabase(req);
        const request = pool.request();

        request.input(
            "project_name",
            sql.NVarChar(255),
            project_name.trim()
        );

        request.input(
            "description",
            sql.NVarChar(sql.MAX),
            description ?? ""
        );

        request.input(
            "goal_hours",
            sql.Int,
            Number(goal_hours)
        );

        request.input(
            "owner_id",
            sql.Int,
            Number(owner_id)
        );

        request.input("category_id", sql.Int, categoryId);

        const result = await request.query(`
            INSERT INTO dbo.projects
                (project_name, description, goal_hours, owner_id, category_id, status)
            OUTPUT INSERTED.*
            VALUES
                (@project_name, @description, @goal_hours, @owner_id, @category_id, 'active');
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
// Edit an existing project.
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
            typeof project_name !== "string" ||
            !project_name.trim() ||
            project_name.trim().length > 255 ||
            typeof (description ?? "") !== "string" ||
            !isPositiveInteger(goal_hours) ||
            !isPositiveInteger(owner_id)
        ) {
            return res.status(400).json({
                success: false,
                error: "Invalid project ID or project information."
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
                error: "Category ID must be a positive integer."
            });
        }

        const pool = await getDatabase(req);
        const request = pool.request();

        request.input("project_id", sql.Int, projectId);
        request.input("project_name", sql.NVarChar(255), project_name.trim());
        request.input("description", sql.NVarChar(sql.MAX), description ?? "");
        request.input("goal_hours", sql.Int, Number(goal_hours));
        request.input("owner_id", sql.Int, Number(owner_id));
        request.input("category_id", sql.Int, categoryId);

        const result = await request.query(`
            UPDATE dbo.projects
            SET
                project_name = @project_name,
                description = @description,
                goal_hours = @goal_hours,
                category_id = @category_id
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
        console.error("Failed to update project:", error);

        res.status(500).json({
            success: false,
            error: "Failed to update project."
        });
    }
});


// PATCH /api/projects/:id/cancel
// Cancel a project without deleting its database record.
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
                SET status = 'cancelled'
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
        console.error("Failed to cancel project:", error);

        res.status(500).json({
            success: false,
            error: "Failed to cancel project."
        });
    }
});

module.exports = router;
