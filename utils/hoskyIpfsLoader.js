// utils/hoskyIpfsLoader.js
import fs from 'fs';
import path from 'path';

let hoskyIpfsMap = null;

/**
 * Loads and caches the Hosky IPFS mapping from CSV
 * Format: token_number,ipfs_hash (one per line)
 */
export function loadHoskyIpfsMap() {
  if (hoskyIpfsMap) {
    return hoskyIpfsMap; // Return cached version
  }

  try {
    // Load CSV file from utils/data directory
    const csvPath = path.join(process.cwd(), 'utils', 'data', 'hosky-ipfs.csv');
    
    if (!fs.existsSync(csvPath)) {
      console.error('❌ HOSKY CSV file not found at:', csvPath);
      throw new Error('HOSKY CSV file not found');
    }
    
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Parse CSV - split by newlines
    const lines = fileContent.split(/\r?\n/).filter(line => line.trim());
    
    // Create Map for fast lookup: tokenNumber -> ipfsHash
    hoskyIpfsMap = new Map();
    
    console.log(`📋 Processing ${lines.length} lines from HOSKY CSV...`);
    
    lines.forEach((line, index) => {
      const columns = line.split(',');
      
      if (columns.length >= 2) {
        // Format: token_number,ipfs_hash
        const tokenNumber = parseInt(columns[0].trim());
        let ipfsHash = columns[1].trim();
        
        // Clean the IPFS hash
        ipfsHash = ipfsHash.replace(/['"]/g, ''); // Remove quotes
        ipfsHash = ipfsHash.replace('ipfs://', ''); // Remove ipfs:// prefix
        ipfsHash = ipfsHash.trim(); // Remove whitespace
        
        // Validate: Should be 46 chars starting with Qm (CIDv0)
        if (ipfsHash.startsWith('Qm') && ipfsHash.length === 46) {
          hoskyIpfsMap.set(tokenNumber, ipfsHash);
        } else if (ipfsHash.startsWith('baf') && ipfsHash.length > 40) {
          // CIDv1 format is also valid
          hoskyIpfsMap.set(tokenNumber, ipfsHash);
        } else {
          // Log first few invalid for debugging
          if (hoskyIpfsMap.size < 3) {
            console.warn(`⚠️ Line ${index + 1}: Invalid hash "${ipfsHash}" (length: ${ipfsHash.length})`);
          }
        }
      }
    });

    console.log(`✅ Loaded ${hoskyIpfsMap.size} valid HOSKY IPFS mappings`);
    
    if (hoskyIpfsMap.size === 0) {
      console.error('❌ No valid IPFS hashes found in CSV!');
      throw new Error('No valid IPFS hashes found in CSV');
    }
    
    // Log sample entries
    const sampleNumbers = Array.from(hoskyIpfsMap.keys()).slice(0, 3);
    console.log('📝 Sample HOSKY entries:');
    sampleNumbers.forEach(num => {
      const hash = hoskyIpfsMap.get(num);
      console.log(`   HOSKY #${num} -> ${hash}`);
    });
    
    return hoskyIpfsMap;
    
  } catch (error) {
    console.error('❌ Error loading Hosky IPFS map:', error);
    throw error;
  }
}

/**
 * Get IPFS hash for a specific Hosky token number
 */
export function getHoskyIpfs(tokenNumber) {
  const map = loadHoskyIpfsMap();
  const ipfsHash = map.get(parseInt(tokenNumber));
  
  if (!ipfsHash) {
    console.warn(`⚠️ No IPFS hash found for Hosky #${tokenNumber}`);
    console.log(`   Available range: 1-${map.size}`);
  }
  
  return ipfsHash;
}

/**
 * Get full IPFS URL for a Hosky token
 */
export function getHoskyImageUrl(tokenNumber) {
  const ipfsHash = getHoskyIpfs(tokenNumber);
  
  if (!ipfsHash) {
    console.error(`❌ No IPFS hash found for Hosky #${tokenNumber}`);
    return null;
  }
  
  const url = `https://ipfs.io/ipfs/${ipfsHash}`;
  console.log(`✅ HOSKY #${tokenNumber} -> ${url}`);
  
  return url;
}

/**
 * Get all available gateway URLs for a HOSKY token
 */
export function getHoskyImageGateways(tokenNumber) {
  const ipfsHash = getHoskyIpfs(tokenNumber);
  
  if (!ipfsHash) {
    return [];
  }
  
  return [
    `https://ipfs.io/ipfs/${ipfsHash}`,
    `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`,
    `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
    `https://dweb.link/ipfs/${ipfsHash}`
  ];
}

/**
 * Check if a HOSKY number exists
 */
export function hoskyNumberExists(tokenNumber) {
  const map = loadHoskyIpfsMap();
  return map.has(parseInt(tokenNumber));
}

/**
 * Get total count
 */
export function getTotalHoskyCount() {
  const map = loadHoskyIpfsMap();
  return map.size;
}
