// api/generatePaymentAddress.js
// API route for generating payment addresses for pack purchases

import { prisma } from '../../utils/db';
import { 
  initializeBlockfrostBackend, 
  generatePaymentAddress 
} from './cardanoTransactions';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Get environment variables
  const blockfrostProjectId = process.env.BLOCKFROST_PROJECT_ID;
  const paymentAddress = process.env.PAYMENT_ADDRESS;
  
  if (!blockfrostProjectId || !paymentAddress) {
    console.error('BLOCKFROST_PROJECT_ID or PAYMENT_ADDRESS not set in environment variables');
    return res.status(500).json({ success: false, message: 'Server configuration error' });
  }

  // Extract data from request
  const { userId, packId } = req.body;

  // Validate required parameters
  if (!userId || !packId) {
    return res.status(400).json({ 
      success: false, 
      message: 'Missing required parameters: userId and packId are required' 
    });
  }

  try {
    // Check if the user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Check if the pack exists and get price
    const pack = await prisma.pack.findUnique({
      where: { id: packId }
    });

    if (!pack) {
      return res.status(404).json({ 
        success: false, 
        message: 'Pack not found' 
      });
    }

    // Price in lovelace (1 ADA = 1,000,000 lovelace)
    const priceInLovelace = 1000000; // 1 ADA

    // Initialize Blockfrost backend service
    const isTestnet = process.env.NODE_ENV !== 'production';
    const backendService = initializeBlockfrostBackend(blockfrostProjectId, isTestnet);

    // Generate a payment address
    // In a production environment, you would want to create unique addresses for each payment
    // For simplicity, we're using a single address from the environment variables
    const addressResult = await generatePaymentAddress(backendService, paymentAddress);

    if (!addressResult.success) {
      return res.status(500).json({ 
        success: false, 
        message: `Failed to generate payment address: ${addressResult.error}` 
      });
    }

    // Create a payment record in the database
    const payment = await prisma.payment.create({
      data: {
        userId,
        packId,
        paymentAddress: addressResult.address,
        amountLovelace: priceInLovelace.toString(),
        status: 'PENDING',
        createdAt: new Date()
      }
    });

    // Return the payment details
    return res.status(200).json({
      success: true,
      message: 'Payment address generated successfully',
      payment: {
        id: payment.id,
        address: addressResult.address,
        amountLovelace: priceInLovelace.toString(),
        amountAda: '1', // 1 ADA
        status: payment.status
      }
    });
  } catch (error) {
    console.error('Error generating payment address:', error);
    return res.status(500).json({
      success: false,
      message: `Error generating payment address: ${error.message || 'Unknown error'}`
    });
  } finally {
    // Clean up Prisma connection
    await prisma.$disconnect();
  }
} 
