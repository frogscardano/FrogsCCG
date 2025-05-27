import React, { useState, useEffect, useRef } from 'react';
import styles from './Solitaire.module.css';

const SUITS = ["♠", "♥", "♣", "♦"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const RANK_VALUES = { "A": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10, "J": 11, "Q": 12, "K": 13 };

const Solitaire = ({ nfts, onGameComplete }) => {
    const [deck, setDeck] = useState([]);
    const [stock, setStock] = useState([]);
    const [waste, setWaste] = useState([]);
    const [foundations, setFoundations] = useState([[], [], [], []]);
    const [tableau, setTableau] = useState([[], [], [], [], [], [], []]);
    const [selectedInfo, setSelectedInfo] = useState(null);
    const [gameWon, setGameWon] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [draggedCard, setDraggedCard] = useState(null);
    const gameContainerRef = useRef(null);

    // Create deck with NFT images
    useEffect(() => {
        if (nfts && nfts.length > 0) {
            const newDeck = [];
            
            // Ensure we have at least 13 unique images for the ranks
            let availableImages = nfts.map(nft => nft.image || nft.image_url || '/placeholder-card.png');
            
            // If we don't have enough NFTs, repeat them or use placeholders
            while (availableImages.length < 13) {
                if (nfts.length > 0) {
                    // Repeat existing NFT images
                    availableImages = [...availableImages, ...nfts.map(nft => nft.image || nft.image_url || '/placeholder-card.png')];
                } else {
                    // Use placeholder images
                    availableImages.push('/placeholder-card.png');
                }
            }
            
            // Take only the first 13 images
            availableImages = availableImages.slice(0, 13);
            
            for (const suit of SUITS) {
                for (let i = 0; i < RANKS.length; i++) {
                    newDeck.push({
                        suit,
                        rank: RANKS[i],
                        value: RANK_VALUES[RANKS[i]],
                        color: (suit === "♥" || suit === "♦") ? 'red' : 'black',
                        faceUp: false,
                        id: RANKS[i] + suit,
                        image: availableImages[i] // Use NFT image for each rank
                    });
                }
            }
            setDeck(newDeck);
            dealGame(newDeck);
        } else {
            // No NFTs available, create deck with placeholder images
            const newDeck = [];
            for (const suit of SUITS) {
                for (let i = 0; i < RANKS.length; i++) {
                    newDeck.push({
                        suit,
                        rank: RANKS[i],
                        value: RANK_VALUES[RANKS[i]],
                        color: (suit === "♥" || suit === "♦") ? 'red' : 'black',
                        faceUp: false,
                        id: RANKS[i] + suit,
                        image: '/placeholder-card.png'
                    });
                }
            }
            setDeck(newDeck);
            dealGame(newDeck);
        }
    }, [nfts]);

    const shuffleDeck = (deck) => {
        const shuffled = [...deck];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    };

    const dealGame = (deckToDeal = deck) => {
        const shuffledDeck = shuffleDeck(deckToDeal);
        const newStock = [...shuffledDeck];
        const newWaste = [];
        const newFoundations = [[], [], [], []];
        const newTableau = [[], [], [], [], [], [], []];

        for (let i = 0; i < 7; i++) {
            for (let j = 0; j <= i; j++) {
                const card = newStock.pop();
                if (j === i) {
                    card.faceUp = true;
                }
                newTableau[i].push(card);
            }
        }

        setStock(newStock);
        setWaste(newWaste);
        setFoundations(newFoundations);
        setTableau(newTableau);
        setSelectedInfo(null);
        setGameWon(false);
    };

    const handleStockClick = () => {
        if (selectedInfo) {
            setSelectedInfo(null);
            return;
        }

        if (stock.length > 0) {
            const newStock = [...stock];
            const card = newStock.pop();
            card.faceUp = true;
            setStock(newStock);
            setWaste([...waste, card]);
        } else if (waste.length > 0) {
            const newStock = waste.reverse().map(card => ({ ...card, faceUp: false }));
            setStock(newStock);
            setWaste([]);
        }
    };

    const handleCardClick = (card, sourcePile, sourceIndex) => {
        if (!card.faceUp) {
            if (sourcePile === 'tableau' && sourceIndex === tableau[sourceIndex].length - 1) {
                const newTableau = [...tableau];
                newTableau[sourceIndex][sourceIndex].faceUp = true;
                setTableau(newTableau);
            }
            return;
        }

        if (!selectedInfo) {
            setSelectedInfo({ card, sourcePile, sourceIndex });
        } else {
            // Try to move card
            const targetPile = sourcePile;
            const targetIndex = sourceIndex;
            if (canMoveCard(selectedInfo.card, targetPile, targetIndex)) {
                moveCard(selectedInfo.card, selectedInfo.sourcePile, selectedInfo.sourceIndex, targetPile, targetIndex);
            }
            setSelectedInfo(null);
        }
    };

    const canMoveCard = (card, targetPile, targetIndex) => {
        if (targetPile === 'foundation') {
            const foundation = foundations[targetIndex];
            if (foundation.length === 0) {
                return card.rank === 'A';
            }
            const topCard = foundation[foundation.length - 1];
            return card.suit === topCard.suit && card.value === topCard.value + 1;
        } else if (targetPile === 'tableau') {
            const pile = tableau[targetIndex];
            if (pile.length === 0) {
                return card.rank === 'K';
            }
            const topCard = pile[pile.length - 1];
            return card.color !== topCard.color && card.value === topCard.value - 1;
        }
        return false;
    };

    const moveCard = (card, sourcePile, sourceIndex, targetPile, targetIndex) => {
        let sourceCards = [];
        let newSourcePile = [];

        // Get cards to move from source pile
        if (sourcePile === 'tableau') {
            const sourcePileCards = tableau[sourceIndex];
            const cardIndex = sourcePileCards.findIndex(c => c.id === card.id);
            sourceCards = sourcePileCards.slice(cardIndex);
            newSourcePile = sourcePileCards.slice(0, cardIndex);
        } else if (sourcePile === 'waste') {
            sourceCards = [waste[waste.length - 1]];
            newSourcePile = waste.slice(0, -1);
        } else if (sourcePile === 'foundation') {
            // Handle moving from foundation
            const sourcePileCards = foundations[sourceIndex];
            sourceCards = [sourcePileCards[sourcePileCards.length - 1]];
            newSourcePile = sourcePileCards.slice(0, -1);
        }

        // Update target pile
        let newTargetPile = [];
        if (targetPile === 'foundation') {
            newTargetPile = [...foundations[targetIndex], ...sourceCards];
            setFoundations(prev => {
                const newFoundations = [...prev];
                newFoundations[targetIndex] = newTargetPile;
                return newFoundations;
            });
        } else if (targetPile === 'tableau') {
            newTargetPile = [...tableau[targetIndex], ...sourceCards];
            setTableau(prev => {
                const newTableau = [...prev];
                newTableau[targetIndex] = newTargetPile;
                return newTableau;
            });
        }

        // Update source pile
        if (sourcePile === 'tableau') {
            setTableau(prev => {
                const newTableau = [...prev];
                newTableau[sourceIndex] = newSourcePile;
                // Flip the top card if it exists
                if (newSourcePile.length > 0 && !newSourcePile[newSourcePile.length - 1].faceUp) {
                    newSourcePile[newSourcePile.length - 1].faceUp = true;
                }
                return newTableau;
            });
        } else if (sourcePile === 'waste') {
            setWaste(newSourcePile);
        } else if (sourcePile === 'foundation') {
            setFoundations(prev => {
                const newFoundations = [...prev];
                newFoundations[sourceIndex] = newSourcePile;
                return newFoundations;
            });
        }

        // Check win condition
        checkWinCondition();
    };

    const checkWinCondition = () => {
        const totalCardsInFoundations = foundations.reduce((sum, pile) => sum + pile.length, 0);
        if (totalCardsInFoundations === 52) {
            setGameWon(true);
            onGameComplete({
                score: 1000,
                winner: 'player',
                rewardPoints: 50
            });
        }
    };

    // Toggle fullscreen
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            if (gameContainerRef.current) {
                gameContainerRef.current.requestFullscreen().catch(err => {
                    alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
                });
                setIsFullscreen(true);
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
                setIsFullscreen(false);
            }
        }
    };

    // Effect to listen for fullscreen changes
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // Add this helper to find the correct foundation index for a card
    const getFoundationIndexForCard = (card) => {
        return SUITS.indexOf(card.suit);
    };

    // Add this helper to check if a card can move to its foundation
    const canAutoMoveToFoundation = (card) => {
        const foundationIndex = getFoundationIndexForCard(card);
        if (foundationIndex === -1) return false;
        const foundation = foundations[foundationIndex];
        if (foundation.length === 0) {
            return card.rank === 'A';
        }
        const topCard = foundation[foundation.length - 1];
        return card.suit === topCard.suit && card.value === topCard.value + 1;
    };

    // Add this handler for double-click
    const handleCardDoubleClick = (card, sourcePile, sourceIndex) => {
        if (!card.faceUp) return;
        
        // Try to move to foundation first (auto-sort to foundation)
        const foundationIndex = getFoundationIndexForCard(card);
        if (foundationIndex !== -1 && canAutoMoveToFoundation(card)) {
            moveCard(card, sourcePile, sourceIndex, 'foundation', foundationIndex);
            setSelectedInfo(null);
            return;
        }
        
        // If moving from foundation, try to move to tableau
        if (sourcePile === 'foundation') {
            for (let i = 0; i < tableau.length; i++) {
                if (canMoveCard(card, 'tableau', i)) {
                    moveCard(card, sourcePile, sourceIndex, 'tableau', i);
                    setSelectedInfo(null);
                    return;
                }
            }
        } else {
            // If not from foundation and can't go to foundation, try tableau
            for (let i = 0; i < tableau.length; i++) {
                if (canMoveCard(card, 'tableau', i)) {
                    moveCard(card, sourcePile, sourceIndex, 'tableau', i);
                    setSelectedInfo(null);
                    return;
                }
            }
        }
    };

    // Drag and drop handlers
    const handleDragStart = (e, card, sourcePile, sourceIndex) => {
        setDraggedCard({ card, sourcePile, sourceIndex });
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', ''); // Required for some browsers
        e.target.classList.add(styles.dragging);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.classList.add(styles.dragOver);
    };

    const handleDragLeave = (e) => {
        e.currentTarget.classList.remove(styles.dragOver);
    };

    const handleDrop = (e, targetPile, targetIndex) => {
        e.preventDefault();
        e.currentTarget.classList.remove(styles.dragOver);
        
        if (!draggedCard) return;

        const { card, sourcePile, sourceIndex } = draggedCard;
        
        // Check if the move is valid
        if (canMoveCard(card, targetPile, targetIndex)) {
            moveCard(card, sourcePile, sourceIndex, targetPile, targetIndex);
        }
        
        setDraggedCard(null);
        setSelectedInfo(null);
    };

    const handleDragEnd = (e) => {
        e.target.classList.remove(styles.dragging);
        setDraggedCard(null);
    };

    return (
        <div className={styles.gameContainer} ref={gameContainerRef}>
            <div className={styles.controls}>
                <button onClick={() => dealGame()}>New Game</button>
                <button 
                    onClick={toggleFullscreen}
                    style={{marginLeft: '10px'}}
                >
                    {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                </button>
            </div>

            <div className={styles.gameBoard}>
                <div className={styles.topArea}>
                    <div className={styles.stockWasteArea}>
                        <div className={styles.pile} onClick={handleStockClick}>
                            {stock.length > 0 && (
                                <div className={`${styles.card} ${styles.faceDown}`}>
                                    <img src="/card-back.svg" alt="Card Back" />
                                </div>
                            )}
                        </div>
                        <div className={styles.pile}>
                            {waste.length > 0 && (
                                <div
                                    className={styles.card}
                                    onDoubleClick={() => handleCardDoubleClick(waste[waste.length - 1], 'waste', null)}
                                    draggable={true}
                                    onDragStart={(e) => handleDragStart(e, waste[waste.length - 1], 'waste', null)}
                                    onDragEnd={handleDragEnd}
                                >
                                    <img src={waste[waste.length - 1].image} alt={waste[waste.length - 1].rank + waste[waste.length - 1].suit} className={styles.nftArt} />
                                    <span className={`${styles.rank} ${waste[waste.length - 1].color === 'red' ? styles.red : styles.black} ${styles.topLeft}`}>{waste[waste.length - 1].rank}</span>
                                    <span className={`${styles.suit} ${waste[waste.length - 1].color === 'red' ? styles.red : styles.black} ${styles.suitTopLeft}`}>{waste[waste.length - 1].suit}</span>
                                    <span className={`${styles.rank} ${waste[waste.length - 1].color === 'red' ? styles.red : styles.black} ${styles.bottomRight}`}>{waste[waste.length - 1].rank}</span>
                                    <span className={`${styles.suit} ${waste[waste.length - 1].color === 'red' ? styles.red : styles.black} ${styles.suitBottomRight}`}>{waste[waste.length - 1].suit}</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className={styles.foundationsArea}>
                        {foundations.map((pile, index) => (
                            <div 
                                key={index} 
                                className={styles.pile}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, 'foundation', index)}
                            >
                                {pile.length > 0 && (
                                    <div
                                        className={styles.card}
                                        onClick={() => handleCardClick(pile[pile.length - 1], 'foundation', index)}
                                        onDoubleClick={() => handleCardDoubleClick(pile[pile.length - 1], 'foundation', index)}
                                        draggable={true}
                                        onDragStart={(e) => handleDragStart(e, pile[pile.length - 1], 'foundation', index)}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <img src={pile[pile.length - 1].image} alt={pile[pile.length - 1].rank + pile[pile.length - 1].suit} className={styles.nftArt} />
                                        <span className={`${styles.rank} ${pile[pile.length - 1].color === 'red' ? styles.red : styles.black} ${styles.topLeft}`}>{pile[pile.length - 1].rank}</span>
                                        <span className={`${styles.suit} ${pile[pile.length - 1].color === 'red' ? styles.red : styles.black} ${styles.suitTopLeft}`}>{pile[pile.length - 1].suit}</span>
                                        <span className={`${styles.rank} ${pile[pile.length - 1].color === 'red' ? styles.red : styles.black} ${styles.bottomRight}`}>{pile[pile.length - 1].rank}</span>
                                        <span className={`${styles.suit} ${pile[pile.length - 1].color === 'red' ? styles.red : styles.black} ${styles.suitBottomRight}`}>{pile[pile.length - 1].suit}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className={styles.tableauArea}>
                    {tableau.map((pile, pileIndex) => (
                        <div 
                            key={pileIndex} 
                            className={styles.pile}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, 'tableau', pileIndex)}
                        >
                            {pile.map((card, cardIndex) => (
                                <div
                                    key={card.id}
                                    className={`${styles.card} ${card.faceUp ? '' : styles.faceDown} ${selectedInfo?.card.id === card.id ? styles.selected : ''}`}
                                    onClick={() => handleCardClick(card, 'tableau', pileIndex)}
                                    onDoubleClick={() => handleCardDoubleClick(card, 'tableau', pileIndex)}
                                    style={{ top: `${cardIndex * 30}px` }}
                                    draggable={card.faceUp}
                                    onDragStart={(e) => handleDragStart(e, card, 'tableau', pileIndex)}
                                    onDragEnd={handleDragEnd}
                                >
                                    {card.faceUp ? (
                                        <>
                                            <img src={card.image} alt={card.rank + card.suit} className={styles.nftArt} />
                                            <span className={`${styles.rank} ${card.color === 'red' ? styles.red : styles.black} ${styles.topLeft}`}>{card.rank}</span>
                                            <span className={`${styles.suit} ${card.color === 'red' ? styles.red : styles.black} ${styles.suitTopLeft}`}>{card.suit}</span>
                                            <span className={`${styles.rank} ${card.color === 'red' ? styles.red : styles.black} ${styles.bottomRight}`}>{card.rank}</span>
                                            <span className={`${styles.suit} ${card.color === 'red' ? styles.red : styles.black} ${styles.suitBottomRight}`}>{card.suit}</span>
                                        </>
                                    ) : (
                                        <img src="/card-back.svg" alt="Card Back" />
                                    )}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            {gameWon && (
                <div className={styles.winMessage}>
                    Congratulations! You Won!
                    <button onClick={() => dealGame()}>Play Again</button>
                </div>
            )}
        </div>
    );
};

export default Solitaire; 