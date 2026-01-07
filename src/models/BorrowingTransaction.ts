import mongoose, { Schema, Document } from 'mongoose';

export interface IBorrowingTransaction extends Document {
  borrowingId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  amount: number;
  accountId: mongoose.Types.ObjectId; // Account used for payment/return
  date: Date;
  note?: string;
  type: 'payment' | 'return'; // 'payment' = paying back borrowed, 'return' = receiving back lent
  createdAt: Date;
  updatedAt: Date;
}

const BorrowingTransactionSchema = new Schema<IBorrowingTransaction>(
  {
    borrowingId: {
      type: Schema.Types.ObjectId,
      ref: 'Borrowing',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
    },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      required: [true, 'Account is required'],
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
      default: Date.now,
    },
    note: {
      type: String,
      trim: true,
      maxlength: [500, 'Note cannot exceed 500 characters'],
    },
    type: {
      type: String,
      enum: ['payment', 'return'],
      required: [true, 'Transaction type is required'],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
BorrowingTransactionSchema.index({ borrowingId: 1, date: -1 });
BorrowingTransactionSchema.index({ userId: 1, date: -1 });

export default mongoose.model<IBorrowingTransaction>('BorrowingTransaction', BorrowingTransactionSchema);

