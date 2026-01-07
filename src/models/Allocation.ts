import mongoose, { Schema, Document } from 'mongoose';

export interface IMonthlyPayment {
  month: string; // Format: "YYYY-MM"
  accountId: mongoose.Types.ObjectId;
  paid: boolean;
  paidDate?: Date;
}

export interface IAllocation extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  amount: number;
  type: 'expense' | 'income' | 'savings';
  active: boolean;
  monthlyPayments: IMonthlyPayment[];
  createdAt: Date;
  updatedAt: Date;
}

const MonthlyPaymentSchema = new Schema<IMonthlyPayment>(
  {
    month: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format'],
    },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
    },
    paid: {
      type: Boolean,
      default: false,
    },
    paidDate: {
      type: Date,
    },
  },
  { _id: false }
);

const AllocationSchema = new Schema<IAllocation>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Allocation name is required'],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
    },
    type: {
      type: String,
      enum: ['expense', 'income', 'savings'],
      required: [true, 'Allocation type is required'],
    },
    active: {
      type: Boolean,
      default: true,
    },
    monthlyPayments: {
      type: [MonthlyPaymentSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
AllocationSchema.index({ userId: 1, active: 1 });

export default mongoose.model<IAllocation>('Allocation', AllocationSchema);

