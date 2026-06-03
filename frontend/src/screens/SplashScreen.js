import React from 'react';
import logo from '../assets/CCERT.png';

export default function SplashScreen() {
  return (
    <div className="splash">
      <img 
        src={logo} 
        alt="CCERT Logo" 
        style={{ 
          width: '180px', 
          height: '180px', 
          borderRadius: '25px', /* Thoda rounded corners premium look ke liye */
          objectFit: 'cover', 
          boxShadow: '0 15px 35px rgba(0,0,0,0.2)', /* 3D shadow effect */
          border: '4px solid rgba(255, 255, 255, 0.8)' /* Halki white border highlight ke liye */
        }} 
      />
    </div>
  );
}