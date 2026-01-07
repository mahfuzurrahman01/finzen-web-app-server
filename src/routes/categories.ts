import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import Category from '../models/Category';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// @route   GET /api/categories
// @desc    Get all categories for the user
// @access  Private
router.get('/', async (req: Request, res: Response) => {
  try {
    const { type } = req.query;

    const query: any = { userId: req.user!.userId };
    if (type) query.type = type;

    const categories = await Category.find(query).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: categories,
    });
  } catch (error: any) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
    });
  }
});

// @route   POST /api/categories
// @desc    Create a new category
// @access  Private
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Category name is required'),
    body('type')
      .isIn(['income', 'expense'])
      .withMessage('Type must be income or expense'),
    body('color')
      .matches(/^#[0-9A-Fa-f]{6}$/)
      .withMessage('Color must be a valid hex code'),
    body('budget').optional().isFloat({ min: 0 }),
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

      const { name, type, color, budget } = req.body;

      const category = new Category({
        userId: req.user!.userId,
        name,
        type,
        color,
        budget,
      });

      await category.save();

      res.status(201).json({
        success: true,
        message: 'Category created successfully',
        data: category,
      });
    } catch (error: any) {
      console.error('Create category error:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating category',
      });
    }
  }
);

// @route   PUT /api/categories/:id
// @desc    Update a category
// @access  Private
router.put(
  '/:id',
  [
    body('name').optional().trim().notEmpty(),
    body('type').optional().isIn(['income', 'expense']),
    body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
    body('budget').optional().isFloat({ min: 0 }),
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

      const category = await Category.findOne({
        _id: req.params.id,
        userId: req.user!.userId,
      });

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found',
        });
      }

      // Update fields
      if (req.body.name) category.name = req.body.name;
      if (req.body.type) category.type = req.body.type;
      if (req.body.color) category.color = req.body.color;
      if (req.body.budget !== undefined) category.budget = req.body.budget;

      await category.save();

      res.json({
        success: true,
        message: 'Category updated successfully',
        data: category,
      });
    } catch (error: any) {
      console.error('Update category error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating category',
      });
    }
  }
);

// @route   DELETE /api/categories/:id
// @desc    Delete a category
// @access  Private
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const category = await Category.findOne({
      _id: req.params.id,
      userId: req.user!.userId,
    });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    await category.deleteOne();

    res.json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting category',
    });
  }
});

export default router;

