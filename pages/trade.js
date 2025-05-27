import React, { useState, useEffect } from 'react';
import TradeCenter from '../components/TradeCenter';
import { getUserCards } from '../utils/db';

export default function TradePage() {
  const [userCards, setUserCards] = useState([]);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    // Fetch user ID and cards
    const fetchUserData = async () => {
      try {
        setLoading(true);
        
        // Get user session/ID
        const userResponse = await fetch('/api/user');
        if (!userResponse.ok) throw new Error('Failed to fetch user data');
        const userData = await userResponse.json();
        
        setUserId(userData.id);
        
        // Get user's cards
        const cardsResponse = await fetch(`/api/collection/${userData.id}`);
        if (!cardsResponse.ok) throw new Error('Failed to fetch cards');
        const cardsData = await cardsResponse.json();
        
        setUserCards(cardsData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, []);
  
  if (loading) {
    return <div>Loading trading center...</div>;
  }
  
  if (error) {
    return <div>Error: {error}</div>;
  }
  
  return (
    <div>
      <h1>Card Trading Center</h1>
      <TradeCenter userCards={userCards} userId={userId} />
    </div>
  );
} 