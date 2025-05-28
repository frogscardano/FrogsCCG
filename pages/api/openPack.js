// Mock pack opening API endpoint
export default function handler(req, res) {
  try {
    console.log('🎁 Pack opening API called');
    console.log('Query params:', req.query);
    
    const { collection, collectionType } = req.query;
    
    // Parse the current collection if provided
    let currentCollection = [];
    try {
      if (collection && collection !== 'undefined') {
        currentCollection = JSON.parse(decodeURIComponent(collection));
      }
    } catch (parseError) {
      console.warn('Failed to parse collection:', parseError);
    }
    
    console.log(`Opening ${collectionType || 'frog'} pack. Current collection size: ${currentCollection.length}`);
    
    // Mock card data based on collection type
    const mockCards = {
      frogs: [
        {
          id: `frog_${Date.now()}`,
          name: "Mystic Frog #1337",
          rarity: "Epic",
          image: "/images/placeholder.png",
          imageUrl: "/images/placeholder.png",
          attack: 65,
          health: 70,
          speed: 60,
          special: "Water Splash",
          attributes: [
            { trait_type: "Collection", value: "Frogs" },
            { trait_type: "Number", value: "1337" },
            { trait_type: "Element", value: "Water" }
          ]
        },
        {
          id: `frog_${Date.now() + 1}`,
          name: "Forest Frog #42",
          rarity: "Rare",
          image: "/images/placeholder.png",
          imageUrl: "/images/placeholder.png",
          attack: 45,
          health: 55,
          speed: 50,
          special: "Leaf Shield",
          attributes: [
            { trait_type: "Collection", value: "Frogs" },
            { trait_type: "Number", value: "42" },
            { trait_type: "Element", value: "Nature" }
          ]
        }
      ],
      snekkies: [
        {
          id: `snekkie_${Date.now()}`,
          name: "Lightning Snekkie #999",
          rarity: "Legendary",
          image: "/images/placeholder.png",
          imageUrl: "/images/placeholder.png",
          attack: 80,
          health: 60,
          speed: 95,
          special: "Thunder Strike",
          attributes: [
            { trait_type: "Collection", value: "Snekkies" },
            { trait_type: "Number", value: "999" },
            { trait_type: "Element", value: "Electric" }
          ]
        }
      ],
      titans: [
        {
          id: `titan_${Date.now()}`,
          name: "Stone Titan #100",
          rarity: "Epic",
          image: "/images/placeholder.png",
          imageUrl: "/images/placeholder.png",
          attack: 90,
          health: 100,
          speed: 30,
          special: "Rock Smash",
          attributes: [
            { trait_type: "Collection", value: "Titans" },
            { trait_type: "Number", value: "100" },
            { trait_type: "Element", value: "Earth" }
          ]
        }
      ]
    };
    
    // Get available cards for the collection type
    const availableCards = mockCards[collectionType] || mockCards.frogs;
    
    // Check if user already has all cards (mock check)
    if (currentCollection.length >= 50) {
      return res.status(409).json({ 
        error: `You have collected all available ${collectionType || 'frogs'}!` 
      });
    }
    
    // Return a random card from the available cards
    const randomCard = availableCards[Math.floor(Math.random() * availableCards.length)];
    
    // Add some randomness to the stats
    const variation = Math.floor(Math.random() * 10) - 5; // -5 to +5
    const cardWithVariation = {
      ...randomCard,
      attack: Math.max(1, randomCard.attack + variation),
      health: Math.max(1, randomCard.health + variation),
      speed: Math.max(1, randomCard.speed + variation),
      id: `${collectionType || 'frog'}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    console.log('🎁 Returning card:', cardWithVariation.name);
    
    res.status(200).json(cardWithVariation);
  } catch (error) {
    console.error('❌ Error in openPack API:', error);
    res.status(500).json({ 
      error: 'Failed to open pack',
      message: error.message 
    });
  }
}
