# Frogs Card Collection Telegram Mini App

A Telegram mini app for frogs card collection that displays cards from an IPFS-based collection.

## Getting Started

1. Install dependencies:
   ```
   npm install
   ```

2. Run the development server:
   ```
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser to see the result.

## Deployment to Vercel

1. Add placeholder images to the `/public` folder:
   - Create `placeholder.png` (250x350 pixels) for card fronts
   - Create `card-back.png` (250x350 pixels) for card backs

2. Push to GitHub:
   - Create a new repository on GitHub
   - Push your code to the repository

3. Deploy to Vercel:
   - Go to [Vercel.com](https://vercel.com)
   - Create a new project and import your GitHub repository
   - Deploy with default settings

4. Configure Telegram Bot:
   - Talk to @BotFather on Telegram
   - Create a new bot or use an existing one
   - Set up a web app URL with your Vercel deployment URL

## Features

- Display card collection from IPFS/Cardano blockchain
- Filter cards by rarity
- Search cards by name or description
- Interactive card flipping to see details
- Integration with Telegram Mini Apps

## Technologies Used

- Next.js
- React
- Telegram Web App API
- IPFS for decentralized storage
- Cardano blockchain integration

# Frogs CCG - Cardano Integration

This project integrates Cardano blockchain functionality for NFT pack purchases and openings in the Frogs CCG game.

## Features

- Users can purchase NFT packs with 1 ADA
- Transaction verification via Blockfrost API
- NFT pack opening with random card distribution
- Recording of transactions and NFT ownership in database
- Wallet connection for payments and ownership verification

## Setup

### Prerequisites

1. Node.js and npm/yarn
2. PostgreSQL database
3. Blockfrost API key (register at [blockfrost.io](https://blockfrost.io))
4. Cardano wallet for receiving payments

### Environment Variables

Copy `.env.example` to `.env` and fill in the required variables:

```
# Database connection
DATABASE_URL="postgresql://username:password@localhost:5432/database_name"

# Blockfrost API (Cardano)
BLOCKFROST_PROJECT_ID="your_blockfrost_project_id_here"
BLOCKFROST_NETWORK="preprod" # preprod for testnet, mainnet for production

# Cardano wallet
PAYMENT_ADDRESS="addr_test1..."
PAYMENT_WALLET_MNEMONIC="your wallet seed phrase here" # Keep this secure!
```

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Setup the database:
   ```
   npx prisma migrate dev
   ```
4. Start the development server:
   ```
   npm run dev
   ```

## API Endpoints

### Pack Purchase

- `POST /api/generatePaymentAddress` - Generate a payment address for purchasing a pack
- `GET /api/checkPaymentStatus` - Check if a payment has been completed
- `POST /api/packOpening` - Process a pack opening after payment validation
- `GET /api/packOpeningResult` - Get the results of a pack opening

## Frontend Components

- `PackPurchase.js` - Component for initiating a pack purchase
- `PackOpeningResult.js` - Component for displaying the results of a pack opening

## Cardano Integration

This project uses the Blockfrost API to interact with the Cardano blockchain. The integration allows:

1. Generating payment addresses
2. Verifying ADA payments
3. Recording transaction details
4. Associating NFTs with user wallets

For security reasons, private keys should never be exposed on the client side. All blockchain interactions are handled server-side via API endpoints.

## Testing

For testing purposes, use the Cardano testnet (preprod) before deploying to mainnet. You can get test ADA from the [Cardano Testnet Faucet](https://docs.cardano.org/cardano-testnet/tools/faucet). 