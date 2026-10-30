const express = require("express");
const router = express.Router();

// Get all comments
router.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Comments route is working."
    });
});

module.exports = router;