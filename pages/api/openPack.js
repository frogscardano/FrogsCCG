// pages/api/openPack.js
import { BlockFrostAPI } from '@blockfrost/blockfrost-js';
import { getFrogStats } from '../../utils/frogData.js';
import { getTitanStats } from '../../utils/titansData.js';
import { withDatabase } from '../../utils/db.js';

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
    useBlockfrost: true
  },
  'snekkies': {
    policyId: 'b558ea5ecfa2a6e9701dab150248e94104402f789c090426eb60eb60',
    blockedNumbers: [],
    name: 'Snekkies',
    maxNumber: 7777,
    fallbackIpfs: 'QmbtcFbvt8F9MRuzHkRAZ63cE2WcfTj7NDNeFSSPkw3PY3',
    rarityBreakpoints: { legendary: 50, epic: 250, rare: 750 },
    useBlockfrost: true
  },
  'titans': {
    policyId: '53d6297f4ede5cd3bfed7281b73fad3dac8dc86a950f7454d84c16ad',
    blockedNumbers: [643],
    name: 'Titans',
    maxNumber: 6500,
    fallbackIpfs: 'QmZGxPG7zLmYbNVZijx1Z6P3rZ2UFLtN5rWhrqFTJc9bMx',
    rarityBreakpoints: { legendary: 50, epic: 250, rare: 750 },
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

function isAllowedNumber(number, collection) {
  return !COLLECTIONS[collection].blockedNumbers.includes(number.toString());
}

function isDuplicate(nftNumber, collection, collectionName, userCards) {
  return userCards.some(card =>
    card.attributes?.find(attr =>
      attr.trait_type === "Number" &&
      attr.value === nftNumber.toString() &&
      card.attributes.find(a => a.trait_type === "Collection" && a.value === collectionName)
    )
  );
}

// Normalize/unwrap onchain metadata for payloads like your Snekkies example.
// Some collections wrap the useful metadata inside an object keyed by asset name or policy id.
// This function will return the inner object if it contains expected fields (image/files/name/attributes).
function getEffectiveMetadata(assetDetails) {
  const meta = assetDetails.onchain_metadata || assetDetails.metadata || {};
  // If metadata already has image/files/name/attributes at top level, use it.
  if (meta && (meta.image || meta.files || meta.name || meta.attributes || meta.attributes === null)) {
    return meta;
  }

  // Otherwise try to find a child object that contains the expected fields.
  for (const k of Object.keys(meta)) {
    const child = meta[k];
    if (child && (child.image || child.files || child.name || child.attributes)) {
      return child;
    }
  }

  // Some payloads nest further (e.g., policyId -> assetName -> metadata). Try one more level.
  for (const k of Object.keys(meta)) {
    const level2 = meta[k];
    if (level2 && typeof level2 === 'object') {
      for (const k2 of Object.keys(level2)) {
        const child = level2[k2];
        if (child && (child.image || child.files || child.name || child.attributes)) {
          return child;
        }
      }
    }
  }

  // fallback to original meta (may be empty)
  return meta;
}

// Improved extractor for image URL including arrays and ipfs://
function extractImageUrlFromMeta(effectiveMeta) {
  if (!effectiveMeta) return null;
  // image can be a string or an array
  let image = effectiveMeta.image;
  if (Array.isArray(image) && image.length) image = image[0];
  if (typeof image === 'string' && image) {
    if (image.startsWith('ipfs://')) {
      const ipfsHash = image.replace('ipfs://', '');
      return `https://ipfs.io/ipfs/${ipfsHash}`;
    }
    return image;
  }

  // Some metadata put files array
  if (effectiveMeta.files && Array.isArray(effectiveMeta.files) && effectiveMeta.files.length > 0) {
    const file = effectiveMeta.files[0];
    const src = file.src || file.uri || file.u;
    if (typeof src === 'string') {
      if (src.startsWith('ipfs://')) {
        const ipfsHash = src.replace('ipfs://', '');
        return `https://ipfs.io/ipfs/${ipfsHash}`;
      }
      return src;
    }
    // also try name + fallback ipfs base if src not present
    if (file.name && file.name.match(/\.(png|jpg|jpeg|gif)$/i) && effectiveMeta.image && effectiveMeta.image.startsWith('ipfs://')) {
      // rare, but attempt to construct from image base
      const ipfsHash = effectiveMeta.image.replace('ipfs://', '');
      return `https://ipfs.io/ipfs/${ipfsHash}`;
    }
  }

  return null;
}

// Normalize and validate numbers
function sanitizeNumber(number, collectionConfig) {
  if (!number) return null;
  const strNum = number.toString();
  // find up to 6 digits sequence and strip leading zeros
  const match = strNum.match(/0*([0-9]{1,6})/);
  if (!match) return null;
  const noLeadingZeros = match[1];
  const num = parseInt(noLeadingZeros, 10);
  if (isNaN(num) || num <= 0 || num > collectionConfig.maxNumber) return null;
  if (!isAllowedNumber(num, collectionConfig.id)) return null;
  return num.toString();
}

// generate random fallback card
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

  const rarity = determineRarity(randomNumber, collectionConfig.id);
  const basicAttributes = [
    { trait_type: "Collection", value: collectionConfig.name },
    { trait_type: "Number", value: `${randomNumber}` },
    { trait_type: "Class", value: "Peasants" }
  ];
  const stats = collectionConfig.id === 'titans' ? getTitanStats(randomNumber, rarity, basicAttributes) : getFrogStats(randomNumber, rarity);

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

// Helper: fetch a random asset from the policy using pagination so we sample across the whole collection
async function fetchRandomAssetFromPolicy(policyId, collectionConfig) {
  const pageSize = 100;
  const maxPages = Math.max(1, Math.ceil(collectionConfig.maxNumber / pageSize));
  const page = Math.floor(Math.random() * maxPages) + 1;
  console.log(`Fetching policy assets page ${page}/${maxPages} (pageSize ${pageSize}) for ${collectionConfig.name}`);
  const assets = await blockfrost.assetsPolicyById(policyId, { page, count: pageSize });
  return assets;
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

    // relaxed validation
    if (walletAddress.length < 20 || walletAddress.length > 300) {
      console.warn('Suspicious wallet address length, but continuing:', walletAddress.length);
    }

    if (!process.env.BLOCKFROST_API_KEY) {
      console.error('Missing BLOCKFROST_API_KEY in environment');
      return res.status(500).json({ message: 'Server configuration error: Blockfrost key missing' });
    }

    try {
      return await withDatabase(async (prisma) => {
        let user = await prisma.user.findUnique({ where: { address: walletAddress } });
        if (!user) {
          user = await prisma.user.create({ data: { address: walletAddress, balance: '0' } });
        }
        const currentBalance = typeof user.balance === 'string' ? parseInt(user.balance || '0', 10) : (user.balance ?? 0);
        if (currentBalance <= 0) {
          return res.status(402).json({ message: 'No packs remaining. Claim your daily +5 packs.' });
        }
        await prisma.user.update({
          where: { address: walletAddress },
          data: { balance: String(currentBalance - 1) }
        });

        const userCards = req.query.collection ? JSON.parse(req.query.collection) : [];
        const requestedCollection = req.query.collectionType || 'frogs';
        if (!COLLECTIONS[requestedCollection]) {
          return res.status(400).json({ message: 'Invalid collection type' });
        }

        const collectionConfig = {
          ...COLLECTIONS[requestedCollection],
          id: requestedCollection
        };

        if (!collectionConfig.useBlockfrost) {
          try {
            const card = generateRandomCard(collectionConfig, userCards);
            return res.status(200).json(card);
          } catch (error) {
            console.error('Error generating random card:', error);
            return res.status(500).json({ message: 'Error generating random card', error: error.message });
          }
        }

        let validNumber = null;
        let attempts = 0;
        let selectedAsset, assetDetails;

        while (!validNumber && attempts < 20) {
          attempts++;
          try {
            const assets = await fetchRandomAssetFromPolicy(collectionConfig.policyId, collectionConfig);
            if (!assets || assets.length === 0) {
              console.warn('No assets returned for this page, trying another page...');
              continue;
            }

            const randomIndex = Math.floor(Math.random() * assets.length);
            selectedAsset = assets[randomIndex];

            assetDetails = await blockfrost.assetsById(selectedAsset.asset);

            // Normalize onchain metadata (handles nested object like your example)
            const effectiveMeta = getEffectiveMetadata(assetDetails);

            // Try to extract number from many possible spots
            let nftNumber = null;

            // 1) from files[].name
            if (effectiveMeta && Array.isArray(effectiveMeta.files) && effectiveMeta.files.length > 0) {
              const fname = effectiveMeta.files[0].name || effectiveMeta.files[0].file || '';
              const fmatch = fname.match(/0*([0-9]{1,6})/);
              if (fmatch && fmatch[1]) {
                nftNumber = sanitizeNumber(fmatch[1], collectionConfig);
                if (nftNumber) console.log('Extracted number from files[0].name:', nftNumber);
              }
            }

            // 2) from effectiveMeta.name (e.g., "Snekkie #2002")
            if (!nftNumber && effectiveMeta && effectiveMeta.name) {
              const nameMatch = effectiveMeta.name.match(/0*([0-9]{1,6})/);
              if (nameMatch && nameMatch[1]) {
                nftNumber = sanitizeNumber(nameMatch[1], collectionConfig);
                if (nftNumber) console.log('Extracted number from metadata.name:', nftNumber);
              }
            }

            // 3) from image filename (if image is ipfs://.../Snekkie2002.png)
            if (!nftNumber) {
              const imageUrl = extractImageUrlFromMeta(effectiveMeta) || effectiveMeta?.image;
              if (imageUrl) {
                const filenameMatch = imageUrl.match(/\/([^\/?#]+)(?:\?|#|$)/);
                if (filenameMatch && filenameMatch[1]) {
                  const digitsMatch = filenameMatch[1].match(/0*([0-9]{1,6})/);
                  if (digitsMatch && digitsMatch[1]) {
                    nftNumber = sanitizeNumber(digitsMatch[1], collectionConfig);
                    if (nftNumber) console.log('Extracted number from image filename:', nftNumber);
                  }
                }
              }
            }

            // 4) decode hex part for asset_name (fallback)
            if (!nftNumber && selectedAsset.asset) {
              try {
                const hexPart = selectedAsset.asset.replace(collectionConfig.policyId, '');
                let hexText = hexPart;
                if (hexText.length > 8) hexText = hexText.slice(8);
                let text = '';
                for (let i = 0; i < hexText.length; i += 2) {
                  const code = parseInt(hexText.substr(i, 2), 16);
                  if (!isNaN(code) && code !== 0) text += String.fromCharCode(code);
                }
                const numberMatch = text.match(/0*([0-9]{1,6})/);
                if (numberMatch && numberMatch[1]) {
                  nftNumber = sanitizeNumber(numberMatch[1], collectionConfig);
                  if (nftNumber) console.log('Extracted number from decoded asset name:', nftNumber, 'decoded text:', text);
                }
              } catch (e) {
                console.warn('Error decoding hex asset name', e.message);
              }
            }

            // 5) fallback to asset_name digits
            if (!nftNumber && assetDetails.asset_name) {
              const assetNameDigits = assetDetails.asset_name.match(/0*([0-9]{1,6})/)?.[1];
              nftNumber = sanitizeNumber(assetNameDigits, collectionConfig);
              if (nftNumber) console.log('Extracted number from asset_name:', nftNumber);
            }

            if (nftNumber && isAllowedNumber(nftNumber, collectionConfig.id) && !isDuplicate(nftNumber, collectionConfig.policyId, collectionConfig.name, userCards)) {
              validNumber = nftNumber;
              console.log(`Found valid NFT number: ${validNumber}`);
            } else {
              console.log(`Candidate nftNumber ${nftNumber} invalid/blocked/duplicate or null; continuing`);
            }
          } catch (err) {
            console.error(`Error in Blockfrost attempt ${attempts}:`, err.message || err);
          }
        }

        if (validNumber) {
          try {
            const effectiveMeta = getEffectiveMetadata(assetDetails);
            const extractedImageUrl = extractImageUrlFromMeta(effectiveMeta);
            const fallbackImageUrl = `https://ipfs.io/ipfs/${collectionConfig.fallbackIpfs}/${validNumber}.png`;
            const imageUrl = extractedImageUrl || fallbackImageUrl;

            const rarity = determineRarity(validNumber, collectionConfig.id);
            const stats = collectionConfig.id === 'titans' ? getTitanStats(validNumber, rarity, effectiveMeta?.attributes) : getFrogStats(validNumber, rarity);

            const card = {
              id: `${collectionConfig.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: `${collectionConfig.name} #${validNumber}`,
              description: effectiveMeta?.description || `A unique ${collectionConfig.name} from the Cardano blockchain collection`,
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
                { trait_type: "Asset Name", value: assetDetails.asset_name || '' }
              ]
            };

            if (!card.name || !card.rarity || !card.image || typeof card.attack === 'undefined' || typeof card.health === 'undefined' || typeof card.speed === 'undefined') {
              console.error('Invalid card data:', card);
              throw new Error('Invalid card data - missing required fields');
            }

            const nftDataToSave = {
              id: `${collectionConfig.name.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: card.name,
              rarity: card.rarity,
              image: card.image,
              description: card.description,
              attack: card.attack,
              health: card.health,
              speed: card.speed,
              attributes: card.attributes,
              tokenId: card.attributes.find(attr => attr.trait_type === "Asset Name")?.value || validNumber.toString(),
              contractAddress: collectionConfig.policyId
            };

            try {
              const { default: collectionsHandler } = await import('./collections/[address].js');
              const mockReq = {
                method: 'POST',
                query: { address: walletAddress },
                body: [nftDataToSave]
              };
              let responseData = null;
              let responseStatus = 200;
              const mockRes = {
                status: (code) => { responseStatus = code; return mockRes; },
                json: (data) => { responseData = data; return mockRes; },
                end: (data) => { responseData = data; return mockRes; }
              };
              await collectionsHandler(mockReq, mockRes);
              if (responseStatus === 200 && responseData) {
                return res.status(200).json({ ...card, saveSuccess: true, savedNft: responseData });
              } else {
                throw new Error(`Collections API returned status ${responseStatus}`);
              }
            } catch (saveError) {
              console.error('Error saving NFT to DB:', saveError.message || saveError);
              return res.status(200).json({
                ...card,
                saveWarning: 'NFT was generated but failed to save to database. Please try again later.',
                saveError: saveError.message
              });
            }
          } catch (error) {
            console.error('Error saving NFT data:', error.message || error);
            return res.status(500).json({ message: 'Error saving NFT data', error: error.message || error });
          }
        } else {
          console.log(`Couldn't find a valid NFT after ${attempts} attempts, generating a random one...`);
          try {
            const card = generateRandomCard(collectionConfig, userCards);
            return res.status(200).json(card);
          } catch (error) {
            console.error('Error generating random card:', error);
            return res.status(500).json({ message: 'Error generating random card', error: error.message });
          }
        }
      });
    } catch (balanceError) {
      console.error('Balance check/decrement failed:', balanceError);
      return res.status(500).json({ message: 'Failed to verify pack balance' });
    }
  } catch (error) {
    console.error('Error fetching NFT:', error);
    res.status(500).json({ message: 'Error opening pack', error: error.message || error });
  }
}
