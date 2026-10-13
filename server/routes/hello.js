// hello world test 
const express = require("express");

const router = express.Router();

router.get("/hello", (req, res) => {
    res.json({
        message: "Hello from the Jumpstart backend!"
    });
});
module.exports = router;