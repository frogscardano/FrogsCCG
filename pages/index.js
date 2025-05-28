import Head from 'next/head';

export default function Home() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <Head>
        <title>Frogs CCG - Deployment Test</title>
      </Head>
      
      <h1>🐸 Frogs CCG</h1>
      <h2>Deployment Successful!</h2>
      
      <div style={{ 
        backgroundColor: '#e8f5e8', 
        padding: '20px', 
        margin: '20px 0',
        borderRadius: '8px',
        border: '2px solid #4caf50'
      }}>
        <h3>✅ App is Working!</h3>
        <p>If you can see this page, the deployment is successful!</p>
        <p>Timestamp: {new Date().toISOString()}</p>
      </div>
      
      <div style={{ margin: '20px 0' }}>
        <h3>Test API Endpoints:</h3>
        <ul>
          <li><a href="/api/simple-test" target="_blank">Simple Test API</a></li>
          <li><a href="/api" target="_blank">Basic API</a></li>
          <li><a href="/api/health" target="_blank">Health Check</a></li>
          <li><a href="/api/openPack?collectionType=frogs" target="_blank">Open Pack API</a></li>
        </ul>
      </div>
      
      <div style={{ margin: '20px 0' }}>
        <h3>Test Pages:</h3>
        <ul>
          <li><a href="/minimal">Minimal Test Page</a></li>
          <li><a href="/simple">Simple Test Page</a></li>
          <li><a href="/test">API Test Page</a></li>
        </ul>
      </div>
      
      <div style={{ 
        backgroundColor: '#fff3cd', 
        padding: '15px', 
        margin: '20px 0',
        borderRadius: '5px',
        border: '1px solid #ffeaa7'
      }}>
        <h4>🔧 Deployment Status</h4>
        <p>✅ Next.js is working</p>
        <p>✅ React rendering is working</p>
        <p>✅ Static pages are working</p>
        <p>🔄 API endpoints need testing (click links above)</p>
      </div>
      
      <p><strong>Next Step:</strong> Test the API endpoints above. If they work, we can restore the full app!</p>
    </div>
  );
}
