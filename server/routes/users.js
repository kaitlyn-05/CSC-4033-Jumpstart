const express = require("express");
const router = express.Router();

// Get all users
router.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Users route is working."
    });
});

module.exports = router;