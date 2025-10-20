// utils/hoskyIpfsLoader.js
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

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
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Parse CSV
    const parsed = Papa.parse(fileContent, {
      header: false,
      skipEmptyLines: true
    });

    // Create Map for fast lookup: tokenNumber -> ipfsHash
    hoskyIpfsMap = new Map();
    
    parsed.data.forEach((row, index) => {
      const tokenNumber = index + 1; // Lines start at 1
      const ipfsHash = row[1]; // Second column has the IPFS hash
      
      if (ipfsHash && ipfsHash.trim()) {
        hoskyIpfsMap.set(tokenNumber, ipfsHash.trim());
      }
    });

    console.log(`✅ Loaded ${hoskyIpfsMap.size} Hosky IPFS mappings`);
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
  return map.get(parseInt(tokenNumber));
}

/**
 * Get full IPFS URL for a Hosky token
 */
export function getHoskyImageUrl(tokenNumber) {
  const ipfsHash = getHoskyIpfs(tokenNumber);
  
  if (!ipfsHash) {
    console.warn(`⚠️ No IPFS hash found for Hosky #${tokenNumber}`);
    return null;
  }
  
  return `https://ipfs.io/ipfs/${ipfsHash}`;
}
