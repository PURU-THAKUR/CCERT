import React, { useState, useEffect } from 'react';
import './index.css';
import { auth, db } from './firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import SplashScreen from './screens/SplashScreen';
import AuthScreen from './screens/AuthScreen';
import CustomerHome from './screens/CustomerHome';
import SearchScreen from './screens/SearchScreen';
import DynamicProfile from './screens/DynamicProfile';
import AdminWorkspace from './screens/AdminWorkspace'; 
import PartnerDashboard from './screens/PartnerDashboard'; // NAYI FILE IMPORT

export default function App() {
  const [screen, setScreen] = useState('splash');
  const [userData, setUserData] = useState(null);
  const [activeTab, setActiveTab] = useState('home'); 
  const [cart, setCart] = useState([]); 
  
  const [viewAsCustomer, setViewAsCustomer] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const docSnap = await getDoc(doc(db, 'users', user.uid));
        if (docSnap.exists()) {
          setUserData(docSnap.data());
          setScreen('main');
        } else { setScreen('auth'); }
      } else {
        setTimeout(() => setScreen('auth'), 2000);
      }
    });
    return () => unsubscribe();
  }, []);

  const activeRole = viewAsCustomer ? 'customer' : userData?.role;

  const renderTabContent = () => {
    if (activeRole === 'admin') {
      return activeTab === 'profile' ? <DynamicProfile userData={userData} cart={cart} setCart={setCart} /> : <AdminWorkspace />;
    }
    
    // THE FIX: Agar Partner hai toh direct nayi file khulegi (Koi Blank screen nahi)
    if (activeRole === 'job_seeker' || activeRole === 'delivery' || activeRole === 'tech') {
      return <PartnerDashboard userData={userData} setViewAsCustomer={setViewAsCustomer} />;
    }
    
    switch(activeTab) {
      case 'home': return <CustomerHome userData={userData} activeRole={activeRole} cart={cart} setCart={setCart} />;
      case 'search': return <SearchScreen />;
      case 'profile': return <DynamicProfile userData={userData} activeRole={activeRole} setViewAsCustomer={setViewAsCustomer} viewAsCustomer={viewAsCustomer} cart={cart} setCart={setCart} />;
      default: return <CustomerHome userData={userData} activeRole={activeRole} cart={cart} setCart={setCart} />;
    }
  };

  return (
    <div className="app-container">
      {screen === 'splash' && <SplashScreen />}
      {screen === 'auth' && <AuthScreen setScreen={setScreen} setUserData={setUserData} />}
      
      {screen === 'main' && (
        <>
          <div style={{ flex: 1, overflowY: 'auto' }}>{renderTabContent()}</div>

          <div className="bottom-nav">
            {activeRole === 'admin' ? (
              <>
                <div className={`nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
                  <div className="nav-icon">⚙️</div><span style={{ fontSize: '11px', fontWeight: 'bold' }}>Workspace</span>
                </div>
                <div className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
                  <div className="nav-icon">👑</div><span style={{ fontSize: '11px', fontWeight: 'bold' }}>Admin Dash</span>
                </div>
              </>
            ) : activeRole === 'job_seeker' || activeRole === 'delivery' || activeRole === 'tech' ? (
              <div className="nav-item active" style={{ width: '100%' }}>
                <div className="nav-icon">💼</div><span style={{ fontSize: '13px', fontWeight: 'bold' }}>Partner Dashboard</span>
              </div>
            ) : (
              <>
                <div className={`nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
                  <div className="nav-icon">🏠</div><span style={{ fontSize: '11px', fontWeight: 'bold' }}>Store</span>
                </div>
                <div className={`nav-item ${activeTab === 'search' ? 'active' : ''}`} onClick={() => setActiveTab('search')}>
                  <div className="nav-icon">🔍</div><span style={{ fontSize: '11px', fontWeight: 'bold' }}>Search</span>
                </div>
                <div className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
                  <div className="nav-icon">👤</div><span style={{ fontSize: '11px', fontWeight: 'bold' }}>Account</span>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}