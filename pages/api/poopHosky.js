import { withDatabase, incrementHoskyPoopmeter } from '../../utils/db.js';
import { getHoskyImageUrl } from '../../utils/hoskyIpfsLoader.js';
import { getFrogStats } from '../../utils/frogData.js';

const HOSKY_CONFIG = {
  policyId: 'a0028f350aaabe0545fdcb56b039bfb08e4bb4d8c4d7c3c7d481c235',
  name: 'HOSKY',
  maxNumber: 420420,
  rarityBreakpoints: { legendary: 100, epic: 1000, rare: 10000 }
};

function determineRarity(num) {
  if (num <= 100) return "Legendary";
  if (num <= 1000) return "Epic";
  if (num <= 10000) return "Rare";
  return "Common";
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const walletAddress = req.query.walletAddress;
    
    if (!walletAddress) {
      return res.status(400).json({ message: 'Wallet address is required' });
    }

    console.log(`💩 Pooping HOSKY for wallet: ${walletAddress}`);

    // Generate random HOSKY
    const randomNumber = Math.floor(Math.random() * HOSKY_CONFIG.maxNumber) + 1;
    const rarity = determineRarity(randomNumber);
    const stats = getFrogStats(randomNumber, rarity);
    const imageUrl = getHoskyImageUrl(randomNumber);
    
    if (!imageUrl) {
      throw new Error(`No IPFS hash found for HOSKY #${randomNumber}`);
    }

    const card = {
      id: `hosky-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `HOSKY #${randomNumber}`,
      description: `A unique HOSKY from the Cardano blockchain collection`,
      rarity: rarity,
      image: imageUrl,
      attack: stats.attack,
      health: stats.health,
      speed: stats.speed,
      special: stats.special,
      attributes: [
        { trait_type: "Collection", value: HOSKY_CONFIG.name },
        { trait_type: "Number", value: `${randomNumber}` },
        { trait_type: "Policy ID", value: HOSKY_CONFIG.policyId }
      ],
      tokenId: `${randomNumber}`,
      contractAddress: HOSKY_CONFIG.policyId
    };
    
    // Increment Hosky Poopmeter
    const newPoopScore = await withDatabase(async () => {
      return await incrementHoskyPoopmeter(walletAddress);
    });
    
    console.log(`✅ HOSKY pooped! New poopmeter: ${newPoopScore}`);
    
    return res.status(200).json({
      ...card,
      poopScore: newPoopScore
    });
    
  } catch (error) {
    console.error('Error pooping HOSKY:', error);
    res.status(500).json({ message: 'Error pooping HOSKY', error: error.message });
  }
}
