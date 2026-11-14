
const jwt = require("jsonwebtoken");

// Check whether a user has a valid authentication token.
function authenticateToken(req, res, next) {

    // Get the token from the Authorization header.
    const authHeader = req.headers.authorization;

    // The expected format is: Bearer TOKEN
    const token = authHeader && authHeader.split(" ")[1];

    // If no token was provided, reject the request.
    if (!token) {
        return res.status(401).json({
            success: false,
            error: "Authentication required."
        });
    }

    try {
        // Verify the token using the secret from .env.
        console.log("JWT_SECRET exists:", !!process.env.JWT_SECRET);
        console.log("JWT_SECRET length:", process.env.JWT_SECRET?.length);

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        console.log("JWT verification successful for user:", decoded.user_id);

        // Save the logged-in user's information for the route.
        req.user = decoded;

        // Continue to the requested route.
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
