import React, { useState, useEffect } from 'react';
import styles from './Trading.module.css';
import Card from './Card';

const Trading = ({ userCards, userId }) => {
  const [activeTab, setActiveTab] = useState('create');
  const [selectedOwnCards, setSelectedOwnCards] = useState([]);
  const [selectedOtherCards, setSelectedOtherCards] = useState([]);
  const [receiverId, setReceiverId] = useState('');
  const [message, setMessage] = useState('');
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  
  // Fetch existing trades
  const fetchTrades = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/trades?userId=${userId}`);
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
    if (activeTab === 'active' || activeTab === 'history') {
      fetchTrades();
    }
  }, [activeTab, userId]);
  
  // Create a trade offer
  const handleCreateTrade = async () => {
    if (!receiverId || selectedOwnCards.length === 0 || selectedOtherCards.length === 0) {
      setError('Please fill out all required fields');
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
          senderUserId: userId,
          receiverUserId: receiverId,
          senderCardIds: selectedOwnCards.map(card => card.id),
          receiverCardIds: selectedOtherCards.map(card => card.id),
          message,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to create trade');
      
      setSuccessMessage('Trade offer created successfully!');
      setSelectedOwnCards([]);
      setSelectedOtherCards([]);
      setReceiverId('');
      setMessage('');
      
      // Switch to active trades tab
      setActiveTab('active');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Process a trade (accept/reject/cancel)
  const handleProcessTrade = async (tradeId, status) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/trades/${tradeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      
      if (!response.ok) throw new Error(`Failed to ${status} trade`);
      
      setSuccessMessage(`Trade ${status} successfully!`);
      fetchTrades();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle selecting cards for trade
  const toggleCardSelection = (card, isUserCard) => {
    if (isUserCard) {
      const isSelected = selectedOwnCards.some(c => c.id === card.id);
      if (isSelected) {
        setSelectedOwnCards(selectedOwnCards.filter(c => c.id !== card.id));
      } else {
        setSelectedOwnCards([...selectedOwnCards, card]);
      }
    } else {
      const isSelected = selectedOtherCards.some(c => c.id === card.id);
      if (isSelected) {
        setSelectedOtherCards(selectedOtherCards.filter(c => c.id !== card.id));
      } else {
        setSelectedOtherCards([...selectedOtherCards, card]);
      }
    }
  };
  
  // Render the create trade tab
  const renderCreateTradeTab = () => (
    <div className={styles.createTradeContainer}>
      <div className={styles.tradeForm}>
        <div className={styles.formGroup}>
          <label htmlFor="receiverId">Receiver Wallet ID:</label>
          <input
            type="text"
            id="receiverId"
            value={receiverId}
            onChange={(e) => setReceiverId(e.target.value)}
            placeholder="Enter receiver's wallet ID"
          />
        </div>
        
        <div className={styles.formGroup}>
          <label htmlFor="message">Message (Optional):</label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Add a message to your trade offer"
          />
        </div>
        
        <button 
          className={styles.createButton}
          onClick={handleCreateTrade}
          disabled={loading}
        >
          {loading ? 'Creating...' : 'Create Trade Offer'}
        </button>
      </div>
      
      <div className={styles.cardSelectionContainer}>
        <div className={styles.cardSection}>
          <h3>Your Cards (Select to offer)</h3>
          <div className={styles.cardGrid}>
            {userCards.map(card => (
              <div 
                key={card.id} 
                className={`${styles.cardSelection} ${selectedOwnCards.some(c => c.id === card.id) ? styles.selected : ''}`}
                onClick={() => toggleCardSelection(card, true)}
              >
                <Card card={card} />
              </div>
            ))}
          </div>
        </div>
        
        <div className={styles.cardSection}>
          <h3>Cards You Want (Search or enter IDs)</h3>
          <div className={styles.searchCards}>
            {/* This would need to be implemented with a card search feature */}
            <input type="text" placeholder="Search for cards..." />
          </div>
          <div className={styles.cardGrid}>
            {selectedOtherCards.map(card => (
              <div 
                key={card.id} 
                className={styles.cardSelection}
                onClick={() => toggleCardSelection(card, false)}
              >
                <Card card={card} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
  
  // Render active trades tab
  const renderActiveTradesTab = () => {
    const activeTrades = trades.filter(trade => trade.status === 'pending');
    
    return (
      <div className={styles.tradesContainer}>
        {activeTrades.length === 0 ? (
          <p>No active trades found.</p>
        ) : (
          activeTrades.map(trade => (
            <div key={trade.id} className={styles.tradeItem}>
              <div className={styles.tradeDetails}>
                <p><strong>From:</strong> {trade.senderUserId}</p>
                <p><strong>To:</strong> {trade.receiverUserId}</p>
                <p><strong>Message:</strong> {trade.message || 'No message'}</p>
                <p><strong>Created:</strong> {new Date(trade.createdAt).toLocaleString()}</p>
              </div>
              
              <div className={styles.tradeCards}>
                <div className={styles.offerSection}>
                  <h4>Offered Cards</h4>
                  <div className={styles.cardGrid}>
                    {/* Display cards being offered */}
                  </div>
                </div>
                
                <div className={styles.requestSection}>
                  <h4>Requested Cards</h4>
                  <div className={styles.cardGrid}>
                    {/* Display cards being requested */}
                  </div>
                </div>
              </div>
              
              <div className={styles.tradeActions}>
                {trade.receiverUserId === userId && (
                  <>
                    <button 
                      className={styles.acceptButton}
                      onClick={() => handleProcessTrade(trade.id, 'accepted')}
                      disabled={loading}
                    >
                      Accept
                    </button>
                    <button 
                      className={styles.rejectButton}
                      onClick={() => handleProcessTrade(trade.id, 'rejected')}
                      disabled={loading}
                    >
                      Reject
                    </button>
                  </>
                )}
                {trade.senderUserId === userId && (
                  <button 
                    className={styles.cancelButton}
                    onClick={() => handleProcessTrade(trade.id, 'canceled')}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    );
  };
  
  // Render trade history tab
  const renderTradeHistoryTab = () => {
    const completedTrades = trades.filter(trade => trade.status !== 'pending');
    
    return (
      <div className={styles.tradesContainer}>
        {completedTrades.length === 0 ? (
          <p>No trade history found.</p>
        ) : (
          completedTrades.map(trade => (
            <div key={trade.id} className={styles.tradeItem}>
              <div className={styles.tradeDetails}>
                <p><strong>From:</strong> {trade.senderUserId}</p>
                <p><strong>To:</strong> {trade.receiverUserId}</p>
                <p><strong>Status:</strong> <span className={styles[trade.status]}>{trade.status}</span></p>
                <p><strong>Created:</strong> {new Date(trade.createdAt).toLocaleString()}</p>
                <p><strong>Updated:</strong> {new Date(trade.updatedAt).toLocaleString()}</p>
              </div>
              
              <div className={styles.tradeCards}>
                {/* Similar card display as active trades */}
              </div>
            </div>
          ))
        )}
      </div>
    );
  };
  
  return (
    <div className={styles.tradingContainer}>
      <h2>Card Trading</h2>
      
      {error && <div className={styles.errorMessage}>{error}</div>}
      {successMessage && <div className={styles.successMessage}>{successMessage}</div>}
      
      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'create' ? styles.active : ''}`}
          onClick={() => setActiveTab('create')}
        >
          Create Trade
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'active' ? styles.active : ''}`}
          onClick={() => setActiveTab('active')}
        >
          Active Trades
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'history' ? styles.active : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Trade History
        </button>
      </div>
      
      <div className={styles.tabContent}>
        {activeTab === 'create' && renderCreateTradeTab()}
        {activeTab === 'active' && renderActiveTradesTab()}
        {activeTab === 'history' && renderTradeHistoryTab()}
      </div>
    </div>
  );
};

export default Trading; 