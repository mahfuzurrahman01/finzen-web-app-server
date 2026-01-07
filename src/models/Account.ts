import mongoose, { Schema, Document } from 'mongoose';

export interface IAccount extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  type: 'bank' | 'wallet' | 'investment' | 'cash';
  balance: number;
  currency: string;
  icon?: string; // Icon name from lucide-react
  color?: string; // Hex color code
  createdAt: Date;
  updatedAt: Date;
}

const AccountSchema = new Schema<IAccount>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Account name is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['bank', 'wallet', 'investment', 'cash'],
      required: [true, 'Account type is required'],
    },
    balance: {
      type: Number,
      required: [true, 'Balance is required'],
      default: 0,
      min: [0, 'Balance cannot be negative'],
    },
    currency: {
      type: String,
      required: true,
      default: 'BDT',
    },
    icon: {
      type: String,
      trim: true,
    },
    color: {
      type: String,
      match: [/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex code'],
      default: '#6366f1', // Default indigo color
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
AccountSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<IAccount>('Account', AccountSchema);

