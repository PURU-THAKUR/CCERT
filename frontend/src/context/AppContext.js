// frontend/src/context/AppContext.js
import React, { createContext, useState, useContext } from 'react';

// Create Context
const AppContext = createContext();

// Custom Hook use karne ke liye
export const useAppContext = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [cart, setCart] = useState([]);

  // Cart functions
  const addToCart = (product) => {
    setCart((prevCart) => [...prevCart, product]);
    alert(`${product.name} added to cart!`);
  };

  const removeFromCart = (productId) => {
    setCart((prevCart) => prevCart.filter(item => item.id !== productId));
  };

  const clearCart = () => setCart([]);

  return (
    <AppContext.Provider value={{
      currentUser,
      setCurrentUser,
      cart,
      addToCart,
      removeFromCart,
      clearCart
    }}>
      {children}
    </AppContext.Provider>
  );
};