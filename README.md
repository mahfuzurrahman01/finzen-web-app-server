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
