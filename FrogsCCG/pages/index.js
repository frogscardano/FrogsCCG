import { useState, useEffect } from 'react';
import { fetchFromIpfs, fetchCardanoAsset } from '../utils/ipfs';
import { showAlert, isTelegramWebApp } from '../utils/telegram';
import CardCollection from '../components/CardCollection';

const Home = () => {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [collectionInfo, setCollectionInfo] = useState({
    name: 'Frogs Card Collection',
    description: ''
  });

  // Fetch cards data
  useEffect(() => {
    let isMounted = true; // To prevent state updates after unmount
    
    const fetchCards = async () => {
      try {
        if (!isMounted) return;
        setLoading(true);
        
        // Try to fetch real data if not in development mode
        if (process.env.NODE_ENV !== 'development') {
          try {
            // Use the asset ID from the provided URL in pool.pm
            const assetId = 'asset1nr0p6v5jd7axhaayx2lgxptv22xucjz8d5lm23';
            
            // Try to fetch the Cardano asset data
            const assetData = await fetchCardanoAsset(assetId);
            
            if (isMounted && assetData && assetData.metadata) {
              // Extract metadata from the asset
              const metadata = assetData.metadata;
              
              // Look for IPFS CID or directly use the metadata
              let ipfsCid = null;
              if (metadata.ipfs) {
                ipfsCid = metadata.ipfs;
              } else if (metadata.image && metadata.image.startsWith('ipfs://')) {
                ipfsCid = metadata.image.substring(7);
              }
              
              if (ipfsCid) {
                // If we have an IPFS CID, try to fetch the metadata
                const ipfsData = await fetchFromIpfs(ipfsCid);
                if (!isMounted) return;
                
                if (ipfsData && ipfsData.cards && Array.isArray(ipfsData.cards)) {
                  setCards(ipfsData.cards);
                } else {
                  // If no cards array, the metadata itself might be for a single card
                  const card = {
                    name: metadata.name || 'Unnamed Card',
                    description: metadata.description || '',
                    image: metadata.image || '',
                    attributes: metadata.attributes || []
                  };
                  setCards([card]);
                }
                
                setCollectionInfo({
                  name: metadata.collection || metadata.name || 'Frogs Card Collection',
                  description: metadata.collectionDescription || metadata.description || ''
                });
                
                setLoading(false);
                return; // Exit early if successful
              }
            }
            
            throw new Error('Failed to get metadata'); // Force fallback
          } catch (fetchError) {
            console.error('Error fetching real data:', fetchError);
            // Continue to fallback data
          }
        }
        
        // Fallback to example cards if we couldn't fetch the asset data
        // or if we're in development mode
        const exampleCards = [
          {
            name: 'Frog Card 1',
            image: '/placeholder.png',
            description: 'This is the first card in the collection.',
            rarity: 'Common',
            attributes: [
              { trait_type: 'Attack', value: '10' },
              { trait_type: 'Defense', value: '5' },
              { trait_type: 'Speed', value: '7' }
            ]
          },
          {
            name: 'Frog Card 2',
            image: '/placeholder.png',
            description: 'A rare card with special abilities.',
            rarity: 'Rare',
            attributes: [
              { trait_type: 'Attack', value: '15' },
              { trait_type: 'Defense', value: '12' },
              { trait_type: 'Speed', value: '9' }
            ]
          },
          {
            name: 'Frog Card 3',
            image: '/placeholder.png',
            description: 'An epic card that is hard to find.',
            rarity: 'Epic',
            attributes: [
              { trait_type: 'Attack', value: '20' },
              { trait_type: 'Defense', value: '18' },
              { trait_type: 'Speed', value: '15' }
            ]
          },
          {
            name: 'Frog Card 4',
            image: '/placeholder.png',
            description: 'One of the rarest cards in the collection.',
            rarity: 'Legendary',
            attributes: [
              { trait_type: 'Attack', value: '30' },
              { trait_type: 'Defense', value: '25' },
              { trait_type: 'Speed', value: '20' }
            ]
          },
        ];
        
        if (isMounted) {
          setCards(exampleCards);
          setCollectionInfo({
            name: 'Frogs Card Collection',
            description: 'This is an example collection of Frog cards.'
          });
        }
      } catch (err) {
        console.error('Error in card handling:', err);
        if (!isMounted) return;
        
        setError('Failed to load cards. Please try again later.');
        
        // Show error in Telegram UI if available
        if (isTelegramWebApp()) {
          showAlert('Failed to load cards. Please try again later.');
        }
        
        // Set fallback cards even on error to ensure something displays
        setCards([
          {
            name: 'Fallback Card',
            image: '/placeholder.png',
            description: 'This is a fallback card since we encountered an error.',
            rarity: 'Common',
            attributes: []
          }
        ]);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchCards();
    
    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="container">
      <header>
        <h1>{collectionInfo.name}</h1>
      </header>

      <main>
        {loading ? (
          <div className="loading">Loading cards...</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : (
          <>
            {collectionInfo.description && (
              <div className="collection-description">
                <p>{collectionInfo.description}</p>
              </div>
            )}
            <CardCollection cards={cards} title="All Cards" />
          </>
        )}
      </main>
    </div>
  );
};

export default Home; 