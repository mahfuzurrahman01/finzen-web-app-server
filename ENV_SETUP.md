# Environment Variables Setup

## Backend Environment Variables

Add these to your `backend/.env` file:

```env
# Server Configuration
PORT=5001
NODE_ENV=development

# MongoDB Connection
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/finzen-db

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRE=7d

# CORS Configuration
FRONTEND_URL=http://localhost:3000

# Cloudinary Configuration (for profile image uploads)
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret
```

## Getting Cloudinary Credentials

1. Go to [Cloudinary Dashboard](https://cloudinary.com/console)
2. Sign up or log in to your account
3. Go to Dashboard → Settings
4. Copy the following values:
   - **Cloud Name**: Found at the top of the dashboard
   - **API Key**: Found in the "API Keys" section
   - **API Secret**: Found in the "API Keys" section (click "Reveal" to see it)

## Installation

After adding the environment variables, install the new dependencies:

```bash
cd backend
npm install
```

This will install:
- `cloudinary` - For image upload and management
- `multer` - For handling file uploads
- `@types/multer` - TypeScript types for multer

## Testing

Once you've added the Cloudinary credentials, you can test the profile image upload feature in the Settings page of your frontend application.
