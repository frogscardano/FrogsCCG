// api/checkPaymentStatus.js
// API route for checking the status of a payment

import { PrismaClient } from '@prisma/client';
import { 
  initializeBlockfrostBackend, 
  checkWalletForPayment 
} from './cardanoTransactions';

const prisma = new PrismaClient();

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Get environment variables
  const blockfrostProjectId = process.env.BLOCKFROST_PROJECT_ID;
  if (!blockfrostProjectId) {
    console.error('BLOCKFROST_PROJECT_ID not set in environment variables');
    return res.status(500).json({ success: false, message: 'Server configuration error' });
  }

  // Extract payment ID from query parameters
  const { paymentId } = req.query;

  // Validate required parameters
  if (!paymentId) {
    return res.status(400).json({ 
      success: false, 
      message: 'Missing required parameter: paymentId is required' 
    });
  }

  try {
    // Fetch the payment record from the database
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId }
    });

    if (!payment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Payment not found' 
      });
    }

    // If payment is already completed or expired, just return the current status
    if (payment.status !== 'PENDING') {
      return res.status(200).json({
        success: true,
        payment: {
          id: payment.id,
          address: payment.paymentAddress,
          amountLovelace: payment.amountLovelace,
          amountAda: (parseInt(payment.amountLovelace) / 1000000).toString(),
          status: payment.status,
          txHash: payment.txHash || null
        }
      });
    }

    // Initialize Blockfrost backend service
    const isTestnet = process.env.NODE_ENV !== 'production';
    const backendService = initializeBlockfrostBackend(blockfrostProjectId, isTestnet);

    // Check the wallet for payment
    const paymentCheck = await checkWalletForPayment(
      backendService, 
      payment.paymentAddress, 
      payment.amountLovelace
    );

    // If payment is detected, update the payment record
    if (paymentCheck.paid) {
      // In a real-world scenario, you would also store the transaction hash
      // This would require monitoring the blockchain for transactions to this address
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          paidAt: new Date()
        }
      });

      return res.status(200).json({
        success: true,
        message: 'Payment completed',
        payment: {
          id: payment.id,
          address: payment.paymentAddress,
          amountLovelace: payment.amountLovelace,
          amountAda: (parseInt(payment.amountLovelace) / 1000000).toString(),
          status: 'COMPLETED',
          paidAmount: paymentCheck.amount
        }
      });
    }

    // Check if payment has expired
    const now = new Date();
    const paymentCreatedAt = new Date(payment.createdAt);
    const paymentExpiryHours = 24; // Payments expire after 24 hours
    const expiryTime = new Date(paymentCreatedAt.getTime() + paymentExpiryHours * 60 * 60 * 1000);

    if (now > expiryTime) {
      // Update payment status to expired
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'EXPIRED'
        }
      });

      return res.status(200).json({
        success: true,
        message: 'Payment expired',
        payment: {
          id: payment.id,
          address: payment.paymentAddress,
          amountLovelace: payment.amountLovelace,
          amountAda: (parseInt(payment.amountLovelace) / 1000000).toString(),
          status: 'EXPIRED'
        }
      });
    }

    // Payment is still pending
    return res.status(200).json({
      success: true,
      message: 'Payment pending',
      payment: {
        id: payment.id,
        address: payment.paymentAddress,
        amountLovelace: payment.amountLovelace,
        amountAda: (parseInt(payment.amountLovelace) / 1000000).toString(),
        status: 'PENDING',
        reason: paymentCheck.reason || null,
        expiresAt: expiryTime.toISOString()
      }
    });
  } catch (error) {
    console.error('Error checking payment status:', error);
    return res.status(500).json({
      success: false,
      message: `Error checking payment status: ${error.message || 'Unknown error'}`
    });
  } finally {
    // Clean up Prisma connection
    await prisma.$disconnect();
  }
} 