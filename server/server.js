
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Jumpstart backend is running!");
});

app.get("/api/hello", (req, res) => {
    res.json({
        success: true,
        message: "Hello from Jumpstart!"
    });
});

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "Jumpstart API is running!"
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Jumpstart server running on port ${PORT}`);
});
