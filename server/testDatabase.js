
require("dotenv").config();

const sql = require("mssql");

// Use the same Azure SQL configuration as server.js.
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
    },

    connectionTimeout: 30000,
    requestTimeout: 30000
};

async function testDatabase() {
    let pool;

    try {
        console.log("Connecting to Azure SQL...");
        console.log("Server:", dbConfig.server);
        console.log("Database:", dbConfig.database);

        // Create a connection to Azure SQL.
        pool = await new sql.ConnectionPool(dbConfig).connect();

        console.log("Successfully connected to Azure SQL!");

        // Run a simple query to check the database.
        const result = await pool.request().query(`
            SELECT
                DB_NAME() AS database_name,
                GETDATE() AS server_time;
        `);

        console.log("Database query successful:");
        console.table(result.recordset);

        // Check whether the users table exists.
        const users = await pool.request().query(`
            SELECT COUNT(*) AS total_users
            FROM dbo.users;
        `);

        console.log("Users table query successful:");
        console.log("Total users:", users.recordset[0].total_users);

    } catch (error) {
        console.error("DATABASE TEST FAILED");
        console.error("Error name:", error.name);
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);

    } finally {
        // Close the database connection.
        if (pool) {
            await pool.close();
            console.log("Database connection closed.");
        }
    }
}

testDatabase();
