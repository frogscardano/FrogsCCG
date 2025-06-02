// api/cardanoTransactions.js
// Handles Cardano transactions for NFT pack openings

import { BlockFrostAPI } from '@blockfrost/blockfrost-js';
import { prisma } from '../../utils/db.js';

// Initialize Blockfrost API for Cardano
const initializeBlockfrostBackend = (projectId, network = 'mainnet') => {
  return new BlockFrostAPI({
    projectId,
    network
  });
};

// Convert lovelace to ADA (1 ADA = 1,000,000 lovelace)
const lovelaceToAda = (lovelace) => {
  return lovelace / 1000000;
};

// Convert ADA to lovelace
const adaToLovelace = (ada) => {
  return Math.floor(ada * 1000000);
};

// Validate a transaction - checks if it has been confirmed and contains the expected amount
const validateTransaction = async (api, txHash, expectedAmount = 1000000, requiredConfirmations = 2) => {
  try {
    // Get transaction details
    const txDetails = await api.txs(txHash);
    if (!txDetails) {
      return { 
        valid: false, 
        message: 'Transaction not found' 
      };
    }

    // Check if transaction has enough confirmations
    if (txDetails.confirmations < requiredConfirmations) {
      return { 
        valid: false, 
        message: `Transaction needs ${requiredConfirmations} confirmations, currently has ${txDetails.confirmations}` 
      };
    }

    // Get transaction outputs
    const txUtxos = await api.txsUtxos(txHash);
    
    // Find output to our payment address
    const paymentAddress = process.env.PAYMENT_ADDRESS;
    const outputToWallet = txUtxos.outputs.find(output => 
      output.address === paymentAddress
    );

    if (!outputToWallet) {
      return { 
        valid: false, 
        message: 'Transaction does not include payment to the expected address' 
      };
    }

    // Check if the amount is at least what we expected
    const amountReceived = parseInt(outputToWallet.amount[0].quantity);
    if (amountReceived < expectedAmount) {
      return { 
        valid: false, 
        message: `Received ${lovelaceToAda(amountReceived)} ADA, expected ${lovelaceToAda(expectedAmount)} ADA` 
      };
    }

    return { 
      valid: true, 
      amount: amountReceived,
      txDetails
    };
  } catch (error) {
    console.error('Error validating transaction:', error);
    return { 
      valid: false, 
      message: `Error validating transaction: ${error.message || 'Unknown error'}` 
    };
  }
};

// Check wallet for payment with given properties
const checkWalletForPayment = async (api, paymentAddress, expectedAmount, userId, paymentId) => {
  try {
    // Get transactions for the wallet address
    const addressTxs = await api.addressesTransactions(paymentAddress, { 
      order: 'desc',
      count: 20 // Limit to recent transactions
    });

    // Check if there's already a recorded payment with this paymentId
    const existingPayment = await prisma.payment.findFirst({
      where: {
        paymentId: paymentId,
        status: 'CONFIRMED'
      }
    });

    if (existingPayment) {
      return {
        found: true,
        txHash: existingPayment.txHash,
        paymentRecord: existingPayment
      };
    }

    // Look for transactions with the expected amount
    for (const tx of addressTxs) {
      // Get full transaction details
      const validation = await validateTransaction(api, tx.tx_hash, expectedAmount);
      
      if (validation.valid) {
        // Check if this transaction was already used for a different payment
        const usedTx = await prisma.payment.findFirst({
          where: {
            txHash: tx.tx_hash,
            status: 'CONFIRMED'
          }
        });

        if (usedTx) {
          continue; // Skip this transaction as it's already used
        }

        // Record the payment
        const payment = await prisma.payment.update({
          where: { id: paymentId },
          data: {
            status: 'CONFIRMED',
            amountLovelace: validation.amount.toString(),
            txHash: tx.tx_hash,
            confirmedAt: new Date(),
          }
        });

        return {
          found: true,
          txHash: tx.tx_hash,
          paymentRecord: payment
        };
      }
    }

    return {
      found: false,
      message: 'No valid payment transaction found'
    };
  } catch (error) {
    console.error('Error checking wallet for payment:', error);
    return {
      found: false,
      message: `Error checking wallet for payment: ${error.message || 'Unknown error'}`
    };
  }
};

// Get payment details using payment ID from database
const getPaymentDetails = async (paymentId) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        user: {
          select: {
            id: true,
            walletAddress: true
          }
        },
        pack: true
      }
    });

    if (!payment) {
      return {
        success: false,
        message: 'Payment not found'
      };
    }

    return {
      success: true,
      payment
    };
  } catch (error) {
    console.error('Error getting payment details:', error);
    return {
      success: false,
      message: `Error getting payment details: ${error.message || 'Unknown error'}`
    };
  }
};

// Record a pack opening transaction
const recordPackOpening = async (paymentId, userId, walletAddress, txHash) => {
  try {
    // Get payment details
    const paymentResult = await getPaymentDetails(paymentId);
    if (!paymentResult.success) {
      return paymentResult;
    }

    const payment = paymentResult.payment;
    
    // Create the pack opening record
    const packOpening = await prisma.packOpening.create({
      data: {
        userId: userId,
        packId: payment.packId,
        walletAddress: walletAddress,
        txHash: txHash,
        openedAt: new Date()
      }
    });

    // Generate random cards for this pack
    const cardsPerPack = payment.pack.nftCount || 3;
    
    // Get available NFTs for this pack type
    // In a real implementation, you would have logic to determine which NFTs are available
    // Here's a simplified version that gets a random sample of NFTs from the database
    const availableNFTs = await prisma.nFT.findMany({
      where: {
        packOpeningId: null, // Only get NFTs that haven't been claimed yet
        // You might also filter by other properties specific to this pack
      },
      take: 100 // Get a pool of available NFTs to randomly select from
    });

    if (availableNFTs.length < cardsPerPack) {
      return {
        success: false,
        message: 'Not enough available NFTs to open this pack'
      };
    }

    // Randomly select NFTs for this pack opening
    const selectedNFTs = [];
    const selectedIndices = new Set();
    
    while (selectedNFTs.length < cardsPerPack && selectedIndices.size < availableNFTs.length) {
      const randomIndex = Math.floor(Math.random() * availableNFTs.length);
      
      if (!selectedIndices.has(randomIndex)) {
        selectedIndices.add(randomIndex);
        selectedNFTs.push(availableNFTs[randomIndex]);
      }
    }

    // Update the selected NFTs to be associated with this pack opening
    for (const nft of selectedNFTs) {
      await prisma.nFT.update({
        where: { id: nft.id },
        data: {
          userId: userId,
          packOpeningId: packOpening.id,
          claimedAt: new Date()
        }
      });
    }

    return {
      success: true,
      packOpening,
      nfts: selectedNFTs
    };
  } catch (error) {
    console.error('Error recording pack opening:', error);
    return {
      success: false,
      message: `Error recording pack opening: ${error.message || 'Unknown error'}`
    };
  }
};

// Create a new payment record
const createPaymentRecord = async (userId, packId, paymentAddress) => {
  try {
    const payment = await prisma.payment.create({
      data: {
        userId,
        packId,
        paymentAddress,
        status: 'PENDING',
        createdAt: new Date()
      }
    });

    return {
      success: true,
      payment
    };
  } catch (error) {
    console.error('Error creating payment record:', error);
    return {
      success: false,
      message: `Error creating payment record: ${error.message || 'Unknown error'}`
    };
  }
};

// Generate a payment address for a user
// In a production environment, you might want to generate unique addresses
// For simplicity, we'll use a single payment address with unique payment IDs
const generatePaymentAddress = async (userId, packId) => {
  const paymentAddress = process.env.PAYMENT_ADDRESS;
  
  if (!paymentAddress) {
    return {
      success: false,
      message: 'Payment address not configured'
    };
  }

  try {
    // Create a payment record
    const paymentResult = await createPaymentRecord(userId, packId, paymentAddress);
    
    if (!paymentResult.success) {
      return paymentResult;
    }

    return {
      success: true,
      paymentAddress: paymentAddress,
      paymentId: paymentResult.payment.id,
      expiresAt: new Date(Date.now() + 3600000) // 1 hour from now
    };
  } catch (error) {
    console.error('Error generating payment address:', error);
    return {
      success: false,
      message: `Error generating payment address: ${error.message || 'Unknown error'}`
    };
  }
};

export {
  initializeBlockfrostBackend,
  validateTransaction,
  lovelaceToAda,
  adaToLovelace,
  checkWalletForPayment,
  recordPackOpening,
  generatePaymentAddress,
  getPaymentDetails
}; 
