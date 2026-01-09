import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import User from '../models/User';
import { generateToken } from '../config/jwt';
import { seedDefaultCategories } from '../utils/seedCategories';
import { authenticate } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { uploadToCloudinary, deleteFromCloudinary, getPublicIdFromUrl } from '../config/cloudinary';

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

// @route   GET /api/auth/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          profileImage: user.profileImage,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
    });
  } catch (error: any) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching profile',
      ...(process.env.NODE_ENV === 'development' && { error: error.message }),
    });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile (name, email)
// @access  Private
router.put(
  '/profile',
  authenticate,
  [
    body('name').optional().trim().isLength({ max: 100 }).withMessage('Name must be less than 100 characters'),
    body('email')
      .optional()
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

      const userId = req.user?.userId;
      const { name, email } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Update name if provided
      if (name !== undefined) {
        user.name = name || undefined;
      }

      // Update email if provided and different
      if (email !== undefined && email !== user.email) {
        // Check if email is already taken
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: 'Email is already in use',
          });
        }
        user.email = email;
      }

      await user.save();

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            profileImage: user.profileImage,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
        },
      });
    } catch (error: any) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while updating profile',
        ...(process.env.NODE_ENV === 'development' && { error: error.message }),
      });
    }
  }
);

// @route   POST /api/auth/profile/upload-image
// @desc    Upload profile image to Cloudinary
// @access  Private
router.post(
  '/profile/upload-image',
  authenticate,
  upload.single('image'),
  async (req: Request & { file?: Express.Multer.File }, res: Response) => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No image file provided',
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Delete old profile image from Cloudinary if exists
      if (user.profileImage) {
        const oldPublicId = getPublicIdFromUrl(user.profileImage);
        if (oldPublicId) {
          await deleteFromCloudinary(oldPublicId);
        }
      }

      // Upload new image to Cloudinary
      try {
        const { url, public_id } = await uploadToCloudinary(req.file, 'zenfinance/profiles');

        // Update user profile image
        user.profileImage = url;
        await user.save();

        res.json({
          success: true,
          message: 'Profile image uploaded successfully',
          data: {
            user: {
              id: user._id,
              email: user.email,
              name: user.name,
              profileImage: user.profileImage,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
            },
            imageUrl: url,
          },
        });
      } catch (uploadError: any) {
        console.error('Cloudinary upload error:', uploadError);
        // Check if it's a configuration error
        if (uploadError.message?.includes('Cloudinary configuration missing') || 
            uploadError.message?.includes('Must supply api_key')) {
          return res.status(500).json({
            success: false,
            message: 'Image upload service not configured. Please check Cloudinary credentials.',
            ...(process.env.NODE_ENV === 'development' && { 
              error: uploadError.message,
              hint: 'Make sure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET are set in .env file'
            }),
          });
        }
        throw uploadError; // Re-throw to be caught by outer catch
      }
    } catch (error: any) {
      console.error('Upload profile image error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while uploading profile image',
        ...(process.env.NODE_ENV === 'development' && { error: error.message }),
      });
    }
  }
);

// @route   DELETE /api/auth/profile/image
// @desc    Delete profile image
// @access  Private
router.delete('/profile/image', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!user.profileImage) {
      return res.status(400).json({
        success: false,
        message: 'No profile image to delete',
      });
    }

    // Delete image from Cloudinary
    const publicId = getPublicIdFromUrl(user.profileImage);
    if (publicId) {
      await deleteFromCloudinary(publicId);
    }

    // Remove image URL from user profile
    user.profileImage = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Profile image deleted successfully',
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          profileImage: user.profileImage,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
    });
  } catch (error: any) {
    console.error('Delete profile image error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting profile image',
      ...(process.env.NODE_ENV === 'development' && { error: error.message }),
    });
  }
});

export default router;

