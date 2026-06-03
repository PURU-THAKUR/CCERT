import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase/config';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

export default function PartnerDashboard({ userData, setViewAsCustomer }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  // NAYA: Photo Preview State taaki double click na karna pade
  const [proofPreviews, setProofPreviews] = useState({}); 

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    fetchOrders();
    const poll = setInterval(() => fetchOrders(), 5000);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      clearInterval(poll);
    };
  }, []);

  const fetchOrders = async () => {
    try {
      const q = query(collection(db, "orders"), where("assignedPartnerId", "==", auth.currentUser.uid));
      const snap = await getDocs(q);
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.timestampMs - a.timestampMs));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // NAYA: 1 MB ERROR FIX (Image Compressor)
  const compressImage = (file, callback) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600; // Reduced size to easily fit in DB
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        callback(canvas.toDataURL('image/jpeg', 0.6)); // 60% quality
      }
    };
  };

  const handlePartnerAccept = async (orderId) => {
    await updateDoc(doc(db, "orders", orderId), { status: 'Partner On The Way' });
    alert("Job Accepted! Customer is notified."); fetchOrders();
  };

  // NAYA: Reached Customer Flow
  const handleReachedCustomer = async (orderId) => {
    await updateDoc(doc(db, "orders", orderId), { status: 'Partner Reached Location' });
    alert("Customer updated! You have reached the location."); fetchOrders();
  };

  // Select Photo and show Preview
  const handleSelectProofPhoto = (e, orderId) => {
    const file = e.target.files[0];
    if (file) {
      compressImage(file, (compressedBase64) => {
        setProofPreviews(prev => ({ ...prev, [orderId]: compressedBase64 }));
      });
    }
  };

  // Submit the selected Photo
  // Submit the selected Photo & Fetch Silent Location
  const handleSubmitProof = async (order) => {
    const base64Image = proofPreviews[order.id];
    if (!base64Image) return alert("Please select or capture a photo first!");
    
    setLoading(true);

    // NAYA: Silent & Optional Location Fetch (Localhost & Recording Friendly)
    let deliveryLocation = null;
    if (navigator.geolocation) {
      try {
        // Sirf 3 second wait karega, nahi mila ya block hua toh aage badh jayega
        const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000 }));
        deliveryLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch (err) {
        console.warn("Location skipped or denied. Proceeding without it.");
      }
    }

    const newStatus = order.paymentMode === 'COD' ? 'Pending Admin COD Verification' : 'Pending Admin Verification';
    
    try {
      await updateDoc(doc(db, "orders", order.id), { 
        status: newStatus, 
        proofImage: base64Image, 
        deliveryLocation: deliveryLocation, // Agar null hua toh bhi successfully save ho jayega
        completionTime: Date.now() 
      });
      alert(order.paymentMode === 'COD' ? "Proof Uploaded! Waiting for Admin to verify cash." : "Proof Uploaded! Sent to Admin for final verification.");
      
      // Clear preview
      const newPreviews = {...proofPreviews};
      delete newPreviews[order.id];
      setProofPreviews(newPreviews);
      
      fetchOrders();
    } catch(err) {
      alert("Error saving image. Try again.");
    }
    setLoading(false);
  };

  const safeOrders = Array.isArray(orders) ? orders : [];
  const completedOrders = safeOrders.filter(o => (o.status || '').includes('Completed'));
  const totalEarnings = completedOrders.reduce((sum, o) => sum + (Number(o.partnerCommission) || 0), 0);

  if (isOffline) {
    return (
      <div style={{display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'center', alignItems: 'center', background: '#111', color: '#fff', textAlign: 'center', padding: '20px'}}>
        <div style={{fontSize: '60px', marginBottom: '20px'}}>📶❌</div>
        <h2>No Internet Connection</h2>
        <p style={{color: 'gray', marginTop: '10px'}}>CCERT App requires an active internet connection to work.</p>
      </div>
    );
  }

  return (
    <div className="content-area">
      <div className="header-top">Partner Workspace</div>
      <button className="btn-buy" style={{ width: '100%', background: '#ffcc00', color: '#111', padding: '15px', fontSize: '15px', marginBottom: '20px', borderRadius: '10px' }} onClick={() => setViewAsCustomer(true)}>🛒 Switch to Customer Account</button>
      
      <div style={{ background: '#111', color: '#fff', padding: '20px', borderRadius: '12px', marginBottom: '25px', border: '1.5px solid #ffcc00' }}>
        <h2 style={{color: '#ffcc00'}}>{userData.name}</h2>
        <p style={{fontSize: '13px', color: 'gray', marginTop: '5px'}}>Partner ID: {userData.uid.substring(0,8).toUpperCase()}</p>
        <p style={{fontSize: '14px', marginTop: '10px'}}>Role: <span style={{fontWeight:'bold', color:'#28a745'}}>{userData.jobDetails?.type?.toUpperCase()}</span></p>
      </div>

      <div style={{ display: 'flex', gap: '15px', marginBottom: '25px' }}>
        <div style={{ flex: 1, background: '#007bff', color: '#fff', padding: '20px', borderRadius: '12px' }}>
          <div style={{fontSize:'12px', opacity:0.9}}>My Earnings</div><div style={{fontSize:'26px', fontWeight:'bold'}}>₹{totalEarnings}</div>
        </div>
        <div style={{ flex: 1, background: '#f9f9f9', color: '#111', border: '1px solid #ddd', padding: '20px', borderRadius: '12px' }}>
          <div style={{fontSize:'12px', color: 'gray'}}>Work Done</div><div style={{fontSize:'26px', fontWeight:'bold'}}>{completedOrders.length}</div>
        </div>
      </div>

      <h3 className="section-title">Active Assignments</h3>
      
      {/* 1. AUTO-ASSIGNED / PENDING ACCEPT */}
      {safeOrders.filter(o => o.status === 'Assigned (Pending Partner Acceptance)').map(o => (
        <div key={o.id} className="product-card" style={{ display: 'block', borderLeft: '4px solid red', background: '#fff0f0', marginBottom: '15px' }}>
          <h4 style={{ color: 'red', marginBottom: '5px' }}>🚨 New Job Request!</h4>
          <strong>{o.itemDetails}</strong>
          <p style={{ fontSize: '13px', color: 'gray', marginTop:'5px' }}>Deliver to: {o.customerAddress?.street}</p>
          <button className="btn-main" style={{ background: '#28a745', color: '#fff', marginTop: '15px' }} onClick={() => handlePartnerAccept(o.id)}>✅ Accept Order</button>
        </div>
      ))}

      {/* 2. ON THE WAY -> REACHED CUSTOMER BUTTON */}
      {safeOrders.filter(o => o.status === 'Partner On The Way').map(o => (
        <div key={o.id} className="product-card" style={{ display: 'block', borderLeft: '4px solid #007bff', marginBottom: '15px' }}>
          <strong>{o.itemDetails}</strong>
          {o.location ? (
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${o.location.lat},${o.location.lng}`} target="_blank" rel="noreferrer" className="btn-main" style={{background:'#28a745', color:'#fff', textDecoration:'none', display:'block', textAlign:'center', marginTop:'10px', padding:'10px'}}>📍 Navigate on Maps</a>
          ) : (
            <p style={{ fontSize: '13px', color: 'gray', marginTop:'10px' }}>📍 Address: {o.customerAddress?.street}, {o.customerAddress?.city}</p>
          )}
          <p style={{ fontSize: '13px', color: 'gray', marginTop:'5px' }}>📞 Phone: {o.customerPhone}</p>
          
          <button className="btn-main" style={{ marginTop: '20px', background: '#111', color: '#ffcc00' }} onClick={() => handleReachedCustomer(o.id)}>
            📍 I have Reached Customer Location
          </button>
        </div>
      ))}

      {/* 3. REACHED CUSTOMER -> UPLOAD PROOF UI */}
      {safeOrders.filter(o => o.status === 'Partner Reached Location').map(o => (
        <div key={o.id} className="product-card" style={{ display: 'block', borderLeft: '4px solid #ff9900', background: '#fffcf0', marginBottom: '15px' }}>
          <strong>{o.itemDetails}</strong>
          <p style={{ fontSize: '15px', color: '#111', fontWeight:'bold', marginTop:'10px' }}>{o.paymentMode === 'COD' ? `💰 Collect Cash: ₹${o.totalPaid}` : '💳 Paid Online'}</p>
          
          <div style={{ marginTop: '20px', background: '#fff', padding: '15px', borderRadius: '8px', border: '1px dashed #ccc' }}>
            <p style={{fontSize: '13px', fontWeight: 'bold', marginBottom: '10px'}}>📷 Upload Proof & Complete Task</p>
            
            {/* Show Preview if selected */}
            {proofPreviews[o.id] && <img src={proofPreviews[o.id]} alt="Preview" style={{width: '100%', maxHeight: '150px', objectFit: 'contain', marginBottom: '15px', borderRadius: '8px', border: '1px solid #ddd'}} />}
            
            <input type="file" accept="image/*" capture="environment" className="input-box" style={{padding: '5px', fontSize: '12px'}} onChange={(e) => handleSelectProofPhoto(e, o.id)} />
            
            <button className="btn-main" style={{ background: proofPreviews[o.id] ? '#28a745' : '#ccc', color: '#fff', marginTop: '10px' }} disabled={!proofPreviews[o.id] || loading} onClick={() => handleSubmitProof(o)}>
              {loading ? "Uploading..." : "✅ Submit Proof & Complete"}
            </button>
          </div>
        </div>
      ))}

      {safeOrders.filter(o => !(o.status || '').includes('Completed') && !(o.status || '').includes('Admin Verification') && !(o.status || '').includes('Cancelled')).length === 0 && (
        <p style={{color:'gray', textAlign:'center', marginTop:'30px', padding: '20px'}}>No active tasks right now.</p>
      )}

      {/* WORK DONE SECTION */}
      <h3 className="section-title" style={{marginTop: '30px'}}>Work History</h3>
      {completedOrders.length === 0 && <p style={{color:'gray', fontSize:'13px'}}>No completed work yet.</p>}
      {completedOrders.map(o => (
        <div key={o.id} style={{ background: '#f9f9f9', padding: '15px', borderRadius: '8px', marginBottom: '10px', border: '1px solid #eee' }}>
           <strong style={{fontSize:'14px'}}>{o.itemDetails}</strong><br/>
           <span style={{ fontSize: '12px', color: 'gray' }}>Delivered to: {o.customerName}</span><br/>
           <span style={{ fontSize: '12px', color: 'green', fontWeight: 'bold' }}>Earned: ₹{o.partnerCommission || 0}</span>
        </div>
      ))}
    </div>
  );
}