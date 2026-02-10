import { BlockFrostAPI } from '@blockfrost/blockfrost-js';
import { getFrogStats } from '../../utils/frogData.js';
import { getTitanStats } from '../../utils/titansData.js';
import { withDatabase, consumePack } from '../../utils/db.js';
import { getHoskyImageUrl } from '../../utils/hoskyIpfsLoader.js';
import { prisma } from '../../utils/db.js';

const blockfrost = new BlockFrostAPI({
  projectId: process.env.BLOCKFROST_API_KEY,
});

// Define policy IDs and collection information
const COLLECTIONS = {
  'frogs': {
    policyId: '3cf8489b12ded9346708bed263307b362ce813636f92bddfd46e02ec',
    blockedNumbers: ['643'],
    name: 'Frogs',
    maxNumber: 5000,
    fallbackIpfs: 'QmXwXzVg8CvnzFwxnvsjMNq7JAHVn3qyMbwpGumi5AJhXC',
    rarityBreakpoints: { legendary: 5, epic: 20, rare: 500 },
    useBlockfrost: true,
    useCsvLookup: false
  },
  'snekkies': {
    policyId: 'b558ea5ecfa2a6e9701dab150248e94104402f789c090426eb60eb60',
    blockedNumbers: [],
    name: 'Snekkies',
    maxNumber: 7777,
    fallbackIpfs: 'QmbtcFbvt8F9MRuzHkRAZ63cE2WcfTj7NDNeFSSPkw3PY3',
    rarityBreakpoints: { legendary: 50, epic: 250, rare: 750 },
    useBlockfrost: true,
    useCsvLookup: false
  },
  'titans': {
    policyId: '53d6297f4ede5cd3bfed7281b73fad3dac8dc86a950f7454d84c16ad',
    blockedNumbers: [643],
    name: 'Titans',
    maxNumber: 6500,
    fallbackIpfs: 'QmZGxPG7zLmYbNVZijx1Z6P3rZ2UFLtN5rWhrqFTJc9bMx',
    rarityBreakpoints: { legendary: 50, epic: 250, rare: 750 },
    useBlockfrost: true,
    useCsvLookup: false
  },
  'hosky': {
    policyId: 'a0028f350aaabe0545fdcb56b039bfb08e4bb4d8c4d7c3c7d481c235',
    blockedNumbers: [],
    name: 'HOSKY',
    maxNumber: 420420,
    fallbackIpfs: null,
    rarityBreakpoints: { legendary: 100, epic: 1000, rare: 10000 },
    useBlockfrost: false, // HOSKY doesn't use Blockfrost - just random + CSV
    useCsvLookup: true
  },
  'perps': {
    policyId: 'e6ba9c0ff27be029442c32533c6efd956a60d15ecb976acbb64c4de0',
    blockedNumbers: [],
    name: 'Perps',
    maxNumber: 4098,
    fallbackIpfs: 'QmNzvXAYyMxibq2N1Zhe3BDYYUMpCXmeKK1V8Gb6Az2XVF',
    rarityBreakpoints: { legendary: 50, epic: 250, rare: 750 },
    useBlockfrost: true,
    useCsvLookup: false
  }
};

function determineRarity(assetNumber, collection) {
  const num = parseInt(assetNumber);
  const breakpoints = COLLECTIONS[collection].rarityBreakpoints;
  
  if (num <= breakpoints.legendary) return "Legendary";
  if (num <= breakpoints.epic) return "Epic";
  if (num <= breakpoints.rare) return "Rare";
  return "Common";
}

function isAllowedNumber(number, collection) {
  return !COLLECTIONS[collection].blockedNumbers.includes(number.toString());
}

// Check if THIS USER already has this NFT in their database collection
async function isUserDuplicate(nftNumber, collectionPolicyId, collectionName, walletAddress) {
  try {
    // Check database for this specific user + NFT combination
    const existingCard = await prisma.card.findFirst({
      where: {
        tokenId: nftNumber.toString(),
        contractAddress: collectionPolicyId,
        owner: {
          address: walletAddress
        }
      }
    });
    
    if (existingCard) {
      console.log(`⚠️ User ${walletAddress} already owns ${collectionName} #${nftNumber} - skipping`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking user duplicate:', error);
    // If database check fails, be safe and don't allow duplicate
    return false;
  }
}

// Legacy check - keep for backwards compatibility with in-memory collection
function isDuplicate(nftNumber, collection, collectionName, userCards) {
  return userCards.some(card => 
    card.attributes?.find(attr => 
      attr.trait_type === "Number" && 
      attr.value === nftNumber.toString() && 
      card.attributes.find(a => a.trait_type === "Collection" && a.value === collectionName)
    )
  );
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

function sanitizeNumber(number, collectionConfig) {
  if (!number) return null;
  
  const strNum = number.toString();
  const noLeadingZeros = strNum.replace(/^0+/, '');
  
  if (!noLeadingZeros) return null;
  
  let num = parseInt(noLeadingZeros);
  
  if (num <= 0 || num > collectionConfig.maxNumber) {
    return null;
  }
  
  if (!isAllowedNumber(num, collectionConfig.id)) {
    return null;
  }
  
  return num.toString();
}

async function generateRandomCard(collectionConfig, userCards, walletAddress) {
  let randomNumber;
  let attempts = 0;
  
  do {
    randomNumber = Math.floor(Math.random() * collectionConfig.maxNumber) + 1;
    attempts++;
    
    if (attempts > 1000) {
      throw new Error(`No more unique ${collectionConfig.name} available for this user!`);
    }
    
    // Check if number is allowed and not a duplicate for THIS user
    const isAllowed = isAllowedNumber(randomNumber, collectionConfig.id);
    const isMemoryDupe = isDuplicate(randomNumber, collectionConfig.policyId, collectionConfig.name, userCards);
    const isDbDupe = await isUserDuplicate(randomNumber, collectionConfig.policyId, collectionConfig.name, walletAddress);
    
    if (isAllowed && !isMemoryDupe && !isDbDupe) {
      break; // Found a valid unique number for this user
    }
    
    if (attempts % 100 === 0) {
      console.log(`🔄 Attempt ${attempts}: Finding unique ${collectionConfig.name} for user...`);
    }
    
  } while (true);
  
  console.log(`✅ Generated random ${collectionConfig.name} #${randomNumber} for ${walletAddress.slice(0, 8)}...`);
  
  const rarity = determineRarity(randomNumber, collectionConfig.id);
  const basicAttributes = [
    { trait_type: "Collection", value: collectionConfig.name },
    { trait_type: "Number", value: `${randomNumber}` },
    { trait_type: "Class", value: "Peasants" }
  ];
  const stats = collectionConfig.id === 'titans' ? getTitanStats(randomNumber, rarity, basicAttributes) : getFrogStats(randomNumber, rarity);
  
  // Handle image URL - use CSV lookup for Hosky, fallback for others
  let imageUrl;
  if (collectionConfig.useCsvLookup) {
    imageUrl = getHoskyImageUrl(randomNumber);
    console.log(`HOSKY #${randomNumber} image URL: ${imageUrl}`);
    if (!imageUrl) {
      console.error(`❌ No IPFS hash found for ${collectionConfig.name} #${randomNumber}`);
      throw new Error(`No IPFS hash found for ${collectionConfig.name} #${randomNumber}`);
    }
  } else {
    imageUrl = `https://ipfs.io/ipfs/${collectionConfig.fallbackIpfs}/${randomNumber}.png`;
  }
  
  return {
    id: `${collectionConfig.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: `${collectionConfig.name} #${randomNumber}`,
    description: `A unique ${collectionConfig.name} from the Cardano blockchain collection`,
    rarity: rarity,
    image: imageUrl,
    attack: stats.attack,
    health: stats.health,
    speed: stats.speed,
    special: stats.special,
    attributes: [
      { trait_type: "Collection", value: collectionConfig.name },
      { trait_type: "Number", value: `${randomNumber}` },
      { trait_type: "Policy ID", value: collectionConfig.policyId }
    ],
    tokenId: `${randomNumber}`,
    contractAddress: collectionConfig.policyId
  };
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

    if (walletAddress.length < 100 || walletAddress.length > 120) {
      return res.status(400).json({ 
        message: 'Wallet address length is suspicious. Expected 100-120 characters for Cardano addresses.',
        receivedAddress: walletAddress,
        receivedLength: walletAddress.length
      });
    }

    console.log(`🔍 Opening pack for wallet: ${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)} (length: ${walletAddress.length})`);

    // Get requested collection type (defaulting to frogs if not specified)
    const requestedCollection = req.query.collectionType || 'frogs';
    console.log(`📦 Requested collection: ${requestedCollection}`);
    
    // Validate collection type
    if (!COLLECTIONS[requestedCollection]) {
      console.error(`Invalid collection type: ${requestedCollection}`);
      return res.status(400).json({ message: 'Invalid collection type' });
    }
    
    const collectionConfig = {
      ...COLLECTIONS[requestedCollection],
      id: requestedCollection
    };
    
    console.log(`Using policy ID: ${collectionConfig.policyId} for ${collectionConfig.name}`);

    // HOSKY is FREE - skip pack consumption
    if (requestedCollection !== 'hosky') {
      // Consume pack for non-HOSKY collections
      const packResult = await withDatabase(async () => {
        return await consumePack(walletAddress);
      });
      
      if (!packResult.success) {
        return res.status(402).json({ 
          message: 'No packs remaining. Claim your daily +5 packs.',
          balance: packResult.balance
        });
      }
      
      console.log(`✅ Pack consumed. Remaining balance: ${packResult.balance}`);
    } else {
      console.log(`💩 HOSKY is FREE - no pack consumed`);
    }
    
    // Get current collection from request query
    const userCards = req.query.collection ? JSON.parse(req.query.collection) : [];
    
    // Special handling for HOSKY - no Blockfrost, just random generation
    if (requestedCollection === 'hosky') {
      console.log(`Collection ${collectionConfig.name} is using direct random generation with CSV lookup`);
      try {
        const card = await generateRandomCard(collectionConfig, userCards, walletAddress);
        
        // Increment Hosky Poopmeter
        try {
          const existingUser = await prisma.user.findUnique({
            where: { address: walletAddress },
            select: { id: true, hoskyPoopmeter: true }
          });

          let newPoopScore = 0;

          if (existingUser) {
            const updatedUser = await prisma.user.update({
              where: { address: walletAddress },
              data: { 
                hoskyPoopmeter: (existingUser.hoskyPoopmeter || 0) + 1 
              },
              select: { hoskyPoopmeter: true }
            });
            newPoopScore = updatedUser.hoskyPoopmeter;
          } else {
            const newUser = await prisma.user.create({
              data: {
                id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                address: walletAddress,
                balance: '0',
                hoskyPoopmeter: 1
              },
              select: { hoskyPoopmeter: true }
            });
            newPoopScore = newUser.hoskyPoopmeter;
          }
          
          card.poopScore = newPoopScore;
          console.log(`✅ Poopmeter updated: ${newPoopScore}`);
        } catch (dbError) {
          console.error('Error updating poopmeter:', dbError);
          card.poopScore = 0;
        }
        
        return res.status(200).json(card);
      } catch (error) {
        console.error('Error generating HOSKY card:', error);
        return res.status(500).json({ message: 'Error generating HOSKY card', error: error.message });
      }
    }
    
    // Special handling for collections that don't use BlockFrost (like Snekkies)
    if (!collectionConfig.useBlockfrost) {
      console.log(`Collection ${collectionConfig.name} is using direct random generation`);
      try {
        const card = await generateRandomCard(collectionConfig, userCards, walletAddress);
        return res.status(200).json(card);
      } catch (error) {
        console.error('Error generating random card:', error);
        return res.status(500).json({ message: 'Error generating random card', error: error.message });
      }
    }
    
    // For collections using BlockFrost, continue with normal flow
    // Keep trying until we get a valid number that user doesn't already own
    let validNumber = null;
    let attempts = 0;
    let selectedAsset, assetDetails;
    
    while (!validNumber && attempts < 15) {
      attempts++;
      console.log(`Attempt ${attempts} to fetch assets for ${collectionConfig.name}`);
      
      try {
        // Get all assets for the selected policy ID
        const assets = await blockfrost.assetsPolicyById(collectionConfig.policyId);
        console.log(`Found ${assets.length} assets for policy ID ${collectionConfig.policyId}`);
        
        if (assets.length === 0) {
          console.error(`No assets found for policy ID: ${collectionConfig.policyId}`);
          continue;
        }
        
        // Generate a random index to select a random NFT
        const randomIndex = Math.floor(Math.random() * assets.length);
        selectedAsset = assets[randomIndex];
        
        // Get detailed asset information
        console.log(`Fetching details for asset: ${selectedAsset.asset}`);
        assetDetails = await blockfrost.assetsById(selectedAsset.asset);
        
        // Get the NFT number
        let nftNumber;
        
        // Try to extract from image URL first (most accurate)
        if (assetDetails.onchain_metadata?.image) {
          const imageUrl = assetDetails.onchain_metadata.image;
          console.log(`Found image URL: ${imageUrl}`);
          const imageMatch = imageUrl.match(/\/(\d+)\.png$/);
          if (imageMatch && imageMatch[1]) {
            nftNumber = sanitizeNumber(imageMatch[1], collectionConfig);
            console.log(`Extracted number from image URL: ${nftNumber}`);
          }
        }
        
        // Fallback to other methods if image URL didn't contain a number
        if (!nftNumber) {
          if (assetDetails.onchain_metadata?.name) {
            const nameMatch = assetDetails.onchain_metadata.name.match(/(\d+)/);
            if (nameMatch && nameMatch[1]) {
              nftNumber = sanitizeNumber(nameMatch[1], collectionConfig);
              console.log(`Extracted number from metadata name: ${nftNumber}`);
            }
          }
          
          // For Titans collection, try to decode the hex asset name
          if (collectionConfig.id === 'titans') {
            try {
              const hexPart = selectedAsset.asset.replace(collectionConfig.policyId, '');
              const hexText = hexPart.slice(8);
              let text = '';
              
              for (let i = 0; i < hexText.length; i += 2) {
                text += String.fromCharCode(parseInt(hexText.substr(i, 2), 16));
              }
              
              console.log(`Decoded asset name: ${text}`);
              
              const numberMatch = text.match(/HouseOfTitans(\d+)/);
              if (numberMatch && numberMatch[1]) {
                nftNumber = sanitizeNumber(numberMatch[1], collectionConfig);
                console.log(`Extracted number from decoded asset name: ${nftNumber}`);
              }
            } catch (e) {
              console.error("Error decoding hex asset name:", e);
            }
          }
          
          if (!nftNumber) {
            const assetNameDigits = assetDetails.asset_name?.match(/\d+/)?.[0];
            nftNumber = sanitizeNumber(assetNameDigits, collectionConfig);
            console.log(`Extracted number from asset name: ${nftNumber}`);
          }
        }
        
        // Check if valid number, allowed, and NOT already owned by THIS user
        if (nftNumber && isAllowedNumber(nftNumber, collectionConfig.id)) {
          // Check both in-memory and database for user duplicates
          const isMemoryDupe = isDuplicate(nftNumber, collectionConfig.policyId, collectionConfig.name, userCards);
          const isDbDupe = await isUserDuplicate(nftNumber, collectionConfig.policyId, collectionConfig.name, walletAddress);
          
          if (!isMemoryDupe && !isDbDupe) {
            validNumber = nftNumber;
            console.log(`✅ Found valid unique NFT for user: ${validNumber}`);
          } else {
            console.log(`⚠️ NFT #${nftNumber} already owned by this user - trying different NFT...`);
          }
        } else {
          console.log(`NFT number ${nftNumber} is invalid or blocked. Trying again...`);
        }
      } catch (error) {
        console.error(`Error in attempt ${attempts}:`, error);
      }
    }
    
    if (validNumber) {
      try {
        const extractedImageUrl = extractImageUrl(assetDetails);
        const fallbackImageUrl = `https://ipfs.io/ipfs/${collectionConfig.fallbackIpfs}/${validNumber}.png`;
        const imageUrl = extractedImageUrl || fallbackImageUrl;
        
        console.log('Asset ID:', selectedAsset.asset);
        console.log('NFT Name:', assetDetails.onchain_metadata?.name || assetDetails.asset_name);
        console.log('Original digits:', assetDetails.asset_name?.match(/\d+/)?.[0]);
        console.log(`Valid ${collectionConfig.name} #:`, validNumber);
        console.log('Final image URL:', imageUrl);
        
        const rarity = determineRarity(validNumber, collectionConfig.id);
        const stats = collectionConfig.id === 'titans' ? getTitanStats(validNumber, rarity, assetDetails.onchain_metadata?.attributes) : getFrogStats(validNumber, rarity);
        
        const card = {
          id: `${collectionConfig.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: `${collectionConfig.name} #${validNumber}`,
          description: assetDetails.onchain_metadata?.description || `A unique ${collectionConfig.name} from the Cardano blockchain collection`,
          rarity: rarity,
          image: imageUrl,
          attack: stats.attack,
          health: stats.health,
          speed: stats.speed,
          special: stats.special,
          attributes: [
            { trait_type: "Collection", value: collectionConfig.name },
            { trait_type: "Number", value: `${validNumber}` },
            { trait_type: "Policy ID", value: collectionConfig.policyId },
            { trait_type: "Asset Name", value: assetDetails.asset_name }
          ],
          tokenId: assetDetails.asset_name || validNumber.toString(),
          contractAddress: collectionConfig.policyId
        };

        console.log(`✅ Generated card for ${collectionConfig.name} #${validNumber}`);
        
        return res.status(200).json(card);
      } catch (error) {
        console.error('Error generating card:', error);
        return res.status(500).json({ message: 'Error generating card', error: error.message });
      }
    } else {
      console.log(`Couldn't find a valid unique NFT after ${attempts} attempts, generating a random one...`);
      try {
        const card = await generateRandomCard(collectionConfig, userCards, walletAddress);
        return res.status(200).json(card);
      } catch (error) {
        console.error('Error generating random card:', error);
        return res.status(500).json({ message: 'Error generating random card', error: error.message });
      }
    }
  } catch (error) {
    console.error('Error fetching NFT:', error);
    res.status(500).json({ message: 'Error opening pack', error: error.message });
  }
}
