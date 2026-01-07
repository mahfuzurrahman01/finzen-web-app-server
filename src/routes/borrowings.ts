import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import Borrowing from '../models/Borrowing';
import BorrowingTransaction from '../models/BorrowingTransaction';
import Account from '../models/Account';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// @route   GET /api/borrowings
// @desc    Get all borrowings for the user
// @access  Private
router.get('/', async (req: Request, res: Response) => {
  try {
    const { type, status } = req.query;

    const query: any = { userId: req.user!.userId };
    if (type) query.type = type;
    if (status) query.status = status;

    const borrowings = await Borrowing.find(query)
      .populate('initialAccountId', 'name type')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: borrowings,
    });
  } catch (error: any) {
    console.error('Get borrowings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching borrowings',
    });
  }
});

// @route   GET /api/borrowings/:id
// @desc    Get a single borrowing with transactions
// @access  Private
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const borrowing = await Borrowing.findOne({
      _id: req.params.id,
      userId: req.user!.userId,
    }).populate('initialAccountId', 'name type');

    if (!borrowing) {
      return res.status(404).json({
        success: false,
        message: 'Borrowing not found',
      });
    }

    const transactions = await BorrowingTransaction.find({
      borrowingId: borrowing._id,
    })
      .populate('accountId', 'name type')
      .sort({ date: -1 });

    res.json({
      success: true,
      data: {
        borrowing,
        transactions,
      },
    });
  } catch (error: any) {
    console.error('Get borrowing error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching borrowing',
    });
  }
});

// @route   POST /api/borrowings
// @desc    Create a new borrowing/lending
// @access  Private
router.post(
  '/',
  [
    body('friendName').trim().notEmpty().withMessage('Friend name is required'),
    body('friendEmail').optional().isEmail().withMessage('Please provide a valid email').normalizeEmail(),
    body('friendPhone').optional().trim(),
    body('type')
      .isIn(['borrow', 'lend'])
      .withMessage('Type must be borrow or lend'),
    body('totalAmount')
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be greater than 0'),
    body('initialAccountId').optional().isMongoId().withMessage('Invalid account ID'),
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

      const { friendName, friendEmail, friendPhone, type, totalAmount, initialAccountId } = req.body;

      // If account is provided, verify it belongs to user
      if (initialAccountId) {
        const account = await Account.findOne({
          _id: initialAccountId,
          userId: req.user!.userId,
        });

        if (!account) {
          return res.status(404).json({
            success: false,
            message: 'Account not found',
          });
        }

        // For 'lend' type, check if account has enough balance
        if (type === 'lend' && account.balance < totalAmount) {
          return res.status(400).json({
            success: false,
            message: 'Insufficient balance in the selected account',
          });
        }

        // Update account balance
        if (type === 'borrow') {
          // Add money to account (user received borrowed money)
          account.balance += totalAmount;
        } else {
          // Deduct money from account (user lent money)
          account.balance -= totalAmount;
        }

        await account.save();
      }

      // Create borrowing record
      const borrowing = new Borrowing({
        userId: req.user!.userId,
        friendName,
        friendEmail,
        friendPhone,
        type,
        totalAmount,
        paidAmount: 0,
        remainingAmount: totalAmount,
        status: 'active',
        initialAccountId: initialAccountId || undefined,
      });

      await borrowing.save();
      await borrowing.populate('initialAccountId', 'name type');

      res.status(201).json({
        success: true,
        message: `${type === 'borrow' ? 'Borrowing' : 'Lending'} created successfully`,
        data: borrowing,
      });
    } catch (error: any) {
      console.error('Create borrowing error:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating borrowing',
      });
    }
  }
);

// @route   POST /api/borrowings/:id/pay
// @desc    Pay back borrowed amount or receive returned amount
// @access  Private
router.post(
  '/:id/pay',
  [
    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage('Amount must be greater than 0'),
    body('accountId')
      .isMongoId()
      .withMessage('Account is required'),
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

      const { amount, accountId, date, note } = req.body;

      // Find borrowing
      const borrowing = await Borrowing.findOne({
        _id: req.params.id,
        userId: req.user!.userId,
      });

      if (!borrowing) {
        return res.status(404).json({
          success: false,
          message: 'Borrowing not found',
        });
      }

      // Check if already completed
      if (borrowing.status === 'completed') {
        return res.status(400).json({
          success: false,
          message: 'This borrowing is already completed',
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

      // Determine transaction type based on borrowing type
      const transactionType = borrowing.type === 'borrow' ? 'payment' : 'return';

      // For 'borrow' type (user paying back), check account balance
      if (borrowing.type === 'borrow' && account.balance < amount) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient balance in the selected account',
        });
      }

      // Calculate new paid amount
      const newPaidAmount = borrowing.paidAmount + amount;
      if (newPaidAmount > borrowing.totalAmount) {
        return res.status(400).json({
          success: false,
          message: `Payment amount exceeds remaining amount. Maximum payment: ${borrowing.remainingAmount}`,
        });
      }

      // Update account balance
      if (borrowing.type === 'borrow') {
        // Deduct from account (user is paying back)
        account.balance -= amount;
      } else {
        // Add to account (user is receiving return)
        account.balance += amount;
      }

      await account.save();

      // Update borrowing
      borrowing.paidAmount = newPaidAmount;
      borrowing.remainingAmount = borrowing.totalAmount - newPaidAmount;
      if (borrowing.remainingAmount <= 0) {
        borrowing.status = 'completed';
        borrowing.remainingAmount = 0;
      }

      await borrowing.save();

      // Create transaction record
      const transaction = new BorrowingTransaction({
        borrowingId: borrowing._id,
        userId: req.user!.userId,
        amount,
        accountId,
        date: date ? new Date(date) : new Date(),
        note,
        type: transactionType,
      });

      await transaction.save();
      await transaction.populate('accountId', 'name type');

      await borrowing.populate('initialAccountId', 'name type');

      res.json({
        success: true,
        message: `${transactionType === 'payment' ? 'Payment' : 'Return'} recorded successfully`,
        data: {
          borrowing,
          transaction,
        },
      });
    } catch (error: any) {
      console.error('Pay borrowing error:', error);
      res.status(500).json({
        success: false,
        message: 'Error recording payment',
      });
    }
  }
);

// @route   PUT /api/borrowings/:id
// @desc    Update a borrowing (friend info, amount, etc.)
// @access  Private
router.put(
  '/:id',
  [
    body('friendName').optional().trim().notEmpty(),
    body('friendEmail').optional().isEmail().normalizeEmail(),
    body('friendPhone').optional().trim(),
    body('totalAmount').optional().isFloat({ min: 0.01 }),
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

      const borrowing = await Borrowing.findOne({
        _id: req.params.id,
        userId: req.user!.userId,
      });

      if (!borrowing) {
        return res.status(404).json({
          success: false,
          message: 'Borrowing not found',
        });
      }

      // Update fields
      if (req.body.friendName) borrowing.friendName = req.body.friendName;
      if (req.body.friendEmail !== undefined) borrowing.friendEmail = req.body.friendEmail || undefined;
      if (req.body.friendPhone !== undefined) borrowing.friendPhone = req.body.friendPhone || undefined;
      
      // If totalAmount is being updated, recalculate remaining
      if (req.body.totalAmount) {
        borrowing.totalAmount = req.body.totalAmount;
        borrowing.remainingAmount = borrowing.totalAmount - borrowing.paidAmount;
        if (borrowing.remainingAmount <= 0) {
          borrowing.status = 'completed';
          borrowing.remainingAmount = 0;
        } else {
          borrowing.status = 'active';
        }
      }

      await borrowing.save();
      await borrowing.populate('initialAccountId', 'name type');

      res.json({
        success: true,
        message: 'Borrowing updated successfully',
        data: borrowing,
      });
    } catch (error: any) {
      console.error('Update borrowing error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating borrowing',
      });
    }
  }
);

// @route   DELETE /api/borrowings/:id
// @desc    Delete a borrowing and its transactions
// @access  Private
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const borrowing = await Borrowing.findOne({
      _id: req.params.id,
      userId: req.user!.userId,
    });

    if (!borrowing) {
      return res.status(404).json({
        success: false,
        message: 'Borrowing not found',
      });
    }

    // Delete all transactions
    await BorrowingTransaction.deleteMany({
      borrowingId: borrowing._id,
    });

    // If there was an initial account and money was added/deducted, reverse it
    if (borrowing.initialAccountId) {
      const account = await Account.findById(borrowing.initialAccountId);
      if (account) {
        if (borrowing.type === 'borrow') {
          // Reverse: deduct what was added
          account.balance -= borrowing.totalAmount;
        } else {
          // Reverse: add back what was deducted
          account.balance += borrowing.totalAmount;
        }
        await account.save();
      }
    }

    // Delete the borrowing
    await borrowing.deleteOne();

    res.json({
      success: true,
      message: 'Borrowing and associated transactions deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete borrowing error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting borrowing',
    });
  }
});

export default router;

