import React, { useState, useEffect } from 'react';
import styles from './CardCollection.module.css';
import Card from './Card';

const TradeCenter = ({ userCards, userId }) => {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedOwnCards, setSelectedOwnCards] = useState([]);
  const [receiverId, setReceiverId] = useState('');
  const [message, setMessage] = useState('');
  const [requestedCardIds, setRequestedCardIds] = useState([]);
  const [activeTab, setActiveTab] = useState('create');
  
  // Fetch user's trades
  const fetchTrades = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/trades');
      if (!response.ok) throw new Error('Failed to fetch trades');
      
      const data = await response.json();
      setTrades(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (activeTab !== 'create') {
      fetchTrades();
    }
  }, [activeTab]);
  
  // Toggle card selection
  const toggleCardSelection = (card) => {
    if (selectedOwnCards.some(c => c.id === card.id)) {
      setSelectedOwnCards(selectedOwnCards.filter(c => c.id !== card.id));
    } else {
      setSelectedOwnCards([...selectedOwnCards, card]);
    }
  };
  
  // Create a trade offer
  const handleCreateTrade = async () => {
    if (!receiverId || selectedOwnCards.length === 0 || requestedCardIds.length === 0) {
      setError('Please fill all required fields');
      return;
    }
    
    try {
      setLoading(true);
      const response = await fetch('/api/trades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receiverId,
          senderCards: selectedOwnCards.map(c => c.id),
          receiverCards: requestedCardIds,
          message
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create trade');
      }
      
      // Reset form
      setSelectedOwnCards([]);
      setReceiverId('');
      setMessage('');
      setRequestedCardIds([]);
      
      // Switch to active trades tab
      setActiveTab('active');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Process a trade action (accept/reject/cancel)
  const handleTradeAction = async (tradeId, action) => {
    try {
      setLoading(true);
      const response = await fetch('/api/trades', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tradeId,
          action
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${action} trade`);
      }
      
      // Refresh trades list
      fetchTrades();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className={styles.container}>
      <h2>Trading Center</h2>
      
      {error && <div className={styles.errorMessage}>{error}</div>}
      
      <div className={styles.tradingTabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'create' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('create')}
        >
          Create Trade
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'active' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('active')}
        >
          Active Trades
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'history' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Trade History
        </button>
      </div>
      
      {activeTab === 'create' && (
        <div className={styles.createTradeForm}>
          <div className={styles.formGroup}>
            <label>Receiver ID:</label>
            <input 
              type="text" 
              value={receiverId}
              onChange={(e) => setReceiverId(e.target.value)}
              placeholder="Enter wallet ID of receiver"
            />
          </div>
          
          <div className={styles.formGroup}>
            <label>Message (optional):</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a message to the trade offer"
            />
          </div>
          
          <div className={styles.formGroup}>
            <label>Request Cards (enter card IDs):</label>
            <textarea
              value={requestedCardIds.join(', ')}
              onChange={(e) => setRequestedCardIds(e.target.value.split(',').map(id => id.trim()))}
              placeholder="Enter card IDs separated by commas"
            />
          </div>
          
          <h3>Select cards to offer:</h3>
          <div className={styles.grid}>
            {userCards.map(card => (
              <div
                key={card.id}
                className={`${styles.cardWrapper} ${
                  selectedOwnCards.some(c => c.id === card.id) ? styles.selectedCard : ''
                }`}
                onClick={() => toggleCardSelection(card)}
              >
                <Card card={card} />
              </div>
            ))}
          </div>
          
          <button 
            className={styles.actionButton}
            disabled={loading}
            onClick={handleCreateTrade}
          >
            {loading ? 'Creating...' : 'Create Trade Offer'}
          </button>
        </div>
      )}
      
      {activeTab === 'active' && (
        <div className={styles.tradesList}>
          {loading ? (
            <p>Loading trades...</p>
          ) : trades.filter(t => t.status === 'pending').length === 0 ? (
            <p>No active trades found.</p>
          ) : (
            trades
              .filter(t => t.status === 'pending')
              .map(trade => (
                <div key={trade.id} className={styles.tradeItem}>
                  <div className={styles.tradeDetails}>
                    <p><strong>From:</strong> {trade.senderUserId}</p>
                    <p><strong>To:</strong> {trade.receiverUserId}</p>
                    <p><strong>Message:</strong> {trade.message || 'No message'}</p>
                    <p><strong>Created:</strong> {new Date(trade.createdAt).toLocaleString()}</p>
                  </div>
                  
                  <div className={styles.tradeActions}>
                    {trade.receiverUserId === userId && (
                      <>
                        <button 
                          onClick={() => handleTradeAction(trade.id, 'accept')}
                          disabled={loading}
                          className={styles.acceptButton}
                        >
                          Accept
                        </button>
                        <button 
                          onClick={() => handleTradeAction(trade.id, 'reject')}
                          disabled={loading}
                          className={styles.rejectButton}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {trade.senderUserId === userId && (
                      <button 
                        onClick={() => handleTradeAction(trade.id, 'cancel')}
                        disabled={loading}
                        className={styles.cancelButton}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))
          )}
        </div>
      )}
      
      {activeTab === 'history' && (
        <div className={styles.tradesList}>
          {loading ? (
            <p>Loading trades...</p>
          ) : trades.filter(t => t.status !== 'pending').length === 0 ? (
            <p>No trade history found.</p>
          ) : (
            trades
              .filter(t => t.status !== 'pending')
              .map(trade => (
                <div key={trade.id} className={styles.tradeItem}>
                  <div className={styles.tradeDetails}>
                    <p><strong>From:</strong> {trade.senderUserId}</p>
                    <p><strong>To:</strong> {trade.receiverUserId}</p>
                    <p><strong>Status:</strong> <span className={styles[trade.status]}>{trade.status}</span></p>
                    <p><strong>Created:</strong> {new Date(trade.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))
          )}
        </div>
      )}
    </div>
  );
};

export default TradeCenter; 