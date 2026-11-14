
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

    // Get the login token from our own header.
    // Azure Static Web Apps replaces the Authorization header, so we can't use it.
    const token = req.headers["x-auth-token"] || null;

    console.log("X-AUTH-TOKEN header exists:", !!token);

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
