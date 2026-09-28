// ════════════════════════════════════════════════════════════════
// middleware/authMiddleware.js — JWT Token Verification
// ════════════════════════════════════════════════════════════════
//
// This middleware protects routes that require the user to be logged in.
// Usage: add `authenticate` as a parameter before your route handler.
//   Example: router.get('/cart', authenticate, cartController.getCart)
//
// The frontend must send the JWT in every protected request as:
//   Authorization: Bearer <token>

const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  // 1. Read the Authorization header
  const authHeader = req.headers['authorization'];

  // 2. The header should look like: "Bearer eyJhbGci..."
  //    Split on the space and take the second part (the token)
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'No token provided. Please log in.',
    });
  }

  // 3. Verify the token using our secret key
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4. Attach the decoded user data to the request so route handlers can use it
    //    e.g. req.user.id  →  the logged-in user's ID
    req.user = decoded;
    next(); // Token is valid — continue to the route handler
  } catch (err) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid or expired token. Please log in again.',
    });
  }
};

module.exports = { authenticate };
