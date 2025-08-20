import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useWallet } from '../../contexts/WalletContext';
import styles from '../../styles/Games.module.css';

const NFTMahjongSolitairePage = () => {
    const { address, connected } = useWallet();
    const [nftCards, setNftCards] = useState([]);
    const [iframeSrc, setIframeSrc] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

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
                
                const responseData = await response.json();
                
                // Handle new response format with metadata
                let cards = responseData;
                if (responseData.collection && Array.isArray(responseData.collection)) {
                    cards = responseData.collection;
                    console.log(`📊 Collection loaded: ${cards.length} cards, Message: ${responseData.message}`);
                } else if (Array.isArray(responseData)) {
                    cards = responseData;
                    console.log(`📊 Legacy format: ${cards.length} cards`);
                } else {
                    console.error(`❌ Unexpected response format:`, responseData);
                    throw new Error('Unexpected response format from API');
                }
                
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
            <div className={styles.gamePageContainer}>
                <h1 className={styles.gameTitle}>NFT Mahjong Solitaire</h1>
                
                {loading && (
                    <p>Loading your NFT collection...</p>
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
                
                {connected && nftCards.length > 0 && (
                    <div className={styles.collectionInfo}>
                        <p>Playing with {nftCards.length} NFTs from your collection</p>
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
                    <p>Loading Mahjong Game...</p>
                )}
                
                <p className={styles.gameInstructions}>
                    Match pairs of identical tiles. A tile can be selected if it's open on its left or right side and no other tile is on top of it.
                    Flower tiles match any other flower tile, and Season tiles match any other season tile.
                </p>
            </div>
        </>
    );
};

export default NFTMahjongSolitairePage; 
