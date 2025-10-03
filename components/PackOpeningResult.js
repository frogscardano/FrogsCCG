import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import styles from '../styles/PackOpeningResult.module.css';
import { getCardImage } from '../utils/gameHelpers';
import { buildIpfsGatewayAlternates } from '../utils/ipfs';

const PackOpeningResult = ({ packOpeningId }) => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [packOpening, setPackOpening] = useState(null);
  const [nfts, setNfts] = useState([]);
  const [revealedCards, setRevealedCards] = useState([]);

  // Fetch pack opening data when component mounts
  useEffect(() => {
    if (packOpeningId) {
      fetchPackOpeningData();
    }
  }, [packOpeningId]);

  const fetchPackOpeningData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/packOpeningResult?packOpeningId=${packOpeningId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch pack opening data');
      }

      setPackOpening(data.packOpening);
      setNfts(data.nfts);
      setRevealedCards([]);
    } catch (err) {
      console.error('Error fetching pack opening data:', err);
      setError(err.message || 'An error occurred while fetching pack opening data');
    } finally {
      setLoading(false);
    }
  };

  const handleRevealCard = (index) => {
    if (!revealedCards.includes(index)) {
      setRevealedCards([...revealedCards, index]);
    }
  };

  const handleRevealAll = () => {
    const allIndexes = nfts.map((_, index) => index);
    setRevealedCards(allIndexes);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <p>Loading your NFTs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <p>Error: {error}</p>
          <button 
            className={styles.button} 
            onClick={() => router.push('/packs')}
          >
            Back to Packs
          </button>
        </div>
      </div>
    );
  }

  if (!packOpening || nfts.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <p>Pack opening not found or no NFTs in this pack</p>
          <button 
            className={styles.button} 
            onClick={() => router.push('/packs')}
          >
            Back to Packs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Pack Opening Results</h2>
      
      <div className={styles.packInfo}>
        <p>Transaction Hash: <span className={styles.hash}>{packOpening.txHash}</span></p>
        <p>Opened: {new Date(packOpening.openedAt).toLocaleString()}</p>
      </div>

      {revealedCards.length < nfts.length && (
        <div className={styles.instructions}>
          <p>Click on each card to reveal your NFTs!</p>
          <button 
            className={styles.revealAllButton} 
            onClick={handleRevealAll}
          >
            Reveal All
          </button>
        </div>
      )}

      <div className={styles.nftGrid}>
        {nfts.map((nft, index) => (
          <div 
            key={nft.id} 
            className={`${styles.nftCard} ${revealedCards.includes(index) ? styles.revealed : ''}`}
            onClick={() => handleRevealCard(index)}
          >
            {revealedCards.includes(index) ? (
              <div className={styles.nftContent}>
                {getCardImage(nft) ? (
                  <div className={styles.imageContainer}>
                    <Image 
                      src={getCardImage(nft)} 
                      alt={nft.name}
                      width={200}
                      height={200}
                      className={styles.nftImage}
                      unoptimized
                      onError={(e) => {
                        const candidates = buildIpfsGatewayAlternates(getCardImage(nft));
                        const current = e.target.getAttribute('data-gw-idx') || '0';
                        const nextIdx = parseInt(current, 10) + 1;
                        if (candidates[nextIdx]) {
                          e.target.setAttribute('data-gw-idx', String(nextIdx));
                          e.target.src = candidates[nextIdx];
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className={styles.noImage}>No Image</div>
                )}
                <div className={styles.nftDetails}>
                  <h3 className={styles.nftName}>{nft.name}</h3>
                  <p className={`${styles.nftRarity} ${styles[nft.rarity.toLowerCase()]}`}>
                    {nft.rarity}
                  </p>
                  {nft.description && (
                    <p className={styles.nftDescription}>{nft.description}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className={styles.cardBack}>
                <p>Click to Reveal</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className={styles.actions}>
        <button 
          className={styles.button} 
          onClick={() => router.push('/collection')}
        >
          View My Collection
        </button>
        <button 
          className={styles.button} 
          onClick={() => router.push('/packs')}
        >
          Back to Packs
        </button>
      </div>
    </div>
  );
};

export default PackOpeningResult; 