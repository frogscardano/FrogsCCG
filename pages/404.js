import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Custom404() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to home page after 3 seconds
    const redirectTimer = setTimeout(() => {
      router.push('/');
    }, 3000);

    return () => clearTimeout(redirectTimer);
  }, [router]);

  return (
    <div className="error-container">
      <h1>404 - Page Not Found</h1>
      <p>The page you're looking for doesn't exist or has been moved.</p>
      <p>You'll be redirected to the home page in 3 seconds...</p>
      <button onClick={() => router.push('/')}>
        Go to Home Page Now
      </button>

      <style jsx>{`
        .error-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          text-align: center;
          padding: 0 20px;
        }
        h1 {
          color: #22c55e;
          margin-bottom: 20px;
        }
        p {
          margin-bottom: 15px;
          color: #4b5563;
        }
        button {
          padding: 10px 20px;
          background-color: #22c55e;
          color: white;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-size: 16px;
          transition: background-color 0.3s;
        }
        button:hover {
          background-color: #16a34a;
        }
      `}</style>
    </div>
  );
} 