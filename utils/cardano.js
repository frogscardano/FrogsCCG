import { Buffer } from 'buffer';

// Cardano network parameters
const NETWORK_PARAMS = {
  mainnet: {
    networkId: 1,
    protocolMagic: 764824073
  },
  testnet: {
    networkId: 0,
    protocolMagic: 1097911063
  }
};

// Helper function to convert ADA to lovelace
export function adaToLovelace(ada) {
  return Math.floor(ada * 1000000);
}

// Helper function to convert lovelace to ADA
export function lovelaceToAda(lovelace) {
  return lovelace / 1000000;
}

// Function to build a transaction for purchasing a card pack
export async function buildPackPurchaseTx(walletApi, priceInAda, metadata) {
  try {
    // Get network parameters
    const networkId = await walletApi.getNetworkId();
    const network = networkId === 1 ? 'mainnet' : 'testnet';
    const networkParams = NETWORK_PARAMS[network];

    // Get UTXOs
    const utxos = await walletApi.getUtxos();
    if (!utxos || utxos.length === 0) {
      throw new Error('No UTXOs available');
    }

    // Convert price to lovelace
    const priceInLovelace = adaToLovelace(priceInAda);

    // Get change address
    const changeAddress = await walletApi.getChangeAddress();
    if (!changeAddress) {
      throw new Error('Could not get change address');
    }

    // Build transaction
    const txBuilder = await walletApi.createTxBuilder();
    
    // Add inputs
    for (const utxo of utxos) {
      await txBuilder.addInput(utxo);
    }

    // Add output to our address (this is where the card pack will be sent)
    await txBuilder.addOutput(changeAddress, priceInLovelace);

    // Add metadata
    if (metadata) {
      const metadataBytes = Buffer.from(JSON.stringify(metadata));
      await txBuilder.addMetadata(metadataBytes);
    }

    // Set network parameters
    await txBuilder.setNetworkParams(networkParams);

    // Build and sign transaction
    const tx = await txBuilder.build();
    const signedTx = await walletApi.signTx(tx);

    return {
      tx: signedTx,
      network,
      priceInLovelace
    };
  } catch (error) {
    console.error('Error building transaction:', error);
    throw error;
  }
}

// Function to submit a transaction
export async function submitTx(walletApi, signedTx) {
  try {
    const txHash = await walletApi.submitTx(signedTx);
    return txHash;
  } catch (error) {
    console.error('Error submitting transaction:', error);
    throw error;
  }
}

// Function to check if a transaction is confirmed
export async function isTxConfirmed(walletApi, txHash) {
  try {
    const utxos = await walletApi.getUtxos();
    return utxos.some(utxo => utxo.txHash === txHash);
  } catch (error) {
    console.error('Error checking transaction confirmation:', error);
    throw error;
  }
} 