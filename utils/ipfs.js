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

// Detect CIP-25 metadata structure and extract common fields
export const parseCip25Metadata = (raw) => {
  if (!raw) return null;
  const meta = typeof raw === 'string' ? safeParseJson(raw) : raw;
  if (!meta || typeof meta !== 'object') return null;
  const root721 = meta['721'];
  if (!root721 || typeof root721 !== 'object') return null;
  const policyIds = Object.keys(root721);
  if (policyIds.length === 0) return null;
  const policyId = policyIds[0];
  const assetsObj = root721[policyId];
  if (!assetsObj || typeof assetsObj !== 'object') return null;
  const assetKeys = Object.keys(assetsObj);
  if (assetKeys.length === 0) return null;
  const assetKey = assetKeys[0];
  const assetMeta = assetsObj[assetKey];
  if (!assetMeta || typeof assetMeta !== 'object') return null;

  // Image: prefer image, then files[0].src
  const fileSrc = Array.isArray(assetMeta.files) && assetMeta.files.length > 0
    ? assetMeta.files[0]?.src || assetMeta.files[0]?.src_link || null
    : null;
  const imageRaw = assetMeta.image || assetMeta.image_url || fileSrc || null;
  const image = resolveIpfsUrl(imageRaw) || imageRaw || null;

  // Name
  const name = assetMeta.name || assetKey;

  // Attributes: normalize to array of { trait_type, value }
  let attributes = [];
  if (Array.isArray(assetMeta.attributes)) {
    attributes = assetMeta.attributes.map((a) =>
      a && typeof a === 'object' && 'trait_type' in a && 'value' in a
        ? a
        : null
    ).filter(Boolean);
  } else if (assetMeta.attributes && typeof assetMeta.attributes === 'object') {
    attributes = Object.entries(assetMeta.attributes).map(([k, v]) => ({ trait_type: k, value: v }));
  }

  // Always include policy and asset name for reference
  attributes.push({ trait_type: 'Policy ID', value: policyId });
  attributes.push({ trait_type: 'Asset', value: assetKey });

  return { policyId, asset: assetKey, name, image, mediaType: assetMeta.mediaType, attributes };
};

function safeParseJson(s) {
  try { return JSON.parse(s); } catch { return null; }
}