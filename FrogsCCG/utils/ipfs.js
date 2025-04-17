import axios from 'axios';

// Function to fetch data from IPFS using a gateway
export const fetchFromIpfs = async (cid) => {
  try {
    // Using public IPFS gateways
    const response = await axios.get(`https://ipfs.io/ipfs/${cid}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching from IPFS:", error);
    
    // Try an alternative gateway if the first one fails
    try {
      const fallbackResponse = await axios.get(`https://gateway.ipfs.io/ipfs/${cid}`);
      return fallbackResponse.data;
    } catch (fallbackError) {
      console.error("Error fetching from fallback IPFS gateway:", fallbackError);
      
      // Try one more gateway
      try {
        const secondFallbackResponse = await axios.get(`https://dweb.link/ipfs/${cid}`);
        return secondFallbackResponse.data;
      } catch (secondFallbackError) {
        console.error("Error fetching from second fallback IPFS gateway:", secondFallbackError);
        throw new Error("Failed to fetch data from IPFS");
      }
    }
  }
};

// Function to fetch Cardano asset data from pool.pm
export const fetchCardanoAsset = async (assetId) => {
  try {
    // First, try the direct API endpoint
    const response = await axios.get(`https://pool.pm/api/v1/assets/${assetId}`);
    return response.data;
  } catch (error) {
    // If direct API fails, try scraping the page (not ideal, but a fallback)
    console.error("Error fetching Cardano asset from API:", error);
    try {
      const response = await axios.get(`https://pool.pm/${assetId}`);
      // This is a fallback that might not work, we'd need to parse HTML here
      // In a real app, you'd want a more reliable API or backend service
      throw new Error("Fallback scraping not implemented");
    } catch (fallbackError) {
      console.error("Error fetching Cardano asset:", fallbackError);
      throw new Error("Failed to fetch Cardano asset data");
    }
  }
};

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