import mongoose, { Schema, Document } from 'mongoose';

export interface IBorrowing extends Document {
  userId: mongoose.Types.ObjectId;
  friendName: string;
  friendEmail?: string;
  friendPhone?: string;
  type: 'borrow' | 'lend'; // 'borrow' = user borrows, 'lend' = user lends
  totalAmount: number;
  paidAmount: number; // Amount paid back so far
  remainingAmount: number; // Calculated: totalAmount - paidAmount
  status: 'active' | 'completed';
  initialAccountId?: mongoose.Types.ObjectId; // Account where borrowed money was added (for borrow) or deducted from (for lend)
  createdAt: Date;
  updatedAt: Date;
}

const BorrowingSchema = new Schema<IBorrowing>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    friendName: {
      type: String,
      required: [true, 'Friend name is required'],
      trim: true,
    },
    friendEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    friendPhone: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ['borrow', 'lend'],
      required: [true, 'Borrowing type is required'],
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: [0, 'Paid amount cannot be negative'],
    },
    remainingAmount: {
      type: Number,
      default: function() {
        return (this as IBorrowing).totalAmount;
      },
      min: [0, 'Remaining amount cannot be negative'],
    },
    status: {
      type: String,
      enum: ['active', 'completed'],
      default: 'active',
    },
    initialAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
    },
  },
  {
    timestamps: true,
  }
);

// Calculate remaining amount before saving
BorrowingSchema.pre('save', function (next) {
  this.remainingAmount = this.totalAmount - this.paidAmount;
  if (this.remainingAmount <= 0) {
    this.status = 'completed';
    this.remainingAmount = 0;
  } else {
    this.status = 'active';
  }
  next();
});

// Indexes for faster queries
BorrowingSchema.index({ userId: 1, type: 1, status: 1 });
BorrowingSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<IBorrowing>('Borrowing', BorrowingSchema);

