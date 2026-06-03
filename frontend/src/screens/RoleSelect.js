// frontend/src/screens/RoleSelect.js
import React, { useState } from 'react';
import { db, auth } from '../firebase/config';
import { doc, updateDoc } from 'firebase/firestore';

export default function RoleSelect({ setScreen, adminExists, setAdminExists }) {
  const [loading, setLoading] = useState(false);

  const handleSelect = async (role) => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (user) {
        // Update user's role in database
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { role: role });
        
        if (role === 'admin') setAdminExists(true);
        setScreen(role);
      } else {
        alert("Authentication error. Please login again.");
        setScreen('auth');
      }
    } catch (error) {
      console.error("Error saving role:", error);
      alert("Something went wrong!");
    }
    setLoading(false);
  };

  return (
    <div className="content-area" style={{ textAlign: 'center', paddingTop: '50px' }}>
      <h2 style={{ color: '#111' }}>Choose Account Type</h2>
      <p style={{ color: 'gray', marginBottom: '40px' }}>How do you want to use CCERT?</p>

      <button className="btn-main" onClick={() => handleSelect('customer')} disabled={loading} style={{ marginBottom: '20px', padding: '20px' }}>
        {loading ? "Saving..." : <>🛒 Customer<br/><span style={{ fontSize:'12px', fontWeight:'normal' }}>Buy CCTV & Book Repair</span></>}
      </button>

      <button className="btn-main" onClick={() => handleSelect('job_seeker')} disabled={loading} style={{ marginBottom: '20px', background: '#333', padding: '20px' }}>
        💼 Job Seeker<br/><span style={{ fontSize:'12px', fontWeight:'normal' }}>Apply as Delivery Boy or Technician</span>
      </button>

      {!adminExists && (
        <button className="btn-main" onClick={() => handleSelect('admin')} disabled={loading} style={{ background: '#ffde59', color: '#111', marginTop: '20px' }}>
          👑 Setup Admin Profile (Owner)
        </button>
      )}
    </div>
  );
}