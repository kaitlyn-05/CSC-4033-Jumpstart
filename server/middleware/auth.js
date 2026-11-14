
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// Create a fingerprint without displaying the actual token.
function fingerprint(value) {
    return crypto.createHash("sha256")
        .update(value)
        .digest("hex")
        .substring(0, 12);
}

// Check whether a user has a valid authentication token.
function authenticateToken(req, res, next) {

    // Get the Authorization header.
    const authHeader = req.headers.authorization;

    console.log("AUTHORIZATION header exists:", !!authHeader);
    console.log("AUTHORIZATION format:", authHeader?.split(" ")[0]);

    // Extract the token.
    const parts = authHeader ? authHeader.trim().split(/\s+/) : [];
    const token = parts.length === 2 && parts[0] === "Bearer"
        ? parts[1]
        : null;

    if (!token) {
        return res.status(401).json({
            success: false,
            error: "Authentication required."
        });
    }

    try {
        console.log(
            "AUTH REQUEST ID:", req.requestId,
            "EXTRACTED token fingerprint:", fingerprint(token)
        );
        console.log("JWT verification fingerprint:",
            fingerprint(process.env.JWT_SECRET));

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        console.log("JWT verification successful for user:", decoded.user_id);

        req.user = decoded;
        next();

    } catch (error) {
        console.error("JWT verification failed:", error.name, error.message);

        return res.status(401).json({
            success: false,
            error: "Invalid or expired login token."
        });
    }
}

module.exports = authenticateToken;
