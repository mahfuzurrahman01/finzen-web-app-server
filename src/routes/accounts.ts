import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import Account from '../models/Account';
import Transaction from '../models/Transaction';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// @route   GET /api/accounts
// @desc    Get all accounts for the user
// @access  Private
router.get('/', async (req: Request, res: Response) => {
  try {
    const accounts = await Account.find({ userId: req.user!.userId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: accounts,
    });
  } catch (error: any) {
    console.error('Get accounts error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching accounts',
    });
  }
});

// @route   POST /api/accounts
// @desc    Create a new account
// @access  Private
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Account name is required'),
    body('type')
      .isIn(['bank', 'wallet', 'investment', 'cash', 'saving'])
      .withMessage('Invalid account type'),
    body('balance')
      .isFloat({ min: 0 })
      .withMessage('Balance must be a positive number'),
    body('currency').optional().trim(),
    body('icon').optional().trim(),
    body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Color must be a valid hex code'),
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

      const { name, type, balance, currency, icon, color } = req.body;

      const account = new Account({
        userId: req.user!.userId,
        name,
        type,
        balance: balance || 0,
        currency: currency || 'BDT',
        icon: icon || undefined,
        color: color || '#6366f1',
      });

      await account.save();

      res.status(201).json({
        success: true,
        message: 'Account created successfully',
        data: account,
      });
    } catch (error: any) {
      console.error('Create account error:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating account',
      });
    }
  }
);

// @route   PUT /api/accounts/:id
// @desc    Update an account
// @access  Private
router.put(
  '/:id',
  [
    body('name').optional().trim().notEmpty(),
    body('type').optional().isIn(['bank', 'wallet', 'investment', 'cash', 'saving']).withMessage('Invalid account type'),
    body('balance').optional().isFloat({ min: 0 }),
    body('icon').optional().trim(),
    body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Color must be a valid hex code'),
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

      const account = await Account.findOne({
        _id: req.params.id,
        userId: req.user!.userId,
      });

      if (!account) {
        return res.status(404).json({
          success: false,
          message: 'Account not found',
        });
      }

      // Update fields
      if (req.body.name) account.name = req.body.name;
      if (req.body.type) account.type = req.body.type;
      if (req.body.balance !== undefined) account.balance = req.body.balance;
      if (req.body.currency) account.currency = req.body.currency;
      if (req.body.icon !== undefined) account.icon = req.body.icon || undefined;
      if (req.body.color) account.color = req.body.color;

      await account.save();

      res.json({
        success: true,
        message: 'Account updated successfully',
        data: account,
      });
    } catch (error: any) {
      console.error('Update account error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating account',
      });
    }
  }
);

// @route   DELETE /api/accounts/:id
// @desc    Delete an account and its transactions
// @access  Private
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const account = await Account.findOne({
      _id: req.params.id,
      userId: req.user!.userId,
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found',
      });
    }

    // Delete all transactions associated with this account
    await Transaction.deleteMany({
      accountId: account._id,
      userId: req.user!.userId,
    });

    // Delete the account
    await account.deleteOne();

    res.json({
      success: true,
      message: 'Account and associated transactions deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting account',
    });
  }
});

export default router;

