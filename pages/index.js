import { useState, useEffect } from 'react';
import { fetchFromIpfs, fetchCardanoAsset } from '../utils/ipfs';
import { showAlert, isTelegramWebApp } from '../utils/telegram';
import CardCollection from '../components/CardCollection';
import TeamBuilder from '../components/TeamBuilder';
import Head from 'next/head';
import styles from '../styles/Home.module.css';
import WalletConnect from '../components/WalletConnect';
import { useWallet } from '../contexts/WalletContext';
import BattleArena from '../components/BattleArena';
import MemoryGame from '../components/MemoryGame';
import Solitaire from '../components/Solitaire';
import { useRouter } from 'next/router';
import { lovelaceToAda } from '../utils/cardano';

// Utility functions for handling Cardano addresses
const addressUtils = {
  // Format address for display - handles both hex and bech32 formats
  formatAddressForDisplay: (address) => {
    if (!address) return '';
    
    // Check if this is likely a hex address (CIP-30 wallets return addresses in hex format)
    const isHexAddress = /^[0-9a-fA-F]+$/.test(address);
    
    // For display purposes we'll just show the first and last few characters
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  },
  
  // For hex addresses, add a debug indicator that this is a hex format
  getAddressInfo: (address) => {
    if (!address) return { isHex: false, formatted: '' };
    
    const isHex = /^[0-9a-fA-F]+$/.test(address);
    return {
      isHex,
      formatted: `${address.slice(0, 8)}...${address.slice(-8)}`,
      prefix: isHex ? 'hex' : address.split('1')[0] // Get the prefix for bech32 addresses
    };
  }
};

export default function Home() {
  const router = useRouter();
  const { 
    connected, 
    address, 
    balance, 
    loading, 
    error: walletError,
    connect: connectWalletContext,
    disconnect: disconnectWalletContext,
    api, 
    availableWallets 
  } = useWallet();
  const [currentTab, setCurrentTab] = useState('packs');
  const [currentCards, setCurrentCards] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [rarityFilter, setRarityFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPackOpening, setIsPackOpening] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [revealedCards, setRevealedCards] = useState([]);
  const [statusMessage, setStatusMessage] = useState('Click the pack to open');
  const [selectedPack, setSelectedPack] = useState(null);
  const [loadingState, setLoadingState] = useState('');
  const [selectedGame, setSelectedGame] = useState(null);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [gameResults, setGameResults] = useState(null);
  const [rewardPoints, setRewardPoints] = useState(0);
  const [error, setError] = useState(null);

  // Add a formatted address state to store a more user-friendly address
  const [displayAddressInfo, setDisplayAddressInfo] = useState(null);

  // Check if a wallet is already connected on page load
  useEffect(() => {
    const checkExistingConnection = async () => {
      if (availableWallets && availableWallets.length > 0 && !connected) {
        try {
          // Try to connect to Eternl by default or the first available wallet
          const walletToTry = availableWallets.find(w => w.name === 'eternl') || availableWallets[0];
          if (walletToTry) {
            // await connectWalletContext(walletToTry.name);
          }
        } catch (e) {
          console.error('Error reconnecting to wallet:', e);
          // setError(`Reconnect failed: ${e.message}`);
        }
      }
    };
    
    checkExistingConnection();
  }, [availableWallets, connected, connectWalletContext]);

  const handleConnectWallet = async (walletName) => {
    try {
      setError(null);
      await connectWalletContext(walletName);
    } catch (e) {
      console.error(`Failed to connect to ${walletName}:`, e);
      setError(`Failed to connect: ${e.message}`);
    }
  };

  const handleDisconnectWallet = () => {
    try {
      setError(null);
      disconnectWalletContext();
    } catch (e) {
      console.error('Failed to disconnect wallet:', e);
      setError(`Failed to disconnect: ${e.message}`);
    }
  };

  // useEffect to update addressInfo when address from context changes
  useEffect(() => {
    if (address) {
      setDisplayAddressInfo(addressUtils.getAddressInfo(address));
    } else {
      setDisplayAddressInfo(null);
    }
  }, [address]);

  // Load collection for the connected wallet
  const loadCollection = async () => {
    if (!connected || !address) {
      console.error('No wallet address available to load collection');
      return;
    }
    
    console.log(`🔍 Loading collection for address: ${address}`);
    
    try {
      setError(null);
      setStatusMessage('Loading your collection...');
      
      const apiUrl = `/api/collections/${address}`;
      console.log(`📡 Fetching from: ${apiUrl}`);
      
      const response = await fetch(apiUrl);
      console.log(`📊 Response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Error (${response.status}):`, errorText);
        throw new Error(`Failed to load collection: ${response.status} ${errorText}`);
      }
      
      const cards = await response.json();
      console.log(`✅ Received ${cards.length} cards from API:`, cards);
      
      // Debug: Log the structure of the first card
      if (cards.length > 0) {
        console.log(`🔍 First card structure:`, {
          id: cards[0].id,
          name: cards[0].name,
          image: cards[0].image,
          imageUrl: cards[0].imageUrl,
          attack: cards[0].attack,
          health: cards[0].health,
          speed: cards[0].speed,
          attributes: cards[0].attributes,
          metadata: cards[0].metadata
        });
      }
      
      setCurrentCards(cards);
      setStatusMessage('');
      
      console.log(`🎯 Collection loaded successfully with ${cards.length} NFTs`);
    } catch (e) {
      console.error('❌ Error loading collection:', e);
      setStatusMessage('Failed to load collection. Please try again.');
      setError(`Load collection failed: ${e.message}`);
    }
  };
  
  useEffect(() => {
    if (connected && address) {
      loadCollection();
    } else {
      setCurrentCards([]);
    }
  }, [connected, address]);

  const openPack = async (packType) => {
    if (!connected) {
      alert("Please connect your wallet to open a pack.");
      return;
    }
    setSelectedPack(packType);
    setIsModalOpen(true);
    setIsPackOpening(false);
    setRevealedCards([]);
    setStatusMessage('Click the pack to open');
  };

  const handlePackClick = async () => {
    if (isPackOpening) return;
    
    setIsPackOpening(true);
    setIsRevealed(false);
    setStatusMessage(`Fetching ${
      selectedPack === 'snekkies' 
        ? 'Snekkie' 
        : selectedPack === 'titans'
          ? 'Titan'
          : 'Frog'
    } NFT from Cardano...`);
    
    try {
      // Don't send the entire collection as it can make the URL too long
      // Just send the collection type and wallet address
      const apiUrl = `/api/openPack?walletAddress=${encodeURIComponent(address)}&collectionType=${selectedPack}`;
      console.log(`Calling API: ${apiUrl}`);
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error (${response.status}):`, errorText);
        
        if (response.status === 409) {
          throw new Error(`You have collected all available ${
            selectedPack === 'snekkies' 
              ? 'Snekkies' 
              : selectedPack === 'titans'
                ? 'Titans'
                : 'Frogs'
          }!`);
        }
        throw new Error(`API returned ${response.status}: ${errorText}`);
      }
      
      const cardData = await response.json();
      
      if (cardData) {
        // Wait for pack opening animation
        await new Promise(resolve => setTimeout(resolve, 1000));
        setStatusMessage(`Found ${cardData.name}!`);
        setRevealedCards([cardData]);
        
        // Trigger reveal animation
        setTimeout(() => {
          setIsRevealed(true);
        }, 500);
      } else {
        throw new Error('No card data received');
      }
    } catch (error) {
      console.error('Error opening pack:', error);
      setStatusMessage(`Error: ${error.message}. Please try again.`);
      // Reset after 3 seconds
      setTimeout(() => {
        setIsPackOpening(false);
        setIsRevealed(false);
      }, 3000);
    }
    setIsPackOpening(false);
  };

  const addToCollection = async () => {
    if (!connected || !address) {
      setError('Please connect your wallet first');
      return;
    }

    try {
      setError(null);
      setStatusMessage('Adding card to collection...');
      console.log(`Adding card to collection for address: ${address}`);
      
      const response = await fetch(`/api/collections/${address}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(revealedCards)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API response error:', errorText);
        throw new Error('Failed to save cards');
      }
      
      const updatedCollection = await response.json();
      setCurrentCards(updatedCollection);
      setStatusMessage('Card added to your collection!');
      localStorage.setItem(`frogCards_${address}`, JSON.stringify(updatedCollection));
      
      setTimeout(() => {
        setIsModalOpen(false);
        setCurrentTab('collection');
      }, 1500);
    } catch (e) {
      console.error('Error saving to collection:', e);
      setError(e.message);
      setStatusMessage('Failed to add card to collection. Please try again.');
    }
  };

  const filteredCards = currentCards.filter(card => {
    const matchesSearch = !searchTerm || 
      card.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRarity = !rarityFilter || card.rarity === rarityFilter;
    return matchesSearch && matchesRarity;
  });

  const getColorForRarity = (rarity) => {
    switch(rarity) {
      case 'Common': return '#78909c';
      case 'Rare': return '#4fc3f7';
      case 'Epic': return '#ba68c8';
      case 'Legendary': return '#ffd54f';
      default: return '#ff9800';
    }
  };

  const handlePackPurchase = async (packType, txHash) => {
    try {
      // Wait for transaction confirmation
      setStatusMessage('Waiting for transaction confirmation...');
      
      // You can add transaction confirmation check here
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Open the pack
      openPack(packType);
    } catch (error) {
      console.error('Error processing purchase:', error);
      setStatusMessage('Error processing purchase. Please try again.');
    }
  };

  // Add this function to get the appropriate card back image based on selected pack
  const getCardBackImage = (packType) => {
    switch(packType) {
      case 'snekkies':
        return '/images/card-back-snekkies.png';
      case 'titans':
        return '/images/card-back-titans.png';
      default: // frogs
        return '/images/card-back.png';
    }
  };

  // Check if Cardano wallets are available
  const isCardanoAvailable = () => {
    return typeof window !== 'undefined' && window.cardano !== undefined;
  };

  // Check if VESPR is installed
  const isVesprAvailable = () => {
    return isCardanoAvailable() && window.cardano.vespr !== undefined;
  };

  // Connect to VESPR wallet
  const connectVespr = async () => {
    if (!isVesprAvailable()) {
      throw new Error("VESPR wallet is not installed. Please install it first.");
    }
    
    return connectWalletContext('vespr');
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>Cardano NFT Collection</title>
        <meta name="description" content="Collect and showcase your unique NFT cards from the Cardano" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className={styles.header}>
        <h1>Cardano NFT Collection</h1>
        <div className={styles.walletSection}>
          {connected ? (
            <div className={styles.walletInfo}>
              <div className={styles.walletStatus}>
                <span className={styles.connectedDot}></span>
                <span>Connected: {api?.name || 'Wallet'}</span>
              </div>
              {address && displayAddressInfo && (
                <div className={styles.walletAddress}>
                  {displayAddressInfo.formatted}
                  {displayAddressInfo.isHex && (
                    <span className={styles.hexIndicator} title="This is a hexadecimal address from CIP-30">
                      (hex)
                    </span>
                  )}
                  <button 
                    className={styles.copyButton}
                    onClick={() => {
                      navigator.clipboard.writeText(address);
                      alert('Address copied to clipboard');
                    }}
                    title="Copy address"
                  >
                    📋
                  </button>
                </div>
              )}
              {balance && (
                <div className={styles.walletBalance}>
                  Balance: {lovelaceToAda(balance.find(b => b.unit === 'lovelace')?.quantity || '0')} ADA
                </div>
              )}
              <button 
                className={styles.disconnectButton}
                onClick={handleDisconnectWallet}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Disconnect'}
              </button>
            </div>
          ) : (
            <div className={styles.walletConnector}>
              <h3>Connect Cardano Wallet</h3>
              {walletError && <p className={styles.errorMessage}>{walletError.message || walletError}</p>}
              {error && <p className={styles.errorMessage}>{error}</p>}
              {loading && <p className={styles.loadingState}>Connecting...</p>}
              <div className={styles.walletList}>
                {availableWallets && availableWallets.length === 0 ? (
                  <div className={styles.noWalletMessage}>
                    <p>No Cardano wallets detected.</p>
                    <p className={styles.walletLinks}>Install a supported wallet:</p>
                    <div className={styles.walletOptions}>
                      <a href="https://eternl.io" target="_blank" rel="noopener noreferrer">Eternl</a>
                    </div>
                    <p className={styles.walletHelp}>After installing, refresh this page.</p>
                  </div>
                ) : (
                  <div className={styles.walletOptions}>
                    {availableWallets && availableWallets.map(wallet => (
                      <button
                        key={wallet.name}
                        className={styles.walletOption}
                        onClick={() => handleConnectWallet(wallet.name)}
                        disabled={loading}
                      >
                        {loading && api?.name === wallet.name ? 'Connecting...' : wallet.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <div className={styles.tabs}>
        <div 
          className={`${styles.tab} ${currentTab === 'packs' ? styles.active : ''}`}
          onClick={() => setCurrentTab('packs')}
        >
          Card Packs
        </div>
        <div 
          className={`${styles.tab} ${currentTab === 'collection' ? styles.active : ''}`}
          onClick={() => setCurrentTab('collection')}
        >
          My Collection
        </div>
        <div 
          className={`${styles.tab} ${currentTab === 'teams' ? styles.active : ''}`}
          onClick={() => setCurrentTab('teams')}
        >
          Teams
        </div>
        <div 
          className={`${styles.tab} ${currentTab === 'games' ? styles.active : ''}`}
          onClick={() => setCurrentTab('games')}
        >
          Games
        </div>
      </div>

      <main className={styles.main}>
        {currentTab === 'packs' ? (
          <div className={styles.packsTab}>
            <h2>Open an NFT Card Pack</h2>
            <div className={styles.packContainer}>
              <div 
                className={styles.pack}
                onClick={() => openPack('frogs')}
                data-policy-id="3cf8489b12ded9346708bed263307b362ce813636f92bddfd46e02ec"
              >
                <div className={styles.packImage}>🐸</div>
                <h3 className={styles.packTitle}>Frog Card Pack</h3>
                <p className={styles.packDescription}>
                  Contains 1 random frog card from the Cardano NFT collection via BlockFrost
                </p>
                <button className={styles.actionBtn}>Open Pack</button>
              </div>
              
              <div 
                className={styles.pack}
                onClick={() => openPack('snekkies')}
                data-policy-id="b1d156f83ef3a68d9a82bd4a8a7c1e5edbabb200f9bac3e093d9e25d"
              >
                <div className={styles.packImage}>🐍</div>
                <h3 className={styles.packTitle}>Snekkies Card Pack</h3>
                <p className={styles.packDescription}>
                  Contains 1 random Snekkie card from the Cardano NFT collection via BlockFrost
                </p>
                <button className={styles.actionBtn}>Open Pack</button>
              </div>
              
              <div 
                className={styles.pack}
                onClick={() => openPack('titans')}
                data-policy-id="53d6297f4ede5cd3bfed7281b73fad3dac8dc86a950f7454d84c16ad"
              >
                <div className={styles.packImage}>🦁</div>
                <h3 className={styles.packTitle}>Titans Card Pack</h3>
                <p className={styles.packDescription}>
                  Contains 1 random Titan card from the Cardano NFT collection via BlockFrost
                </p>
                <button className={styles.actionBtn}>Open Pack</button>
              </div>
            </div>
          </div>
        ) : currentTab === 'collection' ? (
          <div className={styles.collectionTab}>
            <h2>My Collection</h2>
            {error && (
              <div className={styles.errorMessage}>
                <p>Error: {error}</p>
                <button onClick={loadCollection} className={styles.retryButton}>
                  Retry Loading Collection
                </button>
              </div>
            )}
            {statusMessage && (
              <div className={styles.statusMessage}>
                <p>{statusMessage}</p>
              </div>
            )}
            <div className={styles.collectionInfo}>
              <p>Connected Address: {displayAddressInfo?.formatted}</p>
              <p>Total NFTs: {currentCards.length}</p>
              {currentCards.length > 0 && (
                <p>Collections: {[...new Set(currentCards.map(card => {
                  const collectionAttr = card.attributes?.find(attr => attr.trait_type === "Collection");
                  return collectionAttr ? collectionAttr.value : "Unknown";
                }))].join(', ')}</p>
              )}
            </div>
            <div className={styles.filters}>
              <input
                type="text"
                placeholder="Search cards..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.searchInput}
              />
              <select
                value={rarityFilter}
                onChange={(e) => setRarityFilter(e.target.value)}
                className={styles.rarityFilter}
              >
                <option value="">All Rarities</option>
                <option value="Common">Common</option>
                <option value="Rare">Rare</option>
                <option value="Epic">Epic</option>
                <option value="Legendary">Legendary</option>
              </select>
            </div>
            {currentCards.length === 0 ? (
              <div className={styles.emptyCollection}>
                <p>No NFTs in your collection yet.</p>
                <p>Open card packs to start collecting!</p>
                <button 
                  onClick={() => setCurrentTab('packs')} 
                  className={styles.actionBtn}
                >
                  Open Card Packs
                </button>
              </div>
            ) : (
              <CardCollection 
                cards={filteredCards}
                title="My Collection"
                isLoading={statusMessage === 'Loading your collection...'}
              />
            )}
          </div>
        ) : currentTab === 'teams' ? (
          <div className={styles.teamsTab}>
            <h2>Team Builder</h2>
            <TeamBuilder 
              cards={currentCards}
              onBattleComplete={(result) => {
                if (result.winner === 'draw') {
                  showAlert(`Battle ended in a draw!`);
                } else {
                  const winnerCollection = result.winner === 'teamA' ? result.teamACollection : result.teamBCollection;
                  const loserCollection = result.winner === 'teamA' ? result.teamBCollection : result.teamACollection;
                  showAlert(`${winnerCollection} won the battle against ${loserCollection}!`);
                }
              }}
            />
          </div>
        ) : (
          <div className={styles.gamesTab}>
            <h2>Mini-Games</h2>
            
            {selectedGame ? (
              <>
                {gameCompleted ? (
                  <div className={styles.gameResults}>
                    <h3>Game Completed!</h3>
                    {gameResults && (
                      <div className={styles.resultsContent}>
                        {gameResults.score !== undefined && (
                          <p>Score: <strong>{gameResults.score}</strong></p>
                        )}
                        {gameResults.winner && (
                          <p>Result: <strong>{gameResults.winner === 'player' ? 'Victory!' : 'Defeat'}</strong></p>
                        )}
                        {gameResults.rewardPoints !== undefined && (
                          <p>Reward Points: <strong>+{gameResults.rewardPoints}</strong></p>
                        )}
                      </div>
                    )}
                    <button 
                      className={styles.actionBtn}
                      onClick={() => {
                        setSelectedGame(null);
                        setGameCompleted(false);
                        setGameResults(null);
                      }}
                    >
                      Back to Games
                    </button>
                  </div>
                ) : (
                  <>
                    <div className={styles.gameHeader}>
                      <button 
                        className={styles.backButton}
                        onClick={() => setSelectedGame(null)}
                      >
                        ← Back to Games
                      </button>
                      <h3>{selectedGame === 'battle' ? 'Battle Arena' : 
                          selectedGame === 'solitaire' ? 'Solitaire' :
                          'Memory Match'}</h3>
                    </div>
                    
                    {selectedGame === 'battle' && (
                      <BattleArena
                        cards={currentCards}
                        onGameComplete={(results) => {
                          setGameCompleted(true);
                          setGameResults(results);
                          setRewardPoints(prev => prev + (results.rewardPoints || 0));
                          
                          // Save results or give rewards
                          try {
                            fetch('/api/rewards', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                address: address || 'guest',
                                source: selectedGame,
                                points: results.rewardPoints || 0,
                                gameData: results
                              }),
                            });
                          } catch (err) {
                            console.error('Failed to save game results:', err);
                          }
                        }}
                      />
                    )}
                    
                    {selectedGame === 'solitaire' && (
                      <Solitaire
                        nfts={currentCards.length >= 13 ? currentCards.slice(0, 13) : currentCards} // Use available cards or all if less than 13
                        onGameComplete={(results) => {
                          setGameCompleted(true);
                          setGameResults(results);
                          setRewardPoints(prev => prev + (results.rewardPoints || 0));
                          
                          // Save results or give rewards
                          try {
                            fetch('/api/rewards', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                address: address || 'guest',
                                source: selectedGame,
                                points: results.rewardPoints || 0,
                                gameData: results
                              }),
                            });
                          } catch (err) {
                            console.error('Failed to save game results:', err);
                          }
                        }}
                      />
                    )}
                    
                    {selectedGame === 'memory' && (
                      <MemoryGame
                        cards={currentCards}
                        onGameComplete={(results) => {
                          setGameCompleted(true);
                          setGameResults(results);
                          setRewardPoints(prev => prev + (results.rewardPoints || 0));
                          
                          // Save results or give rewards
                          try {
                            fetch('/api/rewards', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                address: address || 'guest',
                                source: selectedGame,
                                points: results.rewardPoints || 0,
                                gameData: results
                              }),
                            });
                          } catch (err) {
                            console.error('Failed to save game results:', err);
                          }
                        }}
                      />
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <p>Play games with your collected cards to earn rewards!</p>
                
                {currentCards.length < 6 ? (
                  <div className={styles.noCardsWarning}>
                    <p>You need at least 6 cards to play mini-games. Open card packs to collect more cards!</p>
                    <button 
                      className={styles.actionBtn}
                      onClick={() => setCurrentTab('packs')}
                    >
                      Go to Card Packs
                    </button>
                  </div>
                ) : (
                  <div className={styles.gameOptions}>
                    <div 
                      className={styles.gameCard} 
                      onClick={() => router.push('/games/nft-mahjong-solitaire')}
                    >
                      <h3>Mahjong Solitaire (Turtle)</h3>
                      <p>Play the classic Turtle layout with your NFTs.</p>
                      <div className={styles.gameIcon}>🐢</div>
                      <button className={styles.playButton}>Play</button>
                    </div>
                    
                    <div 
                      className={styles.gameCard} 
                      onClick={() => setSelectedGame('battle')}
                    >
                      <h3>Battle Arena</h3>
                      <p>Turn-based card battles using card stats</p>
                      <div className={styles.gameIcon}>⚔️</div>
                      <button className={styles.playButton}>Play</button>
                    </div>
                    
                    <div 
                      className={styles.gameCard} 
                      onClick={() => setSelectedGame('solitaire')}
                    >
                      <h3>Solitaire</h3>
                      <p>Classic solitaire game with your NFT collection</p>
                      <div className={styles.gameIcon}>🃏</div>
                      <button className={styles.playButton}>Play</button>
                    </div>
                    
                    <div 
                      className={styles.gameCard} 
                      onClick={() => setSelectedGame('memory')}
                    >
                      <h3>Memory Match</h3>
                      <p>Match cards with same attributes in a grid</p>
                      <div className={styles.gameIcon}>🧩</div>
                      <button className={styles.playButton}>Play</button>
                    </div>
                  </div>
                )}
                
                {rewardPoints > 0 && (
                  <div className={styles.rewardPointsDisplay}>
                    <p>Your Reward Points: <strong>{rewardPoints}</strong></p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {isModalOpen && (
        <div className={styles.modal}>
          <div className={styles.closeModal} onClick={() => {
            setIsModalOpen(false);
            setIsRevealed(false);
            setIsPackOpening(false);
          }}>×</div>
          <div className={styles.modalContent}>
            <h2>Opening {
              selectedPack === 'snekkies' 
                ? 'Snekkies' 
                : selectedPack === 'titans'
                  ? 'Titans'
                  : 'Frog'
            } Pack with BlockFrost</h2>
            <div className={styles.packOpening}>
              <div 
                className={`${styles.packWrapper} ${isPackOpening ? styles.opened : ''} ${isRevealed ? styles.revealed : ''}`} 
                onClick={handlePackClick}
              >
                <div className={styles.packFront}>
                  <img 
                    src={getCardBackImage(selectedPack)}
                    alt="Card Pack" 
                    className={styles.packImage}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>
                <div className={styles.packBack}>
                  {isPackOpening && !isRevealed && <div className={styles.loading} />}
                  {revealedCards.length > 0 && (
                    <div className={`${styles.revealedCard} ${isRevealed ? styles.visible : ''}`}>
                      <div className={styles.cardGlow} />
                      <div className={styles.cardImage} style={{backgroundColor: getColorForRarity(revealedCards[0].rarity)}}>
                        <img 
                          src={revealedCards[0].image} 
                          alt={revealedCards[0].name} 
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = getCardBackImage(selectedPack);
                          }} 
                        />
                      </div>
                      <div className={styles.cardContent}>
                        <h3 className={styles.cardTitle}>{revealedCards[0].name}</h3>
                        <div 
                          className={styles.cardRarity} 
                          style={{backgroundColor: getColorForRarity(revealedCards[0].rarity)}}
                        >
                          {revealedCards[0].rarity}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className={styles.statusMessage}>
              {statusMessage}
            </div>
            {isRevealed && revealedCards.length > 0 && (
              <button className={styles.actionBtn} onClick={addToCollection}>
                Add to Collection
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 
