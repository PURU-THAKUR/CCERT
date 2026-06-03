import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs } from 'firebase/firestore';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState([]);
  
  useEffect(() => {
    const fetchProducts = async () => {
      const snap = await getDocs(collection(db, "products"));
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchProducts();
  }, []);

  const searchResults = products.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) || p.category.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="content-area">
      <div className="header-top">Search CCERT</div>
      <div className="input-group" style={{ marginTop: '20px' }}>
        <input 
          className="input-box" 
          placeholder="Search for cameras, DVR, cables..." 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      
      {query && searchResults.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          {searchResults.map(p => (
            <div key={p.id} className="product-card">
              <div className="product-image-placeholder">{p.icon || '📷'}</div>
              <div className="product-details">
                <div className="product-title">{p.name}</div>
                <div className="product-price">₹{p.price}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {query && searchResults.length === 0 && (
        <div style={{ marginTop: '40px', textAlign: 'center', color: 'gray' }}>
          <div style={{fontSize:'40px', marginBottom:'10px'}}>🚫</div>
          <h3>No such product found</h3>
          <p style={{fontSize:'13px', marginTop:'5px'}}>Try searching for "DVR" or "Dome"</p>
        </div>
      )}
    </div>
  );
}