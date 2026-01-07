import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import Transaction from '../models/Transaction';
import Account from '../models/Account';
import Category from '../models/Category';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// @route   GET /api/transactions
// @desc    Get all transactions for the user
// @access  Private
router.get('/', async (req: Request, res: Response) => {
  try {
    const { type, accountId, categoryId, startDate, endDate } = req.query;

    const query: any = { userId: req.user!.userId };

    if (type) query.type = type;
    if (accountId) query.accountId = accountId;
    if (categoryId) query.categoryId = categoryId;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate as string);
      if (endDate) query.date.$lte = new Date(endDate as string);
    }

    const transactions = await Transaction.find(query)
      .populate('accountId', 'name type')
      .populate('categoryId', 'name color type')
      .sort({ date: -1, createdAt: -1 });

    res.json({
      success: true,
      data: transactions,
    });
  } catch (error: any) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transactions',
    });
  }
});

// @route   POST /api/transactions
// @desc    Create a new transaction
// @access  Private
router.post(
  '/',
  [
    body('accountId').notEmpty().withMessage('Account is required'),
    body('categoryId').notEmpty().withMessage('Category is required'),
    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be greater than 0'),
    body('type')
      .isIn(['income', 'expense'])
      .withMessage('Type must be income or expense'),
    body('date').optional().isISO8601().withMessage('Invalid date format'),
    body('note').optional().trim().isLength({ max: 500 }),
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

      const { accountId, categoryId, amount, type, date, note } = req.body;

      // Verify account belongs to user
      const account = await Account.findOne({
        _id: accountId,
        userId: req.user!.userId,
      });

      if (!account) {
        return res.status(404).json({
          success: false,
          message: 'Account not found',
        });
      }

      // Verify category belongs to user
      const category = await Category.findOne({
        _id: categoryId,
        userId: req.user!.userId,
      });

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found',
        });
      }

      // Verify category type matches transaction type
      if (category.type !== type) {
        return res.status(400).json({
          success: false,
          message: 'Category type does not match transaction type',
        });
      }

      // Create transaction
      const transaction = new Transaction({
        userId: req.user!.userId,
        accountId,
        categoryId,
        amount,
        type,
        date: date ? new Date(date) : new Date(),
        note,
      });

      await transaction.save();

      // Update account balance
      const amountChange = type === 'income' ? amount : -amount;
      account.balance += amountChange;

      // Prevent negative balance
      if (account.balance < 0) {
        await transaction.deleteOne();
        return res.status(400).json({
          success: false,
          message: 'Insufficient balance in the selected account',
        });
      }

      await account.save();

      // Populate before sending response
      await transaction.populate('accountId', 'name type');
      await transaction.populate('categoryId', 'name color type');

      res.status(201).json({
        success: true,
        message: 'Transaction created successfully',
        data: transaction,
      });
    } catch (error: any) {
      console.error('Create transaction error:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating transaction',
      });
    }
  }
);

// @route   DELETE /api/transactions/:id
// @desc    Delete a transaction
// @access  Private
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      userId: req.user!.userId,
    }).populate('accountId');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
    }

    // Reverse the transaction effect on account balance
    const account = transaction.accountId as any;
    const amountChange = transaction.type === 'income' ? -transaction.amount : transaction.amount;
    account.balance += amountChange;

    await account.save();

    // Delete transaction
    await transaction.deleteOne();

    res.json({
      success: true,
      message: 'Transaction deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete transaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting transaction',
    });
  }
});

export default router;

