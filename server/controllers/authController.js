import jwt from 'jsonwebtoken';
import { user as user_default } from '../models/index.js';
import bcrypt from 'bcrypt';

// Sign JWT token
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

// Register a new user
export const register = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check if user already exists
    const existingUser = await user_default.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'Username already in use'
      });
    }

    // Create a new user
    const newUser = await user_default.create({
      username,
      username,
      password
    });

    // Generate JWT token
    const token = signToken(newUser.id);

    // Return user data and token
    res.status(201).json({
      status: 'success',
      token,
      data: {
        user: {
          id: newUser.id,
          username: newUser.username,
          username: newUser.username
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Login user
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check if user exists
    const user = await user_default.findOne({ where: { username } });

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials'
      });
    }

    // Check if password is correct - moved from model to controller
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = signToken(user.id);

    // Return user data and token
    res.status(200).json({
      status: 'success',
      token,
      data: {
        user: {
          id: user.id,
          username: user.username,
          username: user.username
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// Get current user
export const getMe = async (req, res) => {
  try {
    const currentUser = await user_default.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
      include: [{
        model: m_role,
        include: [{
          model: m_menu,
          where: { status: true },
          through: {
            model: role_menu,
            attributes: ['can_view', 'can_create', 'can_edit', 'can_delete']
          }
        }]
      }]
    });

    if (!currentUser) {
      return res.status(404).json({
        status: 'error',
        message: 'user_default not found'
      });
    }

    // Initialize response data
    const responseData = {
      user: {
        id: currentUser.id,
        username: currentUser.username,
        username: currentUser.username,
        role: null
      },
      menu_permissions: []
    };

    // Add role information if exists
    if (currentUser.m_role) {
      responseData.user.role = {
        id: currentUser.m_role.id,
        name: currentUser.m_role.name
      };

      // Format menu permissions if role and menus exist
      if (currentUser.m_role.m_menus && Array.isArray(currentUser.m_role.m_menus)) {
        responseData.menu_permissions = currentUser.m_role.m_menus.map(menu => {
          const menuObj = menu.toJSON();
          // Remove createdAt, updatedAt, and role_menu
          delete menuObj.createdAt;
          delete menuObj.updatedAt;
          delete menuObj.role_menu;
          return {
            ...menuObj,
            permissions: {
              can_view: menu.role_menu.can_view,
              can_create: menu.role_menu.can_create,
              can_edit: menu.role_menu.can_edit,
              can_delete: menu.role_menu.can_delete
            }
          };
        });
      }
    } res.status(200).json({
      status: 'success',
      data: responseData
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};