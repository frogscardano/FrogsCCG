export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import Head from 'next/head';
import TeamBuilder from '../components/TeamBuilder';
import Scoreboard from '../components/Scoreboard';
import styles from '../styles/Teams.module.css';

const Teams = () => {
  const [activeTab, setActiveTab] = useState('builder');

  const handleBattleComplete = (result) => {
    console.log('Battle completed:', result);
    // You can add additional logic here like showing notifications
  };

  return (
    <>
      <Head>
        <title>Teams & Leaderboard - Frogs CCG</title>
        <meta name="description" content="Build your teams, battle other players, and climb the leaderboard in Frogs CCG!" />
      </Head>

      <div className={styles.container}>
        <div className={styles.header}>
          <h1>⚔️ Teams & Battles</h1>
          <p>Build your ultimate team, challenge other players, and dominate the leaderboard!</p>
        </div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'builder' ? styles.active : ''}`}
            onClick={() => setActiveTab('builder')}
          >
            🏗️ Team Builder
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'leaderboard' ? styles.active : ''}`}
            onClick={() => setActiveTab('leaderboard')}
          >
            🏆 Leaderboard
          </button>
        </div>

        <div className={styles.content}>
          {activeTab === 'builder' && (
            <div className={styles.builderSection}>
              <div className={styles.sectionHeader}>
                <h2>🏗️ Build Your Dream Team</h2>
                <p>Create teams of up to 5 cards, strategize synergies, and prepare for battle!</p>
              </div>
              <TeamBuilder onBattleComplete={handleBattleComplete} />
            </div>
          )}

          {activeTab === 'leaderboard' && (
            <div className={styles.leaderboardSection}>
              <div className={styles.sectionHeader}>
                <h2>🏆 Global Leaderboard</h2>
                <p>See who's dominating the competition and track your progress!</p>
              </div>
              <Scoreboard />
            </div>
          )}
        </div>

        <div className={styles.features}>
          <div className={styles.feature}>
            <div className={styles.featureIcon}>⚔️</div>
            <h3>Team Battles</h3>
            <p>Challenge other players' teams in epic turn-based battles with strategic depth.</p>
          </div>
          
          <div className={styles.feature}>
            <div className={styles.featureIcon}>🎯</div>
            <h3>Synergy System</h3>
            <p>Combine cards with special synergies for powerful team bonuses and strategies.</p>
          </div>
          
          <div className={styles.feature}>
            <div className={styles.featureIcon}>🏆</div>
            <h3>Rankings</h3>
            <p>Climb the leaderboard and earn rewards for your battle prowess.</p>
          </div>
          
          <div className={styles.feature}>
            <div className={styles.featureIcon}>📊</div>
            <h3>Statistics</h3>
            <p>Track your wins, losses, and performance across all your teams.</p>
          </div>
        </div>

        <div className={styles.howToPlay}>
          <h2>🎮 How to Play</h2>
          <div className={styles.steps}>
            <div className={styles.step}>
              <div className={styles.stepNumber}>1</div>
              <h4>Build Your Team</h4>
              <p>Select up to 5 cards from your collection to form a powerful team.</p>
            </div>
            
            <div className={styles.step}>
              <div className={styles.stepNumber}>2</div>
              <h4>Choose Your Strategy</h4>
              <p>Consider card synergies, attack/health/speed balance, and team composition.</p>
            </div>
            
            <div className={styles.step}>
              <div className={styles.stepNumber}>3</div>
              <h4>Battle Other Teams</h4>
              <p>Challenge other players' teams in strategic turn-based battles.</p>
            </div>
            
            <div className={styles.step}>
              <div className={styles.stepNumber}>4</div>
              <h4>Climb the Ranks</h4>
              <p>Win battles to improve your ranking and earn rewards on the leaderboard.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Teams;
