# ZenFinance Backend API

Express.js backend API for ZenFinance personal finance tracker.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT (JSON Web Tokens)
- **Language**: TypeScript
- **Password Hashing**: Bcrypt.js

## Prerequisites

- Node.js 18+ installed
- MongoDB instance (local or MongoDB Atlas)
- npm or yarn package manager

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file in the root directory:
```env
PORT=5001
NODE_ENV=development
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/finzen-db
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:3000

# Cloudinary Configuration (for profile image uploads)
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret
```

3. Start the development server:
```bash
npm run dev
```

The server will run on `http://localhost:5001`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/forgot-password` - Request password reset (sends reset token)
- `POST /api/auth/reset-password` - Reset password with token
- `POST /api/auth/change-password` - Change password (authenticated users)
- `GET /api/auth/profile` - Get user profile (authenticated)
- `PUT /api/auth/profile` - Update user profile (name, email) (authenticated)
- `POST /api/auth/profile/upload-image` - Upload profile image to Cloudinary (authenticated)
- `DELETE /api/auth/profile/image` - Delete profile image (authenticated)

### Accounts
- `GET /api/accounts` - Get all accounts
- `POST /api/accounts` - Create account
- `PUT /api/accounts/:id` - Update account
- `DELETE /api/accounts/:id` - Delete account

### Transactions
- `GET /api/transactions` - Get all transactions
- `POST /api/transactions` - Create transaction
- `DELETE /api/transactions/:id` - Delete transaction

### Categories
- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

### Allocations
- `GET /api/allocations` - Get all allocations
- `POST /api/allocations` - Create allocation
- `PUT /api/allocations/:id` - Update allocation
- `POST /api/allocations/:id/mark-paid` - Mark allocation as paid
- `DELETE /api/allocations/:id` - Delete allocation

### Borrowings
- `GET /api/borrowings` - Get all borrowings
- `GET /api/borrowings/:id` - Get single borrowing with transactions
- `POST /api/borrowings` - Create borrowing/lending
- `PUT /api/borrowings/:id` - Update borrowing
- `POST /api/borrowings/:id/pay` - Record payment/return
- `DELETE /api/borrowings/:id` - Delete borrowing

## Authentication

All endpoints (except `/api/auth/*`) require JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

### Password Security Features

The backend implements several security best practices for password management:

1. **Password Hashing**: All passwords are hashed using bcrypt.js with salt rounds
2. **Password Reset Tokens**: Cryptographically secure reset tokens (32 bytes, SHA-256 hashed)
3. **Token Expiration**: Reset tokens expire after 1 hour
4. **Password Change Tracking**: Tracks when passwords are changed (`passwordChangedAt`)
5. **Token Invalidation**: JWT tokens are automatically invalidated if password is changed after token issuance
6. **Email Privacy**: Forgot password endpoint doesn't reveal if email exists (security best practice)

### Password Endpoints Details

#### Forgot Password (`POST /api/auth/forgot-password`)
- **Access**: Public
- **Body**: `{ email: string }`
- **Response**: Always returns success (for security - doesn't reveal if email exists)
- **Development Mode**: Returns reset token in response (for testing)
- **Production**: Should send reset token via email (requires email service integration)

#### Reset Password (`POST /api/auth/reset-password`)
- **Access**: Public
- **Body**: `{ token: string, password: string, confirmPassword: string }`
- **Response**: Returns new JWT token and user data
- **Validations**: 
  - Token must be valid and not expired
  - Password must be at least 6 characters
  - Password confirmation must match

#### Change Password (`POST /api/auth/change-password`)
- **Access**: Private (requires authentication)
- **Body**: `{ currentPassword: string, newPassword: string, confirmPassword: string }`
- **Response**: Returns new JWT token and user data
- **Validations**:
  - Current password must be correct
  - New password must be different from current
  - Password must be at least 6 characters
  - Password confirmation must match

**Note**: After password change, all old JWT tokens are automatically invalidated and user must use the new token returned in the response.

## Production Deployment

### Deploy to Render.com

1. Connect your GitHub repository to Render
2. Set environment variables in Render dashboard
3. Set build command: `npm install && npm run build`
4. Set start command: `npm start`
5. Set root directory: `backend` (if deploying from monorepo)

## Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   ├── middleware/      # Express middleware
│   ├── models/          # Mongoose models
│   ├── routes/          # API routes
│   ├── utils/           # Utility functions
│   └── server.ts        # Main server file
├── .env                 # Environment variables
├── package.json
└── tsconfig.json
```

## Development

```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## License

MIT
