import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useWallet } from '../../contexts/WalletContext';
import styles from '../../styles/Games.module.css';

const NFTMahjongSolitairePage = () => {
    const { address, connected } = useWallet();
    const [nftCards, setNftCards] = useState([]);
    const [iframeSrc, setIframeSrc] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const containerRef = useRef(null);

    // Fullscreen functionality
    const toggleFullscreen = async () => {
        if (!document.fullscreenElement) {
            try {
                await containerRef.current.requestFullscreen();
                setIsFullscreen(true);
            } catch (err) {
                console.error('Error attempting to enable fullscreen:', err);
            }
        } else {
            try {
                await document.exitFullscreen();
                setIsFullscreen(false);
            } catch (err) {
                console.error('Error attempting to exit fullscreen:', err);
            }
        }
    };

    // Listen for fullscreen changes and ESC key
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        const handleKeyDown = (event) => {
            if (event.key === 'Escape' && isFullscreen) {
                setIsFullscreen(false);
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('keydown', handleKeyDown);
        
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isFullscreen]);

    // Fetch user's actual NFT collection
    useEffect(() => {
        const loadNFTCollection = async () => {
            if (!connected || !address) {
                // If not connected, use placeholder images
                const placeholderCards = Array.from({ length: 72 }, (_, i) => ({
                    id: `placeholder${i}`,
                    name: `Placeholder NFT ${i + 1}`,
                    image: `https://via.placeholder.com/100x100/CCCCCC/000000?Text=P${i + 1}`
                }));
                setNftCards(placeholderCards);
                return;
            }

            setLoading(true);
            setError('');
            
            try {
                console.log("Fetching NFTs for address:", address);
                
                const apiUrl = `/api/collections/${address}`;
                const response = await fetch(apiUrl);
                
                if (!response.ok) {
                    throw new Error(`Failed to load collection: ${response.status}`);
                }
                
                const cards = await response.json();
                console.log(`Received ${cards.length} cards from API`);
                
                if (cards.length === 0) {
                    console.log('No NFTs found, using placeholder images for game');
                    // Use placeholder images instead of showing error
                    const placeholderCards = Array.from({ length: 72 }, (_, i) => ({
                        id: `placeholder${i}`,
                        name: `Placeholder NFT ${i + 1}`,
                        image: `https://via.placeholder.com/100x100/4CAF50/FFFFFF?Text=P${i + 1}`
                    }));
                    setNftCards(placeholderCards);
                    setError('No NFTs found in your collection. Playing with placeholder images. Open some card packs to add NFTs!');
                    return;
                }

                // Process cards to ensure they have the required properties
                const processedCards = cards.map(card => ({
                    id: card.id || card.tokenId || `card_${Math.random().toString(36).substr(2, 9)}`,
                    name: card.name || 'Unknown Card',
                    image: card.image || card.imageUrl || '/placeholder-card.png'
                }));

                setNftCards(processedCards);
                console.log(`Collection loaded successfully with ${processedCards.length} NFTs`);
                
            } catch (error) {
                console.error('Error loading NFT collection:', error);
                console.log('Using placeholder images due to API error');
                
                // Always fallback to placeholder images so the game can still be played
                const placeholderCards = Array.from({ length: 72 }, (_, i) => ({
                    id: `placeholder${i}`,
                    name: `Placeholder NFT ${i + 1}`,
                    image: `https://via.placeholder.com/100x100/4CAF50/FFFFFF?Text=P${i + 1}`
                }));
                setNftCards(placeholderCards);
                setError(`Could not load your NFT collection (${error.message}). Playing with placeholder images instead.`);
            } finally {
                setLoading(false);
            }
        };

        loadNFTCollection();
    }, [address, connected]);

    useEffect(() => {
        if (nftCards.length > 0) {
            const gameUrl = '/games/mahjong_solitaire_external.html';
            const nftImages = nftCards.map(card => card.image).filter(image => image);
            const nftsQueryParam = encodeURIComponent(JSON.stringify(nftImages));
            setIframeSrc(`${gameUrl}?nfts=${nftsQueryParam}`);
            console.log(`Setting iframe src with ${nftImages.length} NFT images`);
        }
    }, [nftCards]);

    return (
        <>
            <Head>
                <title>NFT Mahjong Solitaire | Frogs CCG</title>
                <meta name="description" content="Play Mahjong Solitaire with your NFTs!" />
            </Head>
            <div 
                ref={containerRef}
                className={`${styles.gamePageContainer} ${isFullscreen ? styles.fullscreen : ''}`}
            >
                {!isFullscreen && (
                    <h1 className={styles.gameTitle}>NFT Mahjong Solitaire</h1>
                )}
                
                {/* Floating controls */}
                <div className={styles.gameControls}>
                    <button 
                        onClick={toggleFullscreen}
                        className={styles.fullscreenButton}
                        title={isFullscreen ? "Exit Fullscreen (ESC)" : "Enter Fullscreen"}
                    >
                        {isFullscreen ? "🗗" : "🗖"}
                    </button>
                </div>

                {/* Floating status messages */}
                {loading && (
                    <div className={styles.loadingMessage}>Loading your NFT collection...</div>
                )}
                
                {error && (
                    <div className={error.includes('placeholder images') ? styles.walletWarning : styles.errorMessage}>
                        {error}
                    </div>
                )}
                
                {!connected && (
                    <div className={styles.walletWarning}>
                        <p>Connect your wallet to play with your NFT collection!</p>
                        <p>Playing with placeholder images for now.</p>
                    </div>
                )}
                
                {connected && nftCards.length > 0 && !error && (
                    <div className={styles.collectionInfo}>
                        Playing with {nftCards.length} NFTs from your collection
                    </div>
                )}
                
                {iframeSrc ? (
                    <iframe
                        src={iframeSrc}
                        className={styles.gameIframe}
                        title="NFT Mahjong Solitaire Game"
                        sandbox="allow-scripts allow-same-origin"
                        frameBorder="0"
                        allowFullScreen={false}
                    ></iframe>
                ) : (
                    <div className={styles.loadingMessage}>Loading Mahjong Game...</div>
                )}
            </div>
        </>
    );
};

export default NFTMahjongSolitairePage; 