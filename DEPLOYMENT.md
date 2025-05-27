# Deployment Guide for Frogs CCG

## Quick Deploy to Vercel

### Step 1: Prepare the Code
The code has been updated to handle deployment issues. Key changes made:
- Fixed Next.js configuration for Vercel compatibility
- Added database availability checks
- Improved error handling in API routes
- Updated Vercel configuration

### Step 2: Deploy to Vercel

1. **Push to GitHub** (if not already done):
   ```bash
   git add .
   git commit -m "Fix deployment issues"
   git push origin main
   ```

2. **Deploy to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Deploy with default settings

### Step 3: Environment Variables (Optional)

For full functionality, add these environment variables in Vercel dashboard:

**Required for database features:**
- `DATABASE_URL` - PostgreSQL connection string

**Optional for Cardano features:**
- `BLOCKFROST_PROJECT_ID` - Blockfrost API key
- `BLOCKFROST_NETWORK` - "preprod" or "mainnet"
- `PAYMENT_ADDRESS` - Cardano payment address
- `PAYMENT_WALLET_MNEMONIC` - Wallet seed phrase (keep secure!)

**Note:** The app will work without these variables but with limited functionality (no database persistence).

### Step 4: Database Setup (Optional)

For full functionality, you'll need a PostgreSQL database:

1. **Option A: Vercel Postgres**
   - Add Vercel Postgres to your project
   - Copy the DATABASE_URL to environment variables

2. **Option B: External Database**
   - Use services like Supabase, PlanetScale, or Railway
   - Add the connection string as DATABASE_URL

3. **Run Migrations**:
   ```bash
   npx prisma migrate deploy
   ```

### Troubleshooting

If you still get 500 errors:

1. **Check Vercel Function Logs**:
   - Go to your Vercel dashboard
   - Click on your deployment
   - Check the "Functions" tab for error logs

2. **Common Issues**:
   - Missing environment variables (app will work with limited functionality)
   - Database connection issues (app will return empty collections)
   - Build errors (check build logs in Vercel)

3. **Test Locally First**:
   ```bash
   npm run build
   npm start
   ```

### Current Status

The app has been configured to:
- ✅ Work without database (returns empty collections)
- ✅ Handle missing environment variables gracefully
- ✅ Provide proper error responses
- ✅ Work with Vercel's serverless functions

You should now be able to deploy successfully to Vercel! 