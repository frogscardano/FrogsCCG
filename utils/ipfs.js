import axios from 'axios';

// Function to fetch data from IPFS using a gateway
export async function fetchFromIpfs(ipfsHash) {
  try {
    const response = await fetch(`https://ipfs.io/ipfs/${ipfsHash}`);
    if (!response.ok) throw new Error('Failed to fetch from IPFS');
    return await response.json();
  } catch (error) {
    console.error('Error fetching from IPFS:', error);
    throw error;
  }
}

// Function to fetch Cardano asset data from pool.pm
export async function fetchCardanoAsset(policyId, assetName) {
  try {
    const response = await fetch(`/api/cardano/asset/${policyId}/${assetName}`);
    if (!response.ok) throw new Error('Failed to fetch Cardano asset');
    return await response.json();
  } catch (error) {
    console.error('Error fetching Cardano asset:', error);
    throw error;
  }
}

// Parse the IPFS URL from a regular URL
export const parseIpfsUrl = (url) => {
  if (!url) return null;
  
  // Handle ipfs:// protocol
  if (url.startsWith('ipfs://')) {
    return url.substring(7);
  }
  
  // Handle HTTP gateway URLs
  const ipfsGateways = [
    'https://ipfs.io/ipfs/',
    'https://gateway.ipfs.io/ipfs/',
    'https://dweb.link/ipfs/'
  ];
  
  for (const gateway of ipfsGateways) {
    if (url.startsWith(gateway)) {
      return url.substring(gateway.length);
    }
  }
  
  return null;
};

// Get a formatted IPFS gateway URL
export const getIpfsGatewayUrl = (cid, path = '') => {
  if (!cid) return null;
  
  // Clean the CID
  const cleanCid = cid.startsWith('ipfs://') ? cid.substring(7) : cid;
  
  // Format the path
  const formattedPath = path ? `/${path}` : '';
  
  return `https://ipfs.io/ipfs/${cleanCid}${formattedPath}`;
}; 