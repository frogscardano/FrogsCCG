// utils/hoskyIpfsLoader.js
import fs from 'fs';
import path from 'path';

let hoskyIpfsMap = null;

/**
 * Loads and caches the Hosky IPFS mapping from CSV
 * Format: line number corresponds to token number, value is IPFS hash
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
    
    // Parse CSV manually (simple split, no need for papaparse)
    const lines = fileContent.split('\n').filter(line => line.trim());
    
    // Create Map for fast lookup: tokenNumber -> ipfsHash
    hoskyIpfsMap = new Map();
    
    lines.forEach((line, index) => {
      const tokenNumber = index + 1; // Lines start at 1
      const columns = line.split(',');
      const ipfsHash = columns[1]; // Second column has the IPFS hash
      
      if (ipfsHash && ipfsHash.trim()) {
        // Clean the IPFS hash - remove 'ipfs://' prefix if present
        const cleanHash = ipfsHash.trim().replace('ipfs://', '');
        hoskyIpfsMap.set(tokenNumber, cleanHash);
      }
    });

    console.log(`✅ Loaded ${hoskyIpfsMap.size} Hosky IPFS mappings`);
    
    // Log sample entries for debugging
    const sampleNumbers = Array.from(hoskyIpfsMap.keys()).slice(0, 5);
    console.log('Sample HOSKY entries:', sampleNumbers.map(n => `#${n}`).join(', '));
    
    return hoskyIpfsMap;
    
  } catch (error) {
    console.error('❌ Error loading Hosky IPFS map:', error);
    throw new Error('Failed to load Hosky IPFS mapping');
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
    console.log(`Available range: 1-${map.size}`);
  }
  
  return ipfsHash;
}

/**
 * Get full IPFS URL for a Hosky token with multiple gateway options
 */
export function getHoskyImageUrl(tokenNumber) {
  const ipfsHash = getHoskyIpfs(tokenNumber);
  
  if (!ipfsHash) {
    console.error(`❌ No IPFS hash found for Hosky #${tokenNumber}`);
    return null;
  }
  
  // Primary gateway (ipfs.io is most reliable)
  const primaryUrl = `https://ipfs.io/ipfs/${ipfsHash}`;
  
  console.log(`✅ HOSKY #${tokenNumber} -> ${ipfsHash.substring(0, 20)}...`);
  
  return primaryUrl;
}

/**
 * Get all available gateway URLs for a HOSKY token
 * Returns array of fallback URLs
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
 * Check if a HOSKY number exists in the CSV
 */
export function hoskyNumberExists(tokenNumber) {
  const map = loadHoskyIpfsMap();
  return map.has(parseInt(tokenNumber));
}

/**
 * Get total number of available HOSKY tokens
 */
export function getTotalHoskyCount() {
  const map = loadHoskyIpfsMap();
  return map.size;
}
