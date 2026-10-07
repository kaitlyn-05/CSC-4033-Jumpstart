const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

app.get("/api/hello", (req, res) => {
    res.json({
        message: "Hello from the Jumpstart backend!"
    });
});

app.listen(PORT, () => {
    console.log(`Jumpstart server running on port ${PORT}`);
});
