// utils/hoskyIpfsLoader.js
import fs from 'fs';
import path from 'path';

let hoskyIpfsMap = null;

export function loadHoskyIpfsMap() {
  if (hoskyIpfsMap) {
    return hoskyIpfsMap;
  }

  try {
    const csvPath = path.join(process.cwd(), 'utils', 'data', 'hosky-ipfs.csv');
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = fileContent.split('\n').filter(line => line.trim());
    
    hoskyIpfsMap = new Map();
    
    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;
      
      const columns = trimmedLine.split(',');
      
      if (columns.length >= 2) {
        const tokenNumber = parseInt(columns[0].trim());
        const ipfsHash = columns[1].trim().replace('ipfs://', '');
        
        if (!isNaN(tokenNumber) && ipfsHash) {
          hoskyIpfsMap.set(tokenNumber, ipfsHash);
        }
      }
    });

    console.log(`✅ Loaded ${hoskyIpfsMap.size} HOSKY IPFS mappings`);
    
    const keys = Array.from(hoskyIpfsMap.keys()).sort((a, b) => a - b);
    console.log(`📊 HOSKY range: #${keys[0]} to #${keys[keys.length - 1]}`);
    console.log(`📋 First 5 tokens: ${keys.slice(0, 5).join(', ')}`);
    console.log(`📋 Last 5 tokens: ${keys.slice(-5).join(', ')}`);
    
    return hoskyIpfsMap;
    
  } catch (error) {
    console.error('❌ Error loading Hosky IPFS map:', error);
    throw new Error('Failed to load Hosky IPFS mapping');
  }
}

export function getHoskyIpfs(tokenNumber) {
  const map = loadHoskyIpfsMap();
  return map.get(parseInt(tokenNumber));
}

export function getHoskyImageUrl(tokenNumber) {
  const ipfsHash = getHoskyIpfs(tokenNumber);
  
  if (!ipfsHash) {
    console.error(`❌ No IPFS hash found for HOSKY #${tokenNumber}`);
    return null;
  }
  
  return `https://cf-ipfs.com/ipfs/${ipfsHash}`;
}
