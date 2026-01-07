import mongoose, { Schema, Document } from 'mongoose';

export interface ICategory extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  type: 'income' | 'expense';
  color: string;
  budget?: number;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['income', 'expense'],
      required: [true, 'Category type is required'],
    },
    color: {
      type: String,
      required: [true, 'Color is required'],
      match: [/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex code'],
    },
    budget: {
      type: Number,
      min: [0, 'Budget cannot be negative'],
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
CategorySchema.index({ userId: 1, type: 1 });

export default mongoose.model<ICategory>('Category', CategorySchema);

