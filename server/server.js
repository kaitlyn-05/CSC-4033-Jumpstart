
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const sql = require("mssql");

const helloRoutes = require("./routes/hello");

const app = express();
const PORT = process.env.PORT || 5000;

// Azure SQL Database connection using Microsoft Entra authentication.
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
                throw error;
            });
    }

    return poolPromise;
}

app.use(cors());
app.use(express.json());

// test for api connection to Web App
app.get('/', (req, res) => {
  res.send('Jumpstart backend is running!');
});

// Keep existing API routes.
app.use("/api/hello", helloRoutes);

// Test the Azure SQL connection and projects table.
app.get("/api/projects-test", async (req, res) => {
    try {
        const pool = await getPool();

        const result = await pool.request().query(
            "SELECT COUNT(*) AS total FROM dbo.projects"
        );

        res.json({
            success: true,
            projectCount: Number(result.recordset[0].total)
        });
    } catch (error) {
        console.error("Azure SQL query failed:", error.message);

        res.status(500).json({
            success: false,
            error: "Could not connect to Azure SQL or query projects."
        });
    }
});

// Basic endpoint to confirm the backend is running.
app.get("/api/health", (req, res) => {
    res.json({ success: true, message: "Jumpstart API is running." });
});

app.listen(PORT, () => {
    console.log(`Jumpstart server running on port ${PORT}`);
});
