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