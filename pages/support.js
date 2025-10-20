import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../styles/Support.module.css';

export default function Support() {
  const [copiedAddress, setCopiedAddress] = useState('');

  const handleCopyAddress = (address, label) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(label);
    setTimeout(() => setCopiedAddress(''), 2000);
  };

  // Based on the code, the Frogs collection uses this policy ID
  const frogsPolicyId = '3cf8489b12ded9346708bed263307b362ce813636f92bddfd46e02ec';
  
  // HOP token - Note: Replace with actual HOP token policy if different
  const hopTokenPolicyId = 'e90f72af7212f37b1af072d74d326e7d1bc15c21f8ca4180d4fd931f';
  
  // LEAP stake pool ticker
  const leapPoolTicker = 'LEAP';

  return (
    <div className={styles.container}>
      <Head>
        <title>Support Us - Cardano NFT Collection</title>
        <meta name="description" content="Support us by buying $HOP/Frogs or staking to LEAP" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <header className={styles.header}>
        <Link href="/">
          <a className={styles.backLink}>← Back to Home</a>
        </Link>
        <h1>Support Us</h1>
      </header>

      <main className={styles.main}>
        <section className={styles.introSection}>
          <div className={styles.heartIcon}>❤️</div>
          <h2>Thank You for Being Here!</h2>
          <p className={styles.message}>
            We've poured our hearts into creating this platform and gaming experience. 
            Everyone should be able to fetch NFTs without spending a fortune. 
            We worked hard to bring you something special. Hope you like it.
          </p>
          <p className={styles.message}>
            If you're enjoying what we've built, we'd be incredibly grateful for your support. 
            Here are some ways you can help us:
          </p>
        </section>

        <section className={styles.supportOptions}>
          <div className={styles.supportCard}>
            <div className={styles.cardIcon}>🪙</div>
            <h3>Buy $HOP</h3>
            <p>
              Support the project by purchasing $HOP. Your investment helps us 
              continue development, gives $HOP an another utility and add new features to the platform.
            </p>
            <div className={styles.tokenInfo}>
              <label>Token Policy ID:</label>
              <div className={styles.addressBox}>
                <code>{hopTokenPolicyId}</code>
                <button 
                  className={styles.copyBtn}
                  onClick={() => handleCopyAddress(hopTokenPolicyId, 'HOP')}
                  title="Copy Policy ID"
                >
                  {copiedAddress === 'HOP' ? '✓' : '📋'}
                </button>
              </div>
            </div>
            <div className={styles.buttonGroup}>
              <a 
                href={`https://app.sundae.fi/exchange?given=ada.lovelace&taken=e90f72af7212f37b1af072d74d326e7d1bc15c21f8ca4180d4fd931f.484f50&routeIdent=cd9f2021bf92ed7c2f5f30412db0fb526f179cf75c08fe267f5608bf`}
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.actionButton} ${styles.primaryButton}`}
              >
                Buy on SundaeSwap
              </a>
            </div>
          </div>

          <div className={styles.supportCard}>
            <div className={styles.cardIcon}>🎯</div>
            <h3>Stake to LEAP</h3>
            <p>
              Delegate your ADA to our pool LEAP to support decentralization 
              and earn rewards while helping the Cardano ecosystem grow.
            </p>
            <div className={styles.poolInfo}>
              <p className={styles.poolDetail}>
                <strong>Pool Ticker:</strong> {leapPoolTicker}
              </p>
              <p className={styles.poolDetail}>
                <strong>Benefits:</strong> Competitive rewards & supporting innovation
              </p>
            </div>
            <div className={styles.buttonGroup}>
              <a 
                href="https://beta.cexplorer.io/pool/pool154xmvhp4jnz7phwcla09uvzqnn3ch54lh2yzrt2znxdgc4trp8x"
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.actionButton} ${styles.primaryButton}`}
              >
                Find LEAP Pool
              </a>
              <a 
                href="https://www.ledger.com/academy/cardano-staking-how-to-stake-ada"
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.actionButton} ${styles.secondaryButton}`}
              >
                Learn About Staking
              </a>
            </div>
          </div>
        </section>

        <section className={styles.collectSection}>
          <div className={styles.supportCard}>
            <div className={styles.cardIcon}>🐸</div>
            <h3>HODL Frogs for passive income!</h3>
            <p>
              Get yourself some Frogs today!. Collect unique 
              frogs and join our community of collectors!
            </p>
            <div className={styles.tokenInfo}>
              <label>Collection Policy ID:</label>
              <div className={styles.addressBox}>
                <code>{frogsPolicyId}</code>
                <button 
                  className={styles.copyBtn}
                  onClick={() => handleCopyAddress(frogsPolicyId, 'FROGS')}
                  title="Copy Policy ID"
                >
                  {copiedAddress === 'FROGS' ? '✓' : '📋'}
                </button>
              </div>
            </div>
            <div className={styles.buttonGroup}>
              <a 
                href="https://www.jpg.store/collection/frogs"
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.actionButton} ${styles.primaryButton}`}
              >
                View Frogs on JPG.store
              </a>
            </div>
          </div>
        </section>

        <section className={styles.alternativeSupport}>
          <h3>Other Ways to Support</h3>
          <div className={styles.supportGrid}>
            <div className={styles.supportItem}>
              <span className={styles.itemIcon}>💬</span>
              <h4>Share & Spread the Word</h4>
              <p>Tell your friends about our project</p>
            </div>
            <div className={styles.supportItem}>
              <span className={styles.itemIcon}>🐛</span>
              <h4>Report Bugs</h4>
              <p>Help us improve by reporting any issues you encounter</p>
            </div>
            <div className={styles.supportItem}>
              <span className={styles.itemIcon}>💡</span>
              <h4>Share Ideas</h4>
              <p>Got suggestions? We'd love to hear your feedback</p>
            </div>
            <div className={styles.supportItem}>
              <span className={styles.itemIcon}>🎮</span>
              <h4>Play & Collect</h4>
              <p>Engage with the platform and collect NFTs</p>
            </div>
          </div>
        </section>

        <section className={styles.thankYouSection}>
          <div className={styles.thankYouBox}>
            <h3>🙏 Thank You!</h3>
            <p>
              Your support means the world to us. Whether you buy $HOP, stake to LEAP, 
              collect Frogs or simply use and enjoy our platform, you're helping 
              us build something amazing on Cardano. We're grateful to have you as part of 
              our community!
            </p>
            <div className={styles.teamSignature}>
              <p>With love,</p>
              <p className={styles.teamName}>Frogs Team</p>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>Built with ❤️ on Cardano</p>
      </footer>
    </div>
  );
}
