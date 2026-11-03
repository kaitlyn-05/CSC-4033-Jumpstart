
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const sql = require("mssql");

const app = express();
const PORT = process.env.PORT || 5000;

const dbConfig = {
    server: process.env.AZURE_SQL_SERVER,
    port: Number(process.env.AZURE_SQL_PORT || 1433),
    database: process.env.AZURE_SQL_DATABASE,
    authentication: {
        type: "azure-active-directory-default"
    },
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

let poolPromise;

function getPool() {
    if (!poolPromise) {
        poolPromise = new sql.ConnectionPool(dbConfig)
            .connect()
            .catch((error) => {
                poolPromise = null;
                console.error("Database connection failed:", error);
                throw error;
            });
    }

    return poolPromise;
}

// Make the database connection available to all routes.
app.locals.getPool = getPool;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Jumpstart backend is running!");
});

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "Jumpstart API is running."
    });
});

function loadRoute(name, path, routePath) {
    try {
        const router = require(path);
        app.use(routePath, router);
        console.log(`SUCCESS: Loaded ${name}`);
    } catch (error) {
        console.error(`FAILED: Loading ${name}`, error);
    }
}

loadRoute("hello", "./routes/hello", "/api/hello");
loadRoute("projects", "./routes/projects", "/api/projects");
loadRoute("comments", "./routes/comments", "/api/comments");
loadRoute("contributors", "./routes/contributors", "/api/contributors");
loadRoute("users", "./routes/users", "/api/users");

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Jumpstart server running on port ${PORT}`);
});
