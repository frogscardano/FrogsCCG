import { BlockFrostAPI } from '@blockfrost/blockfrost-js';
import { getFrogStats } from '../../utils/frogData';

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
    rarityBreakpoints: { legendary: 5, epic: 20, rare: 500 }, // The rest are common
    useBlockfrost: true
  },
  'snekkies': {
    policyId: 'b558ea5ecfa2a6e9701dab150248e94104402f789c090426eb60eb60',
    blockedNumbers: [],
    name: 'Snekkies',
    maxNumber: 7777,
    fallbackIpfs: 'QmbtcFbvt8F9MRuzHkRAZ63cE2WcfTj7NDNeFSSPkw3PY3',
    rarityBreakpoints: { legendary: 50, epic: 250, rare: 750 }, // The rest are common
    useBlockfrost: true 
  },
  'titans': {
    policyId: '53d6297f4ede5cd3bfed7281b73fad3dac8dc86a950f7454d84c16ad',
    blockedNumbers: [643],
    name: 'Titans',
    maxNumber: 6500,
    fallbackIpfs: 'QmZGxPG7zLmYbNVZijx1Z6P3rZ2UFLtN5rWhrqFTJc9bMx',
    rarityBreakpoints: { legendary: 50, epic: 250, rare: 750 }, // The rest are common
    useBlockfrost: true 
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

// Function to check if a number is allowed
function isAllowedNumber(number, collection) {
  return !COLLECTIONS[collection].blockedNumbers.includes(number.toString());
}

// Function to check if an NFT is already in collection
function isDuplicate(nftNumber, collection, collectionName, userCards) {
  return userCards.some(card => 
    card.attributes?.find(attr => 
      attr.trait_type === "Number" && 
      attr.value === nftNumber.toString() && 
      card.attributes.find(a => a.trait_type === "Collection" && a.value === collectionName)
    )
  );
}

// Function to extract IPFS image URL from metadata
function extractImageUrl(metadata) {
  // Try to get image from metadata
  if (metadata.onchain_metadata?.image) {
    let imageUrl = metadata.onchain_metadata.image;
    
    // Handle ipfs:// protocol
    if (imageUrl.startsWith('ipfs://')) {
      const ipfsHash = imageUrl.replace('ipfs://', '');
      return `https://ipfs.io/ipfs/${ipfsHash}`;
    }
    
    return imageUrl;
  }
  
  // Try other metadata fields
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

// Function to sanitize numbers - ensures we don't get crazy long numbers
function sanitizeNumber(number, collectionConfig) {
  if (!number) return null;
  
  // Convert to string if it's a number
  const strNum = number.toString();
  
  // Remove leading zeros
  const noLeadingZeros = strNum.replace(/^0+/, '');
  
  // If it's empty after removing zeros, it was just zeros
  if (!noLeadingZeros) return null;
  
  // Parse as integer to normalize
  let num = parseInt(noLeadingZeros);
  
  // Enforce range based on collection's maxNumber
  if (num <= 0 || num > collectionConfig.maxNumber) {
    return null;
  }
  
  // Skip blocked numbers
  if (!isAllowedNumber(num, collectionConfig.id)) {
    return null;
  }
  
  return num.toString();
}

// Function to generate a random card for collections that don't use BlockFrost
function generateRandomCard(collectionConfig, userCards) {
  let randomNumber;
  let attempts = 0;
  
  do {
    randomNumber = Math.floor(Math.random() * collectionConfig.maxNumber) + 1;
    attempts++;
    if (attempts > 1000) {
      throw new Error(`No more unique ${collectionConfig.name} available!`);
    }
  } while (!isAllowedNumber(randomNumber, collectionConfig.id) || 
           isDuplicate(randomNumber, collectionConfig.policyId, collectionConfig.name, userCards));
  
  console.log(`Generated random ${collectionConfig.name} #:`, randomNumber);
  console.log(`Using IPFS: ${collectionConfig.fallbackIpfs}`);
  
  const rarity = determineRarity(randomNumber, collectionConfig.id);
  const stats = getFrogStats(randomNumber, rarity);
  
  return {
    id: `${collectionConfig.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: `${collectionConfig.name} #${randomNumber}`,
    description: `A unique ${collectionConfig.name} from the Cardano blockchain collection`,
    rarity: rarity,
    image: `https://ipfs.io/ipfs/${collectionConfig.fallbackIpfs}/${randomNumber}.png`,
    attack: stats.attack,
    health: stats.health,
    speed: stats.speed,
    special: stats.special,
    attributes: [
      { trait_type: "Collection", value: collectionConfig.name },
      { trait_type: "Number", value: `${randomNumber}` },
      { trait_type: "Policy ID", value: collectionConfig.policyId }
    ]
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Get wallet address from query parameters
    const walletAddress = req.query.walletAddress;
    
    if (!walletAddress) {
      return res.status(400).json({ message: 'Wallet address is required' });
    }

    // Get current collection from request query
    const userCards = req.query.collection ? JSON.parse(req.query.collection) : [];
    
    // Get requested collection type (defaulting to frogs if not specified)
    const requestedCollection = req.query.collectionType || 'frogs';
    console.log(`Requested collection: ${requestedCollection}`);
    
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
    
    // Special handling for collections that don't use BlockFrost (like Snekkies)
    if (!collectionConfig.useBlockfrost) {
      console.log(`Collection ${collectionConfig.name} is using direct random generation`);
      try {
        const card = generateRandomCard(collectionConfig, userCards);
        return res.status(200).json(card);
      } catch (error) {
        console.error('Error generating random card:', error);
        return res.status(500).json({ message: 'Error generating random card', error: error.message });
      }
    }
    
    // For collections using BlockFrost, continue with normal flow
    // Keep trying until we get a valid number
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
          // Extract number from URL patterns like ".../{number}.png"
          const imageMatch = imageUrl.match(/\/(\d+)\.png$/);
          if (imageMatch && imageMatch[1]) {
            nftNumber = sanitizeNumber(imageMatch[1], collectionConfig);
            console.log(`Extracted number from image URL: ${nftNumber}`);
          }
        }
        
        // Fallback to other methods if image URL didn't contain a number
        if (!nftNumber) {
          // Check if there's an explicit name with number in the metadata
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
              // Convert the hex asset name to ASCII and extract the number
              const hexPart = selectedAsset.asset.replace(collectionConfig.policyId, '');
              // Skip the first few bytes which usually contain metadata
              const hexText = hexPart.slice(8); // Skip first 8 characters
              let text = '';
              
              // Convert hex to ASCII
              for (let i = 0; i < hexText.length; i += 2) {
                text += String.fromCharCode(parseInt(hexText.substr(i, 2), 16));
              }
              
              console.log(`Decoded asset name: ${text}`);
              
              // Extract the number - assuming format like "HouseOfTitans4971"
              const numberMatch = text.match(/HouseOfTitans(\d+)/);
              if (numberMatch && numberMatch[1]) {
                nftNumber = sanitizeNumber(numberMatch[1], collectionConfig);
                console.log(`Extracted number from decoded asset name: ${nftNumber}`);
              }
            } catch (e) {
              console.error("Error decoding hex asset name:", e);
            }
          }
          
          // If still no number, try the original approach
          if (!nftNumber) {
            // Extract only the first set of digits from the asset name
            const assetNameDigits = assetDetails.asset_name?.match(/\d+/)?.[0];
            nftNumber = sanitizeNumber(assetNameDigits, collectionConfig);
            console.log(`Extracted number from asset name: ${nftNumber}`);
          }
        }
        
        // If we found a valid number, it's not blocked, and not a duplicate, use this asset
        if (nftNumber && 
            isAllowedNumber(nftNumber, collectionConfig.id) && 
            !isDuplicate(nftNumber, collectionConfig.policyId, collectionConfig.name, userCards)) {
          validNumber = nftNumber;
          console.log(`Found valid NFT number: ${validNumber}`);
        } else {
          console.log(`NFT number ${nftNumber} is invalid, blocked, or a duplicate. Trying again...`);
        }
      } catch (error) {
        console.error(`Error in attempt ${attempts}:`, error);
        // Continue to next attempt
      }
    }
    
    if (validNumber) {
      try {
        // Get the actual image URL from the metadata
        const imageUrl = extractImageUrl(assetDetails) || 
                        // Fallback to known IPFS URLs for this collection  
                        `https://ipfs.io/ipfs/${collectionConfig.fallbackIpfs}/${validNumber}.png`;
        
        console.log('Asset ID:', selectedAsset.asset);
        console.log('NFT Name:', assetDetails.onchain_metadata?.name || assetDetails.asset_name);
        console.log('Original digits:', assetDetails.asset_name?.match(/\d+/)?.[0]);
        console.log(`Valid ${collectionConfig.name} #:`, validNumber);
        console.log('Image URL:', imageUrl);
        
        // Determine rarity and get stats
        const rarity = determineRarity(validNumber, collectionConfig.id);
        const stats = getFrogStats(validNumber, rarity);
        
        // Create the card data
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
          ]
        };

        // Save the NFT data to the database
        const saveResponse = await fetch(`/api/collections/${walletAddress}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userAddress: walletAddress,
            tokenId: card.id,
            contractAddress: collectionConfig.policyId,
            metadata: {
              name: card.name,
              image: card.image,
              number: validNumber,
              collection: collectionConfig.name,
              rarity: card.rarity,
              attributes: card.attributes
            }
          }),
        });

        if (!saveResponse.ok) {
          console.error('Failed to save NFT data:', await saveResponse.text());
        }

        return res.status(200).json(card);
      } catch (error) {
        console.error('Error saving NFT data:', error);
        return res.status(500).json({ message: 'Error saving NFT data', error: error.message });
      }
    } else {
      console.log(`Couldn't find a valid NFT after ${attempts} attempts, generating a random one...`);
      // If we couldn't find a valid NFT after multiple attempts,
      // generate a random one in the valid range (avoiding blocked numbers and duplicates)
      try {
        const card = generateRandomCard(collectionConfig, userCards);
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
