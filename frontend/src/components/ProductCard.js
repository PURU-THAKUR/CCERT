// frontend/src/components/ProductCard.js
import React from 'react';
import { useAppContext } from '../context/AppContext';

export default function ProductCard({ id, name, price, type }) {
  const { addToCart } = useAppContext();

  return (
    <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <h4 style={{ color: '#111', fontSize: '16px' }}>{name}</h4>
        {type && <p style={{ fontSize: '12px', color: 'gray', marginTop: '2px' }}>{type}</p>}
        <p style={{ color: '#ff9900', fontWeight: 'bold', marginTop: '5px' }}>₹{price}</p>
      </div>
      
      <button 
        onClick={() => addToCart({ id, name, price })}
        style={{ 
          background: '#111', 
          color: '#ffde59', 
          padding: '8px 15px', 
          borderRadius: '5px', 
          border: 'none', 
          fontWeight: 'bold',
          cursor: 'pointer'
        }}
      >
        Add
      </button>
    </div>
  );
}