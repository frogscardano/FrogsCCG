import { BlockFrostAPI } from '@blockfrost/blockfrost-js';
import { withDatabase, incrementHoskyPoopmeter } from '../../utils/db.js';
import { getHoskyImageUrl } from '../../utils/hoskyIpfsLoader.js';
import { getFrogStats } from '../../utils/frogData.js';

const blockfrost = new BlockFrostAPI({
  projectId: process.env.BLOCKFROST_API_KEY || process.env.BLOCKFROST_PROJECT_ID,
});

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

function extractImageUrl(metadata) {
  if (metadata.onchain_metadata?.image) {
    let imageUrl = metadata.onchain_metadata.image;
    
    if (imageUrl.startsWith('ipfs://')) {
      const ipfsHash = imageUrl.replace('ipfs://', '');
      return `https://ipfs.io/ipfs/${ipfsHash}`;
    }
    
    return imageUrl;
  }
  
  if (metadata.onchain_metadata?.files && metadata.onchain_metadata.files.length > 0) {
    const file = metadata.onchain_metadata.files[0];
    if (file.src && file.src.startsWith('ipfs://')) {
      const ipfsHash = file.src.replace('ipfs://', '');
      return `https://ipfs.io/ipfs/${ipfsHash}`;
    }
    return file.src || null;
  }
  
  return null;
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

    // Fetch real HOSKY NFT from Cardano blockchain via Blockfrost
    let attempts = 0;
    let card = null;
    
    while (!card && attempts < 10) {
      attempts++;
      console.log(`Attempt ${attempts} to fetch HOSKY from Cardano...`);
      
      try {
        // Get all HOSKY assets from the policy ID
        const assets = await blockfrost.assetsPolicyById(HOSKY_CONFIG.policyId);
        console.log(`Found ${assets.length} HOSKY assets`);
        
        if (assets.length === 0) {
          throw new Error('No HOSKY assets found on Cardano');
        }
        
        // Select a random HOSKY
        const randomIndex = Math.floor(Math.random() * assets.length);
        const selectedAsset = assets[randomIndex];
        
        // Get detailed asset information
        console.log(`Fetching details for HOSKY asset: ${selectedAsset.asset}`);
        const assetDetails = await blockfrost.assetsById(selectedAsset.asset);
        
        // Extract HOSKY number from various sources
        let nftNumber = null;
        
        // Try metadata name first
        if (assetDetails.onchain_metadata?.name) {
          const nameMatch = assetDetails.onchain_metadata.name.match(/(\d+)/);
          if (nameMatch) {
            nftNumber = parseInt(nameMatch[1]);
            console.log(`Extracted number from metadata name: ${nftNumber}`);
          }
        }
        
        // Try decoding hex asset name
        if (!nftNumber) {
          try {
            const hexPart = selectedAsset.asset.replace(HOSKY_CONFIG.policyId, '');
            let text = '';
            
            for (let i = 0; i < hexPart.length; i += 2) {
              const charCode = parseInt(hexPart.substr(i, 2), 16);
              if (charCode > 0) {
                text += String.fromCharCode(charCode);
              }
            }
            
            console.log(`Decoded HOSKY asset name: ${text}`);
            
            const patterns = [
              /HOSKY(\d+)/i,
              /hosky(\d+)/,
              /#(\d+)/,
              /(\d+)/
            ];
            
            for (const pattern of patterns) {
              const match = text.match(pattern);
              if (match && match[1]) {
                nftNumber = parseInt(match[1]);
                console.log(`Extracted number using pattern: ${nftNumber}`);
                break;
              }
            }
          } catch (e) {
            console.error('Error decoding hex asset name:', e);
          }
        }
        
        // If we still don't have a number, use CSV lookup
        if (!nftNumber) {
          // Try from image URL via CSV
          const imageUrl = extractImageUrl(assetDetails);
          if (imageUrl) {
            const imageMatch = imageUrl.match(/\/(\d+)\.(png|jpg|jpeg|gif)$/i);
            if (imageMatch) {
              nftNumber = parseInt(imageMatch[1]);
              console.log(`Extracted number from image URL: ${nftNumber}`);
            }
          }
        }
        
        if (!nftNumber || nftNumber < 1 || nftNumber > HOSKY_CONFIG.maxNumber) {
          console.log(`Invalid HOSKY number: ${nftNumber}, retrying...`);
          continue;
        }
        
        const rarity = determineRarity(nftNumber);
        const stats = getFrogStats(nftNumber, rarity);
        
        // Get image URL - try Blockfrost metadata first, fallback to CSV lookup
        let imageUrl = extractImageUrl(assetDetails);
        if (!imageUrl) {
          imageUrl = getHoskyImageUrl(nftNumber);
        }
        
        if (!imageUrl) {
          console.log(`No image found for HOSKY #${nftNumber}, retrying...`);
          continue;
        }
        
        card = {
          id: `hosky-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: `HOSKY #${nftNumber}`,
          description: assetDetails.onchain_metadata?.description || `A unique HOSKY from the Cardano blockchain collection`,
          rarity: rarity,
          image: imageUrl,
          attack: stats.attack,
          health: stats.health,
          speed: stats.speed,
          special: stats.special,
          attributes: [
            { trait_type: "Collection", value: HOSKY_CONFIG.name },
            { trait_type: "Number", value: `${nftNumber}` },
            { trait_type: "Policy ID", value: HOSKY_CONFIG.policyId }
          ],
          tokenId: `${nftNumber}`,
          contractAddress: HOSKY_CONFIG.policyId
        };
        
        console.log(`✅ Successfully fetched HOSKY #${nftNumber} from Cardano`);
        
      } catch (error) {
        console.error(`Error on attempt ${attempts}:`, error);
        if (attempts >= 10) {
          throw error;
        }
      }
    }
    
    if (!card) {
      throw new Error('Failed to fetch HOSKY from Cardano after multiple attempts');
    }
    
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
    res.status(500).json({ message: 'Error pooping HOSKY from Cardano', error: error.message });
  }
}
