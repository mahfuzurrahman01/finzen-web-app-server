import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import Allocation from '../models/Allocation';
import Account from '../models/Account';
import Transaction from '../models/Transaction';
import Category from '../models/Category';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// @route   GET /api/allocations
// @desc    Get all allocations for the user
// @access  Private
router.get('/', async (req: Request, res: Response) => {
  try {
    const { active } = req.query;

    const query: any = { userId: req.user!.userId };
    if (active !== undefined) query.active = active === 'true';

    const allocations = await Allocation.find(query).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: allocations,
    });
  } catch (error: any) {
    console.error('Get allocations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching allocations',
    });
  }
});

// @route   POST /api/allocations
// @desc    Create a new allocation
// @access  Private
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Allocation name is required'),
    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be greater than 0'),
    body('type')
      .isIn(['expense', 'income', 'savings'])
      .withMessage('Type must be expense, income, or savings'),
    body('active').optional().isBoolean(),
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

      const { name, amount, type, active } = req.body;

      const allocation = new Allocation({
        userId: req.user!.userId,
        name,
        amount,
        type,
        active: active !== undefined ? active : true,
        monthlyPayments: [],
      });

      await allocation.save();

      res.status(201).json({
        success: true,
        message: 'Allocation created successfully',
        data: allocation,
      });
    } catch (error: any) {
      console.error('Create allocation error:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating allocation',
      });
    }
  }
);

// @route   PUT /api/allocations/:id
// @desc    Update an allocation
// @access  Private
router.put(
  '/:id',
  [
    body('name').optional().trim().notEmpty(),
    body('amount').optional().isFloat({ min: 0.01 }),
    body('type').optional().isIn(['expense', 'income', 'savings']),
    body('active').optional().isBoolean(),
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

      const allocation = await Allocation.findOne({
        _id: req.params.id,
        userId: req.user!.userId,
      });

      if (!allocation) {
        return res.status(404).json({
          success: false,
          message: 'Allocation not found',
        });
      }

      // Update fields
      if (req.body.name) allocation.name = req.body.name;
      if (req.body.amount) allocation.amount = req.body.amount;
      if (req.body.type) allocation.type = req.body.type;
      if (req.body.active !== undefined) allocation.active = req.body.active;

      await allocation.save();

      res.json({
        success: true,
        message: 'Allocation updated successfully',
        data: allocation,
      });
    } catch (error: any) {
      console.error('Update allocation error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating allocation',
      });
    }
  }
);

// @route   POST /api/allocations/:id/mark-paid
// @desc    Mark an allocation as paid for a specific month
// @access  Private
router.post(
  '/:id/mark-paid',
  [
    body('accountId').notEmpty().withMessage('Account is required'),
    body('month')
      .matches(/^\d{4}-\d{2}$/)
      .withMessage('Month must be in YYYY-MM format'),
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

      const { accountId, month } = req.body;

      // Find allocation
      const allocation = await Allocation.findOne({
        _id: req.params.id,
        userId: req.user!.userId,
      });

      if (!allocation) {
        return res.status(404).json({
          success: false,
          message: 'Allocation not found',
        });
      }

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

      // For expense/savings, check balance
      if (allocation.type !== 'income' && account.balance < allocation.amount) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient balance in the selected account to pay this allocation',
        });
      }

      // Update or add monthly payment
      const existingPaymentIndex = allocation.monthlyPayments.findIndex(
        (p) => p.month === month
      );

      const paymentData = {
        month,
        accountId,
        paid: true,
        paidDate: new Date(),
      };

      if (existingPaymentIndex >= 0) {
        allocation.monthlyPayments[existingPaymentIndex] = paymentData;
      } else {
        allocation.monthlyPayments.push(paymentData);
      }

      await allocation.save();

      // Update account balance
      const amountChange =
        allocation.type === 'income' ? allocation.amount : -allocation.amount;
      account.balance += amountChange;
      await account.save();

      // Create transaction record
      const transactionType: 'income' | 'expense' =
        allocation.type === 'income' ? 'income' : 'expense';

      // Find appropriate category
      let category = await Category.findOne({
        userId: req.user!.userId,
        type: transactionType,
      });

      if (!category) {
        // Create a default category if none exists
        category = new Category({
          userId: req.user!.userId,
          name: allocation.type === 'income' ? 'Allocation Income' : 'Allocation Expense',
          type: transactionType,
          color: allocation.type === 'income' ? '#10b981' : '#f43f5e',
        });
        await category.save();
      }

      const transaction = new Transaction({
        userId: req.user!.userId,
        accountId,
        categoryId: category._id,
        amount: allocation.amount,
        type: transactionType,
        date: new Date(),
        note: `${allocation.name} - ${month}`,
      });

      await transaction.save();

      res.json({
        success: true,
        message: 'Allocation marked as paid successfully',
        data: allocation,
      });
    } catch (error: any) {
      console.error('Mark paid error:', error);
      res.status(500).json({
        success: false,
        message: 'Error marking allocation as paid',
      });
    }
  }
);

// @route   DELETE /api/allocations/:id
// @desc    Delete an allocation
// @access  Private
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const allocation = await Allocation.findOne({
      _id: req.params.id,
      userId: req.user!.userId,
    });

    if (!allocation) {
      return res.status(404).json({
        success: false,
        message: 'Allocation not found',
      });
    }

    await allocation.deleteOne();

    res.json({
      success: true,
      message: 'Allocation deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete allocation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting allocation',
    });
  }
});

export default router;

