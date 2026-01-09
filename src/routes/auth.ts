import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import User from '../models/User';
import { generateToken } from '../config/jwt';
import { seedDefaultCategories } from '../utils/seedCategories';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post(
  '/register',
  [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
    body('name').optional().trim().isLength({ max: 100 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { email, password, name } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User already exists with this email',
        });
      }

      // Create new user
      const user = new User({
        email,
        password,
        name: name || email.split('@')[0],
      });

      await user.save();

      // Seed default categories for new user
      await seedDefaultCategories(user._id.toString());

      // Generate token
      const token = generateToken({
        userId: user._id.toString(),
        email: user.email,
      });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          token,
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
          },
        },
      });
    } catch (error: any) {
      console.error('Register error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during registration',
        ...(process.env.NODE_ENV === 'development' && { error: error.message }),
      });
    }
  }
);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post(
  '/login',
  [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { email, password } = req.body;

      // Find user and include password
      const user = await User.findOne({ email }).select('+password');
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }

      // Check password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }

      // Generate token
      const token = generateToken({
        userId: user._id.toString(),
        email: user.email,
      });

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          token,
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
          },
        },
      });
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during login',
        ...(process.env.NODE_ENV === 'development' && { error: error.message }),
      });
    }
  }
);

// @route   POST /api/auth/forgot-password
// @desc    Request password reset
// @access  Public
router.post(
  '/forgot-password',
  [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { email } = req.body;

      // Find user by email (include passwordResetToken and passwordResetExpires)
      const user = await User.findOne({ email }).select('+passwordResetToken +passwordResetExpires');
      
      // Always return success message (security best practice - don't reveal if email exists)
      if (!user) {
        return res.json({
          success: true,
          message: 'If that email exists, a password reset link has been sent.',
        });
      }

      // Generate reset token
      const resetToken = user.createPasswordResetToken();
      await user.save({ validateBeforeSave: false });

      // TODO: In production, send email with reset token
      // For now, we'll return the token in development mode only
      // In production, send email using nodemailer, sendgrid, etc.
      
      if (process.env.NODE_ENV === 'development') {
        // In development, return the reset token (for testing)
        return res.json({
          success: true,
          message: 'Password reset token generated (dev mode only)',
          data: {
            resetToken, // Only in development!
            // In production, this should be sent via email
          },
        });
      }

      // In production, token should be sent via email
      // For now, return success message
      res.json({
        success: true,
        message: 'If that email exists, a password reset link has been sent.',
      });
    } catch (error: any) {
      console.error('Forgot password error:', error);
      
      // If error occurred, clear the reset token and expiration
      const user = await User.findOne({ email: req.body.email });
      if (user) {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false });
      }

      res.status(500).json({
        success: false,
        message: 'Server error during password reset request',
        ...(process.env.NODE_ENV === 'development' && { error: error.message }),
      });
    }
  }
);

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post(
  '/reset-password',
  [
    body('token')
      .notEmpty()
      .withMessage('Reset token is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Password confirmation does not match password');
        }
        return true;
      }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { token, password } = req.body;

      // Hash the token to compare with database
      const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

      // Find user with valid reset token (not expired)
      const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }, // Token not expired
      }).select('+passwordResetToken +passwordResetExpires');

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token',
        });
      }

      // Set new password
      user.password = password;
      // Clear reset token fields
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      // passwordChangedAt will be set automatically in pre-save hook

      await user.save();

      // Generate new token (user must login with new password)
      const jwtToken = generateToken({
        userId: user._id.toString(),
        email: user.email,
      });

      res.json({
        success: true,
        message: 'Password has been reset successfully',
        data: {
          token: jwtToken,
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
          },
        },
      });
    } catch (error: any) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during password reset',
        ...(process.env.NODE_ENV === 'development' && { error: error.message }),
      });
    }
  }
);

// @route   POST /api/auth/change-password
// @desc    Change password (authenticated user)
// @access  Private
router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters long'),
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error('Password confirmation does not match new password');
        }
        return true;
      }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { currentPassword, newPassword } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      // Find user and include password
      const user = await User.findById(userId).select('+password');
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Verify current password
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect',
        });
      }

      // Check if new password is different from current
      const isSamePassword = await user.comparePassword(newPassword);
      if (isSamePassword) {
        return res.status(400).json({
          success: false,
          message: 'New password must be different from current password',
        });
      }

      // Update password
      user.password = newPassword;
      // passwordChangedAt will be set automatically in pre-save hook

      await user.save();

      // Generate new token (invalidate old tokens)
      const jwtToken = generateToken({
        userId: user._id.toString(),
        email: user.email,
      });

      res.json({
        success: true,
        message: 'Password has been changed successfully',
        data: {
          token: jwtToken,
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
          },
        },
      });
    } catch (error: any) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during password change',
        ...(process.env.NODE_ENV === 'development' && { error: error.message }),
      });
    }
  }
);

export default router;

