import jwt from 'jsonwebtoken';
import { user as user_default } from '../models/index.js';

// Protect routes - Authentication middleware
export const protect = async (req, res, next) => {
  try {
    let token;

    // Get token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'You are not logged in. Please log in to get access.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user still exists
    const currentUser = await user_default.findByPk(decoded.id);
    if (!currentUser) {
      return res.status(401).json({
        status: 'error',
        message: 'The user belonging to this token no longer exists.'
      });
    }
    console.log('Current User:', currentUser);
    // Check if user is active
    if (!currentUser.status || currentUser.status !== true) {
      return res.status(401).json({
        status: 'error',
        message: 'This user account has been deactivated.'
      });
    }

    // Grant access to protected route
    req.user = currentUser;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({
      status: 'error',
      message: 'Invalid token or token has expired'
    });
  }
};

// Check if user has required role
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to perform this action'
      });
    }
    next();
  };
};