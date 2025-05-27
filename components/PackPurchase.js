import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/authContext';
import styles from '../styles/PackPurchase.module.css';

const PackPurchase = ({ packId, packName, packPrice = "1.00" }) => {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [payment, setPayment] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [statusCheckInterval, setStatusCheckInterval] = useState(null);
  const [txHash, setTxHash] = useState('');

  useEffect(() => {
    // Clean up interval on component unmount
    return () => {
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
      }
    };
  }, [statusCheckInterval]);

  // Generate a payment address when the component mounts
  useEffect(() => {
    if (user && packId) {
      generatePaymentAddress();
    }
  }, [user, packId]);

  const generatePaymentAddress = async () => {
    if (!user) {
      setError('You must be logged in to purchase packs');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/generatePaymentAddress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          packId,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to generate payment address');
      }

      setPayment(data.payment);
      
      // Start checking payment status
      const interval = setInterval(() => {
        checkPaymentStatus(data.payment.id);
      }, 10000); // Check every 10 seconds
      
      setStatusCheckInterval(interval);
    } catch (err) {
      console.error('Error generating payment address:', err);
      setError(err.message || 'An error occurred while generating payment address');
    } finally {
      setLoading(false);
    }
  };

  const checkPaymentStatus = async (paymentId) => {
    try {
      const response = await fetch(`/api/checkPaymentStatus?paymentId=${paymentId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to check payment status');
      }

      setPaymentStatus(data.payment.status);

      // If payment is completed, stop checking
      if (data.payment.status === 'COMPLETED') {
        if (statusCheckInterval) {
          clearInterval(statusCheckInterval);
          setStatusCheckInterval(null);
        }
      }
      
      // If payment is expired, stop checking and show message
      if (data.payment.status === 'EXPIRED') {
        if (statusCheckInterval) {
          clearInterval(statusCheckInterval);
          setStatusCheckInterval(null);
        }
      }
    } catch (err) {
      console.error('Error checking payment status:', err);
      // Don't stop checking on error
    }
  };

  const handleOpenPack = async () => {
    if (!txHash) {
      setError('Please enter a transaction hash');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/packOpening', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          walletAddress: user.walletAddress || 'unknown',
          txHash,
          packId,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to open pack');
      }

      // Redirect to the pack opening result page
      router.push(`/pack-opening/${data.packOpening.id}`);
    } catch (err) {
      console.error('Error opening pack:', err);
      setError(err.message || 'An error occurred while opening the pack');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Purchase {packName}</h2>
      <p className={styles.price}>Price: {packPrice} ADA</p>

      {error && <div className={styles.error}>{error}</div>}

      {!payment && (
        <button 
          className={styles.button} 
          onClick={generatePaymentAddress} 
          disabled={loading}
        >
          {loading ? 'Generating...' : 'Generate Payment Address'}
        </button>
      )}

      {payment && (
        <div className={styles.paymentDetails}>
          <h3>Payment Details</h3>
          <div className={styles.addressContainer}>
            <p className={styles.label}>Send {packPrice} ADA to:</p>
            <p className={styles.address}>{payment.address}</p>
            <button 
              className={styles.copyButton} 
              onClick={() => copyToClipboard(payment.address)}
            >
              Copy Address
            </button>
          </div>

          <div className={styles.status}>
            <p className={styles.label}>Status:</p>
            <p className={styles.statusValue}>
              {paymentStatus === 'COMPLETED' ? '✅ Payment Completed' :
               paymentStatus === 'EXPIRED' ? '❌ Payment Expired' :
               loading ? 'Checking...' : '⏳ Waiting for Payment'}
            </p>
          </div>

          {(paymentStatus === 'COMPLETED' || !payment) && (
            <div className={styles.openPackSection}>
              <h3>Already sent payment?</h3>
              <p>Enter your transaction hash to open the pack:</p>
              <input
                type="text"
                className={styles.txHashInput}
                placeholder="Transaction Hash"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
              />
              <button 
                className={styles.openButton} 
                onClick={handleOpenPack} 
                disabled={loading || !txHash}
              >
                {loading ? 'Opening...' : 'Open Pack'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PackPurchase; 