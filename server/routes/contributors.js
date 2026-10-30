const express = require("express");
const router = express.Router();

// Get all contributions
router.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Contributors route is working."
    });
});

module.exports = router;