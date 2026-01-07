import Category from '../models/Category';
import mongoose from 'mongoose';

const defaultCategories = [
  { name: 'Salary', type: 'income', color: '#10b981' },
  { name: 'Freelance', type: 'income', color: '#3b82f6' },
  { name: 'Food & Dining', type: 'expense', color: '#f43f5e' },
  { name: 'Transportation', type: 'expense', color: '#f97316' },
  { name: 'Housing', type: 'expense', color: '#8b5cf6' },
  { name: 'Shopping', type: 'expense', color: '#ec4899' },
  { name: 'Utilities', type: 'expense', color: '#06b6d4' },
  { name: 'Entertainment', type: 'expense', color: '#eab308' },
];

export const seedDefaultCategories = async (userId: string): Promise<void> => {
  try {
    // Check if user already has categories
    const existingCategories = await Category.find({ userId });
    if (existingCategories.length > 0) {
      return; // Don't seed if categories already exist
    }

    // Create default categories for the user
    const categoriesToCreate = defaultCategories.map((cat) => ({
      ...cat,
      userId: new mongoose.Types.ObjectId(userId),
    }));

    await Category.insertMany(categoriesToCreate);
    console.log(`✅ Default categories seeded for user ${userId}`);
  } catch (error) {
    console.error('Error seeding default categories:', error);
  }
};

