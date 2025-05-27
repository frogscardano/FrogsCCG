import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const sampleCards = [
  {
    cardId: 'frog_001',
    name: 'Common Frog',
    rarity: 'common',
    imageUrl: '/images/cards/common_frog.png',
    description: 'A basic frog card with standard abilities',
    attributes: {
      attack: 2,
      defense: 2,
      health: 3,
      abilities: ['Jump']
    }
  },
  {
    cardId: 'frog_002',
    name: 'Rare Frog',
    rarity: 'rare',
    imageUrl: '/images/cards/rare_frog.png',
    description: 'A rare frog with enhanced abilities',
    attributes: {
      attack: 3,
      defense: 3,
      health: 4,
      abilities: ['Jump', 'Poison']
    }
  },
  {
    cardId: 'frog_003',
    name: 'Epic Frog',
    rarity: 'epic',
    imageUrl: '/images/cards/epic_frog.png',
    description: 'An epic frog with powerful abilities',
    attributes: {
      attack: 4,
      defense: 4,
      health: 5,
      abilities: ['Jump', 'Poison', 'Regeneration']
    }
  },
  {
    cardId: 'frog_004',
    name: 'Legendary Frog',
    rarity: 'legendary',
    imageUrl: '/images/cards/legendary_frog.png',
    description: 'A legendary frog with unique abilities',
    attributes: {
      attack: 5,
      defense: 5,
      health: 6,
      abilities: ['Jump', 'Poison', 'Regeneration', 'Teleport']
    }
  }
];

async function main() {
  try {
    // Clear existing data
    await prisma.userCard.deleteMany();
    await prisma.card.deleteMany();
    await prisma.wallet.deleteMany();

    console.log('Cleared existing data');

    // Create sample cards
    for (const card of sampleCards) {
      await prisma.card.create({
        data: card
      });
    }

    console.log('Created sample cards');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 