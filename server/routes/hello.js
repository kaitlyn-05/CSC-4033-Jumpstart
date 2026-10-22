// hello world test 
const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
    res.json({
        message: "Hello from the Jumpstart backend! If you see this, thats good!"
    });
});
module.exports = router;