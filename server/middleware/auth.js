
const jwt = require("jsonwebtoken");

// Read and verify the login token from our own header.
// Azure Static Web Apps replaces the Authorization header, so we can't use it.
// Returns the decoded token, or null when there is no valid token.
function readToken(req) {
    const token = req.headers["x-auth-token"];

    if (!token) {
        return null;
    }

    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        console.error(
            "JWT verification failed:",
            req.requestId,
            error.name,
            error.message
        );

        return null;
    }
}

// Require a valid login token. Use on routes that change data.
function authenticateToken(req, res, next) {
    if (!req.headers["x-auth-token"]) {
        return res.status(401).json({
            success: false,
            error: "Authentication required."
        });
    }

    const decoded = readToken(req);

    if (!decoded) {
        return res.status(401).json({
            success: false,
            error: "Invalid or expired login token."
        });
    }

    req.user = decoded;
    next();
}

// Accept a login token if one was sent, but do not require it.
// Use on public routes that return extra details for logged-in users.
function optionalToken(req, res, next) {
    req.user = readToken(req);
    next();
}

module.exports = authenticateToken;
module.exports.optional = optionalToken;
