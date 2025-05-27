import { createContext, useContext, useState, useEffect } from 'react';

// Create the auth context
const AuthContext = createContext();

// Auth provider component
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for existing user session on component mount
  useEffect(() => {
    const checkUserSession = async () => {
      try {
        // Try to get user data from local storage first
        const storedUser = localStorage.getItem('user');
        
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        } else {
          // Alternatively, you could fetch from an API endpoint
          // const response = await fetch('/api/auth/me');
          // const data = await response.json();
          // if (data.success) setUser(data.user);
        }
      } catch (error) {
        console.error('Error checking user session:', error);
      } finally {
        setLoading(false);
      }
    };

    checkUserSession();
  }, []);

  // Update user data
  const updateUser = (userData) => {
    setUser(userData);
    // Store in localStorage for persistence
    if (userData) {
      localStorage.setItem('user', JSON.stringify(userData));
    }
  };

  // Login function
  const login = async (password) => {
    setLoading(true);
    try {
      // This would be replaced with your actual API call
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Login failed');
      }

      updateUser(data.user);
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false,
        message: error.message || 'Failed to login'
      };
    } finally {
      setLoading(false);
    }
  };

  // Register function
  const register = async (userData) => {
    setLoading(true);
    try {
      // This would be replaced with your actual API call
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Registration failed');
      }

      updateUser(data.user);
      return { success: true };
    } catch (error) {
      console.error('Registration error:', error);
      return { 
        success: false,
        message: error.message || 'Failed to register'
      };
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      // This would be replaced with your actual API call if needed
      // await fetch('/api/auth/logout', { method: 'POST' });
      
      // Clear user from state and storage
      setUser(null);
      localStorage.removeItem('user');
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { 
        success: false,
        message: error.message || 'Failed to logout'
      };
    }
  };

  // Construct the value object that will be provided to consumers
  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 