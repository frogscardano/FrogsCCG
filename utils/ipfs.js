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
  const input = String(url).trim();

  // Handle ipfs:// protocol (case-insensitive), including ipfs://ipfs/<cid>
  if (/^ipfs:\/\//i.test(input)) {
    let rest = input.replace(/^ipfs:\/\//i, '');
    // Strip leading "ipfs/" if present (avoid double ipfs/ipfs)
    rest = rest.replace(/^ipfs\//i, '');
    return rest;
  }

  // Handle HTTP gateway URLs
  for (const gateway of IPFS_GATEWAYS) {
    const prefix = `${gateway}ipfs/`;
    if (input.toLowerCase().startsWith(prefix)) {
      return input.substring(prefix.length);
    }
  }

  // Handle bare forms like "/ipfs/<cid>..."
  const bare = input.match(/(?:^|\/)ipfs\/(.+)$/i);
  if (bare) {
    return bare[1];
  }

  return null;
};

// Get a formatted IPFS gateway URL
export const getIpfsGatewayUrl = (cid, path = '') => {
  if (!cid) return null;
  
  // Clean the CID
  let cleanCid = cid.startsWith('ipfs://') ? cid.substring(7) : cid;
  // Remove leading redundant ipfs/ segment(s)
  cleanCid = cleanCid.replace(/^ipfs\//i, '');
  
  // Format the path
  const formattedPath = path ? `/${path}` : '';
  
  return `https://ipfs.io/ipfs/${cleanCid}${formattedPath}`;
}; 

// Normalize any IPFS-style URL (ipfs://, /ipfs/, known gateways) to a fetchable HTTPS gateway URL
export const resolveIpfsUrl = (url) => {
  if (!url) return null;
  if (typeof url !== 'string') return url;
  const trimmed = url.trim();

  // Use existing helpers for ipfs:// and known HTTP gateways
  const parsed = parseIpfsUrl(trimmed);
  if (parsed) {
    return getIpfsGatewayUrl(parsed);
  }

  // Handle bare forms like "/ipfs/<cid>[/path]" or "ipfs/<cid>[/path]"
  const bareMatch = trimmed.match(/^(?:\/)?ipfs\/(.+)/i);
  if (bareMatch) {
    return getIpfsGatewayUrl(bareMatch[1]);
  }

  // Already an HTTP(S) URL that isn't recognized as IPFS — return as-is
  return trimmed;
};

// Known IPFS gateway base URLs (must include protocol and trailing slash)
export const IPFS_GATEWAYS = [
  'https://ipfs.io/',
  'https://gateway.ipfs.io/',
  'https://dweb.link/',
];

// Extract { cid, path } from any ipfs-style input or gateway URL
export const extractIpfsCidAndPath = (input) => {
  const parsed = parseIpfsUrl(input);
  if (!parsed) return null;
  const firstSlash = parsed.indexOf('/');
  if (firstSlash === -1) return { cid: parsed, path: '' };
  return { cid: parsed.slice(0, firstSlash), path: parsed.slice(firstSlash + 1) };
};

// Build all candidate gateway URLs for a given input url/cid
export const buildIpfsGatewayAlternates = (input) => {
  const extracted = extractIpfsCidAndPath(input) || { cid: input, path: '' };
  if (!extracted.cid) return [];
  const suffix = extracted.path ? `${extracted.cid}/${extracted.path}` : extracted.cid;
  return IPFS_GATEWAYS.map((base) => `${base}ipfs/${suffix}`);
};