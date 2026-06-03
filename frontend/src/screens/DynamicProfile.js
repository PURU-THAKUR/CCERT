import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase/config';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, serverTimestamp, getDoc, deleteDoc, setDoc } from 'firebase/firestore';

export default function DynamicProfile({ userData, activeRole, viewAsCustomer, setViewAsCustomer, cart, setCart }) {
  const [orders, setOrders] = useState([]);
  const [partners, setPartners] = useState([]); 
  const [tickets, setTickets] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [profileView, setProfileView] = useState('menu'); 
  const [openAccordion, setOpenAccordion] = useState('');
  
  const [adminViewPartner, setAdminViewPartner] = useState(null); 
  const [checkoutMode, setCheckoutMode] = useState('');
  const [editData, setEditData] = useState({ name: userData?.name, phone: userData?.phone, address: userData?.address?.street });
  
  // FIX: Single Clean Review Modal State
  const [reviewModal, setReviewModal] = useState({ isOpen: false, item: null, rating: 5, comment: '', photo: '' });

  const [currentTime, setCurrentTime] = useState(Date.now());
  const [helpInfo, setHelpInfo] = useState({ phone: '', email: '' });
  const [adminHelpEdit, setAdminHelpEdit] = useState({ phone: '', email: '' });
  const [supportTicket, setSupportTicket] = useState({ issueType: '', message: '' });
  
  const [adminActiveChat, setAdminActiveChat] = useState(null);
  const [customerActiveChat, setCustomerActiveChat] = useState(null);
  const [chatInput, setChatInput] = useState('');
  
  const chatEndRef = useRef(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  useEffect(() => {
    if (userData) fetchOrdersAndTickets();
    const poll = setInterval(() => { if (userData) fetchOrdersAndTickets(); }, 3000);
    return () => clearInterval(poll);
  }, [userData, activeRole]);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [adminActiveChat?.chat, customerActiveChat?.chat]);

  const fetchOrdersAndTickets = async () => {
    try {
      let q = query(collection(db, "orders")); 
      if (activeRole === 'customer') {
        q = query(collection(db, "orders"), where("userId", "==", auth.currentUser.uid));
      }
      const snap = await getDocs(q);
      const fetchedOrders = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.timestampMs - a.timestampMs);

      const updatedOrders = fetchedOrders.map(o => {
        if (o.paymentMode === 'Online' && o.status === 'Awaiting Admin Approval') {
           if (Date.now() - o.timestampMs > 600000) { 
              updateDoc(doc(db, "orders", o.id), { status: 'Cancelled (Timeout) - Refund in 48-72 hrs' });
              return { ...o, status: 'Cancelled (Timeout) - Refund in 48-72 hrs' };
           }
        }
        return o;
      });
      setOrders(updatedOrders);

      let tq = query(collection(db, "supportTickets")); 
      if (activeRole === 'customer') {
        tq = query(collection(db, "supportTickets"), where("userId", "==", auth.currentUser.uid));
      }
      const tSnap = await getDocs(tq);
      const fetchedTickets = tSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.timestampMs - a.timestampMs);
      setTickets(fetchedTickets);

      setAdminActiveChat(prev => prev ? (fetchedTickets.find(t => t.id === prev.id) || prev) : null);
      
      setCustomerActiveChat(prev => {
        if (!prev) return null;
        const freshTicket = fetchedTickets.find(t => t.id === prev.id);
        if (freshTicket && freshTicket.status === 'Resolved') {
           alert("Admin has resolved your query and closed the chat.");
           setProfileView('menu');
           return null;
        }
        return freshTicket ? { ...freshTicket } : prev;
      });

      if (userData?.role === 'admin') {
        const pSnap = await getDocs(query(collection(db, "users"), where("role", "==", "job_seeker")));
        setPartners(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
      
      const qrSnap = await getDoc(doc(db, "settings", "payments"));
      if(qrSnap.exists()) {
        const data = qrSnap.data();
        setHelpInfo({ phone: data.helpPhone || 'Not Provided', email: data.helpEmail || 'Not Provided' });
        setAdminHelpEdit(prev => prev.phone === '' && prev.email === '' ? { phone: data.helpPhone || '', email: data.helpEmail || '' } : prev);
      }
      setLoading(false);
    } catch (e) { console.error("Error fetching data:", e); setLoading(false); }
  };

  // ================= ADMIN ACTIONS =================
  const handleAdminApproveOnline = async (orderId) => {
    await updateDoc(doc(db, "orders", orderId), { status: 'Pending Admin Assignment' });
    alert("Online Payment Approved!"); fetchOrdersAndTickets();
  };

  const handleAdminAssign = async (orderId, partnerId) => {
    if (!partnerId) return alert("Select a partner first!");
    const selectedPartner = partners.find(p => p.id === partnerId);
    
    await updateDoc(doc(db, "orders", orderId), { 
      status: 'Partner On The Way',
      assignedPartnerId: partnerId,
      partnerName: selectedPartner?.name || 'Unknown',
      partnerPhone: selectedPartner?.phone || 'Unknown'
    });
    alert("Task Auto-Accepted & Sent to Partner!"); fetchOrdersAndTickets();
  };
  
  const handleAdminVerifyCompletion = async (orderId) => {
    await updateDoc(doc(db, "orders", orderId), { status: 'Delivered / Completed', completionTime: Date.now() });
    alert("Proof Verified! Order Closed & Earnings Added."); fetchOrdersAndTickets();
  };

  const saveHelpSettings = async () => {
    setLoading(true);
    await setDoc(doc(db, "settings", "payments"), { helpPhone: adminHelpEdit.phone, helpEmail: adminHelpEdit.email }, { merge: true });
    setHelpInfo(adminHelpEdit);
    alert("Help Contact Updated Everywhere!");
    setOpenAccordion('');
    setLoading(false);
  };

  // ================= CUSTOMER ACTIONS =================
  const saveCustomerProfile = async () => {
    await updateDoc(doc(db, "users", auth.currentUser.uid), { name: editData.name, phone: editData.phone, "address.street": editData.address });
    alert("Profile Updated!"); setProfileView('menu');
  };

  const cancelOrder = async (orderId) => {
    if(window.confirm("Cancel this order?")) {
      await updateDoc(doc(db, "orders", orderId), { status: 'Cancelled by Customer' });
      alert("Order Cancelled!"); fetchOrdersAndTickets();
    }
  };
  
  const handleCartCheckout = async () => {
    if (!checkoutMode) return alert("Select payment mode.");
    if (cart.length === 0) return alert("Cart is empty!");
    setLoading(true);
    try {
      let userLocation = null;
      if (navigator.geolocation) {
        alert("For secure delivery, please ALLOW Location Access on the next prompt.");
        try {
          const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000 }));
          userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        } catch (err) { 
          setLoading(false);
          return alert("🚨 Live Location is REQUIRED to place an order! Please enable GPS."); 
        }
      } else {
        return alert("Geolocation is not supported by your device.");
      }

      const totalAmount = cart.reduce((sum, item) => sum + Number(item.price), 0);
      const itemNames = cart.map(i => i.name).join(", ");
      await addDoc(collection(db, "orders"), {
        userId: auth.currentUser.uid, customerName: userData.name, customerPhone: userData.phone, customerAddress: userData.address,
        type: 'Cart Purchase', itemDetails: itemNames, totalPaid: totalAmount, paymentMode: checkoutMode,
        status: checkoutMode === 'Online' ? 'Awaiting Admin Approval' : 'Pending Admin Assignment',
        location: userLocation, createdAt: serverTimestamp(), timestampMs: Date.now()
      });
      alert("Cart Checked Out Successfully!");
      setCart([]); setCheckoutMode(''); setProfileView('history'); fetchOrdersAndTickets();
    } catch (e) { alert("Checkout failed!"); }
    setLoading(false);
  };

  const compressImage = (file, callback) => {
    const reader = new FileReader(); reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image(); img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 500; const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH; canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        callback(canvas.toDataURL('image/jpeg', 0.6));
      }
    };
  };

  const handleReviewPhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      compressImage(file, (base64) => {
        setReviewModal({...reviewModal, photo: base64});
      });
    }
  };

  // FIX: Streamlined Submit Review (Only for Products now)
  const submitReview = async () => {
    if(!reviewModal.comment) return alert("Write a comment.");
    await addDoc(collection(db, "reviews"), { 
      productName: reviewModal.item.itemDetails, 
      customerName: userData.name, 
      rating: reviewModal.rating, 
      comment: reviewModal.comment, 
      photoBase64: reviewModal.photo, 
      timestampMs: Date.now() 
    });
    alert("Review Submitted Publicly!");
    setReviewModal({ isOpen: false, item: null, rating: 5, comment: '', photo: '' });
  };

  // ================= TICKET CHAT SYSTEM =================
  const submitSupportTicket = async () => {
    if (!supportTicket.issueType || !supportTicket.message) return alert("Please select a problem and explain it.");
    const newChatMsg = { sender: 'Customer', text: supportTicket.message, timestampMs: Date.now() };
    await addDoc(collection(db, "supportTickets"), {
      userId: auth.currentUser.uid, customerName: userData.name, phone: userData.phone,
      issueType: supportTicket.issueType, status: 'Open', timestampMs: Date.now(),
      chat: [newChatMsg]
    });
    alert("Ticket generated! Admin will reply here.");
    setSupportTicket({ issueType: '', message: '' });
    fetchOrdersAndTickets();
  };

  const handleSendChatMessage = async (activeChat) => {
    if(!chatInput.trim() || !activeChat) return;
    const senderName = userData?.role === 'admin' ? 'Admin' : 'Customer';
    const newMsg = { sender: senderName, text: chatInput, timestampMs: Date.now() };
    const updatedChat = [...(activeChat.chat || []), newMsg];
    await updateDoc(doc(db, "supportTickets", activeChat.id), { chat: updatedChat, status: 'Open' });
    setChatInput(''); fetchOrdersAndTickets();
  };

  const markTicketResolved = async (activeChat, isCustomer) => {
    await updateDoc(doc(db, "supportTickets", activeChat.id), { status: 'Resolved' });
    alert("Ticket Marked as Resolved!");
    if (isCustomer) { setCustomerActiveChat(null); setProfileView('menu'); } 
    else { setAdminActiveChat(null); }
    fetchOrdersAndTickets();
  };

  const handleDeleteTicket = async (ticketId, isCustomer) => {
    if(window.confirm("Are you sure you want to permanently delete this chat/ticket?")) {
      await deleteDoc(doc(db, "supportTickets", ticketId));
      alert("Chat History Deleted!");
      if (isCustomer) { setCustomerActiveChat(null); setProfileView('menu'); } 
      else { setAdminActiveChat(null); }
      fetchOrdersAndTickets();
    }
  };

  // ================= OFFLINE BLOCKER =================
  if (isOffline) {
    return (
      <div style={{display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'center', alignItems: 'center', background: '#111', color: '#fff', textAlign: 'center', padding: '20px'}}>
        <div style={{fontSize: '60px', marginBottom: '20px'}}>📶❌</div>
        <h2>No Internet Connection</h2>
        <p style={{color: 'gray', marginTop: '10px'}}>CCERT App requires an active internet connection to work.</p>
      </div>
    );
  }

  // ================= 1. RENDER ADMIN =================
  if (userData?.role === 'admin') {
    
    if (adminActiveChat) {
      return (
        <div className="content-area" style={{ display: 'flex', flexDirection: 'column', height: '90vh', background: '#fff', padding: '15px', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '15px', marginBottom: '10px'}}>
            <button className="btn-buy" style={{ background: '#eee', color: '#111', margin: 0, padding: '8px 15px' }} onClick={() => setAdminActiveChat(null)}>← Back</button>
            <h3 style={{margin: 0, fontSize: '16px'}}>Ticket: {adminActiveChat.issueType}</h3>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', background: '#f5f5f5', padding: '15px', borderRadius: '10px', marginBottom: '15px', border: '1px solid #ddd' }}>
            {(adminActiveChat.chat || []).map((msg, i) => (
               <div key={i} style={{textAlign: msg.sender === 'Admin' ? 'right' : 'left', marginBottom: '15px'}}>
                 <span style={{fontSize: '11px', color: 'gray', display: 'block', marginBottom: '3px'}}>{msg.sender}</span>
                 <div style={{display:'inline-block', background: msg.sender === 'Admin' ? '#007bff' : '#111', color: '#fff', padding: '12px 15px', borderRadius: '12px', maxWidth: '80%', textAlign: 'left', wordWrap: 'break-word'}}>
                   {msg.text}
                 </div>
               </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          
          <div style={{display: 'flex', gap: '10px'}}>
            <input className="input-box" style={{marginBottom: 0, flex: 1}} placeholder="Type your reply..." value={chatInput} onChange={e => setChatInput(e.target.value)} />
            <button className="btn-main" style={{background: '#111', color: '#ffcc00', padding: '0 20px', width: 'auto'}} onClick={() => handleSendChatMessage(adminActiveChat)}>Send</button>
          </div>
          
          <div style={{display: 'flex', gap: '10px', marginTop: '15px'}}>
            <button className="btn-main" style={{background: '#28a745', flex: 2}} onClick={() => markTicketResolved(adminActiveChat, false)}>✅ Mark Resolved & Close</button>
            <button className="btn-main" style={{background: '#dc3545', flex: 1}} onClick={() => handleDeleteTicket(adminActiveChat.id, false)}>🗑️ Delete Chat</button>
          </div>
        </div>
      );
    }

    if (adminViewPartner) {
      const pOrders = orders.filter(o => o.assignedPartnerId === adminViewPartner.id && (o.status || '').includes('Completed'));
      const pEarnings = pOrders.reduce((sum, o) => sum + (Number(o.partnerCommission) || 0), 0);
      return (
        <div className="content-area">
          <button className="btn-buy" style={{ marginBottom: '20px', background: '#eee', color: '#111' }} onClick={() => setAdminViewPartner(null)}>← Back to Dashboard</button>
          <div style={{ background: '#111', color: '#ffcc00', padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
            <h2>{adminViewPartner.name}</h2>
            <p style={{ color: '#fff', marginTop: '5px' }}>{adminViewPartner.jobDetails?.type.toUpperCase()}</p>
            <p style={{ color: 'gray', fontSize: '13px', marginTop: '5px' }}>Phone: {adminViewPartner.phone}</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <div style={{ flex: 1, background: '#fff', border: '1px solid #ddd', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: 'gray' }}>Total Earnings</div><div style={{ fontSize: '20px', fontWeight: 'bold', color: 'green' }}>₹{pEarnings}</div>
            </div>
            <div style={{ flex: 1, background: '#fff', border: '1px solid #ddd', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: 'gray' }}>Tasks Done</div><div style={{ fontSize: '20px', fontWeight: 'bold', color: '#111' }}>{pOrders.length}</div>
            </div>
          </div>
          <h3 className="section-title">Completed Work History</h3>
          {pOrders.length === 0 ? <p style={{ color: 'gray' }}>No completed tasks yet.</p> : pOrders.map(o => (
             <div key={o.id} style={{ background: '#fff', padding: '15px', borderRadius: '8px', marginBottom: '10px', border: '1px solid #eee' }}>
               <strong>{o.itemDetails}</strong><br/>
               <span style={{ fontSize: '12px', color: 'gray' }}>Delivered to: {o.customerName}</span><br/>
               <span style={{ fontSize: '13px', color: '#ff9900', fontWeight: 'bold' }}>Commission Earned: ₹{o.partnerCommission || 0}</span>
             </div>
          ))}
        </div>
      );
    }

    const allCompletedForAdmin = orders.filter(o => (o.status || '').includes('Completed'));
    const monthlyRevenue = allCompletedForAdmin.reduce((sum, o) => sum + (Number(o.totalPaid) || 0), 0);
    const monthlyExpense = allCompletedForAdmin.reduce((sum, o) => sum + (Number(o.partnerCommission) || 0), 0);

    return (
      <div className="content-area">
        <div className="header-top">Admin Dashboard</div>
        
        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
          <div style={{ flex: 1, background: '#111', color: '#ffcc00', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
            <div style={{fontSize:'12px', opacity: 0.8}}>Total Revenue</div><div style={{fontSize:'26px', fontWeight:'bold'}}>₹{monthlyRevenue}</div>
          </div>
          <div style={{ flex: 1, background: '#ffebee', color: '#d32f2f', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
            <div style={{fontSize:'12px', opacity: 0.8}}>Total Expense</div><div style={{fontSize:'26px', fontWeight:'bold'}}>₹{monthlyExpense}</div>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: '10px', marginBottom: '15px' }}>
          <div style={{ padding: '15px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }} onClick={() => setOpenAccordion(openAccordion === 'helpAdmin' ? '' : 'helpAdmin')}>
            <span>⚙️ Update Help & Support Info</span><span>{openAccordion === 'helpAdmin' ? '▲' : '▼'}</span>
          </div>
          {openAccordion === 'helpAdmin' && (
            <div style={{ padding: '15px', borderTop: '1px solid #eee', background: '#fafafa' }}>
               <p style={{fontSize:'12px', color:'gray', marginBottom:'10px'}}>Customers will see this contact info when they need help.</p>
               <input className="input-box" placeholder="Support Mobile No." value={adminHelpEdit.phone} onChange={e => setAdminHelpEdit({...adminHelpEdit, phone: e.target.value})} />
               <input className="input-box" placeholder="Support Email" value={adminHelpEdit.email} onChange={e => setAdminHelpEdit({...adminHelpEdit, email: e.target.value})} />
               <button className="btn-main" onClick={saveHelpSettings} disabled={loading}>{loading ? 'Saving...' : 'Save & Update Everywhere'}</button>
            </div>
          )}
        </div>

        <div style={{ background: '#fff', border: '1.5px solid #ff4d4d', borderRadius: '10px', marginBottom: '15px' }}>
          <div style={{ padding: '15px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', color: '#d32f2f' }} onClick={() => setOpenAccordion(openAccordion === 'tickets' ? '' : 'tickets')}>
            <span>🆘 Customer Support Tickets ({tickets.filter(t => t.status === 'Open').length})</span><span>{openAccordion === 'tickets' ? '▲' : '▼'}</span>
          </div>
          {openAccordion === 'tickets' && (
            <div style={{ padding: '15px', borderTop: '1px solid #eee', background: '#fafafa' }}>
              {tickets.length === 0 ? <p style={{color:'gray', fontSize:'13px'}}>No support tickets.</p> : tickets.map(t => (
                 <div key={t.id} style={{ background: '#fff', padding: '15px', borderRadius: '8px', marginBottom: '10px', borderLeft: t.status === 'Resolved' ? '4px solid #28a745' : '4px solid #ff4d4d' }}>
                   <div style={{display:'flex', justifyContent:'space-between'}}>
                     <strong style={{fontSize:'15px'}}>{t.customerName}</strong>
                     <span style={{fontSize:'12px', color: t.status === 'Resolved' ? 'green' : 'red', fontWeight:'bold'}}>{t.status || 'Open'}</span>
                   </div>
                   <p style={{fontSize:'13px', color:'#111', marginTop:'5px', fontWeight:'bold'}}>{t.issueType}</p>
                   
                   <div style={{marginTop:'15px', display:'flex', gap:'10px'}}>
                     <a href={`tel:${t.phone}`} className="btn-main" style={{textDecoration:'none', background:'#28a745', color:'#fff', padding:'10px', textAlign:'center', flex: 1}}>📞 Call</a>
                     <button className="btn-main" style={{background:'#111', color:'#ffcc00', padding:'10px', flex: 1.5}} onClick={() => { setChatInput(''); setAdminActiveChat(t); }}>💬 Open Chat</button>
                     <button className="btn-main" style={{background:'#dc3545', color:'#fff', padding:'10px', flex: 0.5}} onClick={() => handleDeleteTicket(t.id, false)}>🗑️</button>
                   </div>
                 </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: '10px', marginBottom: '15px' }}>
          <div style={{ padding: '15px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }} onClick={() => setOpenAccordion(openAccordion === 'online' ? '' : 'online')}>
            <span>💳 Online Payment Approvals</span><span>{openAccordion === 'online' ? '▲' : '▼'}</span>
          </div>
          {openAccordion === 'online' && (
            <div style={{ padding: '15px', borderTop: '1px solid #eee', background: '#fafafa' }}>
              {orders.filter(o => o.status === 'Awaiting Admin Approval').map(o => {
                 const timeLeft = Math.max(0, Math.floor((600000 - (currentTime - o.timestampMs)) / 1000));
                 return (
                   <div key={o.id} style={{ background: '#fff', padding: '15px', borderRadius: '8px', borderLeft: '4px solid #007bff', marginBottom:'10px' }}>
                     <strong>{o.itemDetails}</strong> (₹{o.totalPaid})<br/>
                     <span style={{fontSize:'12px', color:'red', fontWeight:'bold'}}>Time to approve: {Math.floor(timeLeft/60)}:{timeLeft%60 < 10 ? '0':''}{timeLeft%60}</span>
                     <button className="btn-buy" style={{marginTop:'10px', background:'#007bff', color:'#fff', display:'block'}} onClick={() => handleAdminApproveOnline(o.id)}>Approve Payment</button>
                   </div>
                 )
              })}
              {orders.filter(o => o.status === 'Awaiting Admin Approval').length === 0 && <p style={{color:'gray', fontSize:'13px'}}>No pending online payments.</p>}
            </div>
          )}
        </div>

        <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: '10px', marginBottom: '15px' }}>
          <div style={{ padding: '15px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }} onClick={() => setOpenAccordion(openAccordion === 'partners' ? '' : 'partners')}>
            <span>💼 Delivery & Tech Profiles</span><span>{openAccordion === 'partners' ? '▲' : '▼'}</span>
          </div>
          {openAccordion === 'partners' && (
            <div style={{ padding: '15px', borderTop: '1px solid #eee', background: '#fafafa' }}>
              {partners.length === 0 ? <p style={{color:'gray'}}>No partners registered.</p> : partners.map(p => (
                <div key={p.id} style={{ background: '#fff', padding: '15px', borderRadius: '8px', marginBottom: '10px', border: '1px solid #ddd' }}>
                  <strong style={{fontSize:'16px'}}>{p.name}</strong> <span style={{fontSize:'12px', background:'#ffcc00', padding:'2px 8px', borderRadius:'10px'}}>{p.jobDetails?.type}</span>
                  <button className="btn-main" style={{ marginTop: '10px', padding: '10px', fontSize: '13px' }} onClick={() => setAdminViewPartner(p)}>Click here to check Full Profile & Earnings →</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: '10px', marginBottom: '15px' }}>
          <div style={{ padding: '15px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }} onClick={() => setOpenAccordion(openAccordion === 'assign' ? '' : 'assign')}>
            <span>📦 New Orders (Assign Task)</span><span>{openAccordion === 'assign' ? '▲' : '▼'}</span>
          </div>
          {openAccordion === 'assign' && (
            <div style={{ padding: '15px', borderTop: '1px solid #eee', background: '#fafafa' }}>
              {orders.filter(o => o.status === 'Pending Admin Assignment').map(o => (
                 <div key={o.id} style={{ background: '#fff', padding: '15px', borderRadius: '8px', marginBottom: '10px', borderLeft: '4px solid #ff9900' }}>
                   <strong>{o.itemDetails}</strong> (₹{o.totalPaid})<br/><span style={{fontSize:'12px', color:'gray'}}>Customer: {o.customerName}</span>
                   <div style={{ marginTop: '15px', display: 'flex', gap: '10px', flexDirection: 'column' }}>
                     <select className="select-box" id={`partner-${o.id}`} style={{marginBottom: 0}}>
                       <option value="">Select Delivery/Tech Partner</option>
                       {partners.map(p => <option key={p.id} value={p.id}>{p.name} ({p.jobDetails?.type})</option>)}
                     </select>
                     <button className="btn-buy" style={{background:'#111', color:'#ffcc00', padding: '12px'}} onClick={() => handleAdminAssign(o.id, document.getElementById(`partner-${o.id}`).value)}>Assign Task</button>
                   </div>
                 </div>
              ))}
              {orders.filter(o => o.status === 'Pending Admin Assignment').length === 0 && <p style={{color:'gray'}}>No new orders to assign.</p>}
            </div>
          )}
        </div>

        <div style={{ background: '#fff', border: '1.5px solid #eee', borderRadius: '10px', marginBottom: '15px' }}>
          <div style={{ padding: '15px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }} onClick={() => setOpenAccordion(openAccordion === 'verify' ? '' : 'verify')}>
            <span>✅ Verify Proof & Close Order</span><span>{openAccordion === 'verify' ? '▲' : '▼'}</span>
          </div>
          {openAccordion === 'verify' && (
            <div style={{ padding: '15px', borderTop: '1px solid #eee', background: '#fafafa' }}>
              {orders.filter(o => (o.status || '').includes('Pending Admin Verification') || (o.status || '').includes('Pending Admin COD Verification')).map(o => (
                <div key={o.id} style={{ background: '#fff', padding: '15px', borderRadius: '8px', marginBottom: '10px', borderLeft: '4px solid #28a745' }}>
                  <strong>{o.itemDetails}</strong>
                  <p style={{fontSize:'12px', color:'gray', marginTop:'5px'}}>Customer: {o.customerName} | Paid via: {o.paymentMode}</p>
                  {o.proofImage && <img src={o.proofImage} alt="Proof" style={{width:'100%', maxHeight:'200px', objectFit:'contain', marginTop:'10px', borderRadius:'8px', border:'1px solid #eee'}} />}
                  <button className="btn-main" style={{background:'#28a745', color:'#fff', marginTop:'15px'}} onClick={() => handleAdminVerifyCompletion(o.id)}>Verify Proof & Mark Delivered</button>
                </div>
              ))}
              {orders.filter(o => (o.status || '').includes('Pending Admin Verification') || (o.status || '').includes('Pending Admin COD Verification')).length === 0 && <p style={{color:'gray', fontSize:'13px'}}>No proofs pending for verification.</p>}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ================= 2. RENDER PARTNER (Delivery Boy & Tech) =================
  if (activeRole === 'job_seeker' || activeRole === 'tech' || activeRole === 'delivery') {
    return <div className="content-area"><p>Partner View Managed in PartnerDashboard.js</p></div>;
  }

  // ================= 3. RENDER CUSTOMER =================
  
  if (profileView === 'chat' && customerActiveChat) {
    return (
      <div className="content-area" style={{ display: 'flex', flexDirection: 'column', height: '90vh', background: '#fff', padding: '15px', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '15px', marginBottom: '10px'}}>
          <button className="btn-buy" style={{ background: '#eee', color: '#111', margin: 0, padding: '8px 15px' }} onClick={() => {setProfileView('menu'); setCustomerActiveChat(null);}}>← Back</button>
          <h3 style={{margin: 0, fontSize: '16px'}}>Ticket: {customerActiveChat.issueType}</h3>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', background: '#f5f5f5', padding: '15px', borderRadius: '10px', marginBottom: '15px', border: '1px solid #ddd' }}>
          {(customerActiveChat.chat || []).map((msg, i) => (
             <div key={i} style={{textAlign: msg.sender === 'Customer' ? 'right' : 'left', marginBottom: '15px'}}>
               <span style={{fontSize: '11px', color: 'gray', display: 'block', marginBottom: '3px'}}>{msg.sender}</span>
               <div style={{display:'inline-block', background: msg.sender === 'Customer' ? '#111' : '#007bff', color: '#fff', padding: '12px 15px', borderRadius: '12px', maxWidth: '80%', textAlign: 'left', wordWrap: 'break-word'}}>
                 {msg.text}
               </div>
             </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        
        <div style={{display: 'flex', gap: '10px'}}>
          <input className="input-box" style={{marginBottom: 0, flex: 1}} placeholder="Type your message..." value={chatInput} onChange={e => setChatInput(e.target.value)} />
          <button className="btn-main" style={{background: '#111', color: '#ffcc00', padding: '0 20px', width: 'auto'}} onClick={() => handleSendChatMessage(customerActiveChat)}>Send</button>
        </div>

        <button className="btn-main" style={{background: '#dc3545', marginTop: '15px'}} onClick={() => handleDeleteTicket(customerActiveChat.id, true)}>🗑️ Delete Chat History</button>
      </div>
    );
  }

  return (
    <div className="content-area">
      <div className="header-top">My Account</div>
      
      {profileView === 'menu' && (
        <div style={{marginTop: '20px'}}>
          
          {userData?.role !== 'customer' && userData?.role !== 'admin' && (
            <button className="btn-buy" style={{ width: '100%', background: '#111', color: '#fff', padding: '15px', fontSize: '15px', marginBottom: '25px', borderRadius: '10px' }} onClick={() => setViewAsCustomer(false)}>
              💼 Switch Back to Partner Dashboard
            </button>
          )}

          {openAccordion === 'help' ? (
            <div style={{background:'#fff', padding:'20px', borderRadius:'12px', border:'1.5px solid #ffcc00', marginBottom:'25px'}}>
               <h3 style={{marginBottom:'15px', color:'#111'}}>Help & Support / FAQ</h3>
               <div style={{marginBottom:'15px'}}><strong style={{fontSize:'14px', color:'#111'}}>⚠️ Online Payment Problem</strong><p style={{fontSize:'12px', color:'gray', marginTop:'3px'}}>If money was deducted but order cancelled (10-min timeout), refund reflects in 48-72 hrs.</p></div>
               <div style={{marginBottom:'15px'}}><strong style={{fontSize:'14px', color:'#111'}}>📦 Order Delay Problem</strong><p style={{fontSize:'12px', color:'gray', marginTop:'3px'}}>If your order is stuck on "Pending Assignment", our Admin is actively searching for a partner.</p></div>
               <div style={{marginBottom:'15px'}}><strong style={{fontSize:'14px', color:'#111'}}>❌ Cancellation Problem</strong><p style={{fontSize:'12px', color:'gray', marginTop:'3px'}}>Cancel order from history tab before partner assignment for instant refund.</p></div>

               <div style={{borderTop:'1px dashed #ccc', paddingTop:'15px', marginTop:'15px'}}>
                 <h4 style={{marginBottom:'10px', fontSize:'14px', color:'#111'}}>Submit a Query to Admin</h4>
                 <select className="select-box" style={{marginBottom:'10px'}} value={supportTicket.issueType} onChange={e => setSupportTicket({...supportTicket, issueType: e.target.value})}>
                   <option value="" disabled>Select Problem</option>
                   <option value="Online Payment Issue">Online Payment Issue</option>
                   <option value="Order Delay">Order Delay</option>
                   <option value="Cancellation/Refund">Cancellation / Refund</option>
                   <option value="Other">Other Problem</option>
                 </select>
                 <textarea className="input-box" rows="2" placeholder="Explain your problem here..." value={supportTicket.message} onChange={e => setSupportTicket({...supportTicket, message: e.target.value})} style={{marginBottom:'10px'}}></textarea>
                 <button className="btn-main" onClick={submitSupportTicket}>Submit Query to Admin</button>
               </div>

               {tickets.length > 0 && (
                 <div style={{borderTop:'1px solid #eee', paddingTop:'15px', marginTop:'15px'}}>
                   <h4 style={{marginBottom:'10px', fontSize:'14px', color:'#111'}}>Your Support Tickets</h4>
                   {tickets.map(t => (
                     <div key={t.id} style={{background:'#f9f9f9', padding:'10px', borderRadius:'8px', marginBottom:'10px', border:'1px solid #ddd'}}>
                       <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
                         <strong style={{fontSize:'13px'}}>{t.issueType}</strong>
                         <span style={{fontSize:'12px', color: t.status === 'Resolved' ? 'green' : 'red', fontWeight:'bold'}}>{t.status || 'Open'}</span>
                       </div>
                       <div style={{display:'flex', gap:'10px', marginTop:'5px'}}>
                         <button className="btn-buy" style={{background:'#111', color:'#ffcc00', flex: 2}} onClick={() => { setChatInput(''); setCustomerActiveChat(t); setProfileView('chat'); }}>💬 View Chat</button>
                         <button className="btn-buy" style={{background:'#dc3545', color:'#fff', flex: 1}} onClick={() => handleDeleteTicket(t.id, true)}>🗑️</button>
                       </div>
                     </div>
                   ))}
                 </div>
               )}

               <div style={{borderTop:'1px dashed #ccc', paddingTop:'15px', marginTop:'15px'}}>
                 <p style={{fontSize:'13px', color:'#333', marginBottom:'10px'}}>Admin Direct Contact:</p>
                 <p style={{fontWeight:'bold', fontSize:'14px'}}>📞 Phone: {helpInfo.phone}</p>
                 <p style={{fontWeight:'bold', fontSize:'14px', marginTop:'5px'}}>📧 Email: {helpInfo.email}</p>
               </div>
               <button className="btn-buy" style={{marginTop:'20px', background:'#eee', color:'#111', width:'100%', padding:'10px'}} onClick={() => setOpenAccordion('')}>Close Help</button>
            </div>
          ) : (
            <button className="btn-main" style={{background:'#fff9e6', color:'#ff9900', border:'1px solid #ffcc00', marginBottom:'25px'}} onClick={() => setOpenAccordion('help')}>💬 Need Help? FAQ & Contact Us</button>
          )}

          <div style={{ background: '#fff', border: '1.5px solid #ffcc00', padding: '20px', borderRadius: '15px', marginBottom: '25px' }}>
            <h2>{userData?.name}</h2>
            <p style={{ color: 'gray', marginTop: '5px' }}>{userData?.phone}</p>
          </div>
          
          <div className="product-card" style={{cursor:'pointer', padding: '20px'}} onClick={() => setProfileView('edit')}>✏️ Edit Profile Info</div>
          <div className="product-card" style={{cursor:'pointer', padding: '20px'}} onClick={() => setProfileView('history')}>📦 My Order History</div>
          <div className="product-card" style={{cursor:'pointer', padding: '20px'}} onClick={() => setProfileView('cart')}>🛒 My Cart ({cart?.length || 0} items)</div>
          
          <button className="btn-main" style={{background:'#ffebee', color:'red', marginTop:'30px'}} onClick={() => auth.signOut()}>Logout</button>
        </div>
      )}

      {profileView === 'history' && (
        <div>
          <button className="btn-buy" style={{marginBottom:'20px', background:'#eee', color:'#111', padding: '10px 20px'}} onClick={() => setProfileView('menu')}>← Back</button>
          <h3 className="section-title" style={{marginTop:0}}>Order History</h3>
          {orders.map(o => {
             let isOnlinePending = o.paymentMode === 'Online' && o.status === 'Awaiting Admin Approval';
             let timeLeft = isOnlinePending ? Math.max(0, Math.floor((600000 - (currentTime - o.timestampMs)) / 1000)) : 0;

             return (
             <div key={o.id} className="product-card" style={{display:'block', padding: '20px', marginBottom: '15px'}}>
               <div style={{display:'flex', justifyContent:'space-between', marginBottom: '10px'}}>
                 <strong style={{fontSize: '15px'}}>{o.itemDetails}</strong>
                 <span style={{color: (o.status || '').includes('Cancel') ? 'red' : 'green', fontSize:'12px', fontWeight:'bold', textAlign:'right', maxWidth:'50%'}}>{o.status}</span>
               </div>
               <p style={{fontSize:'13px', color:'gray'}}>Paid: ₹{o.totalPaid} ({o.paymentMode})</p>
               
               <div style={{ background: '#f9f9f9', padding: '10px', borderRadius: '8px', marginTop: '10px', border: '1px dashed #ccc' }}>
                 <p style={{fontSize: '12px', fontWeight: 'bold', color: '#111'}}>📍 Tracking Status:</p>
                 <p style={{fontSize: '12px', color: '#007bff', marginTop: '3px'}}>
                   {o.status === 'Awaiting Admin Approval' && "⏳ Waiting for Payment Approval"}
                   {o.status === 'Pending Admin Assignment' && "🔎 Admin is assigning a Partner"}
                   {o.status === 'Partner On The Way' && "🚚 Partner is on the way to your location!"}
                   {o.status === 'Partner Reached Location' && "📍 Partner has arrived at your location!"}
                   {(o.status || '').includes('Pending Admin Verification') && "✅ Partner submitted proof. Waiting for Admin."}
                   {(o.status || '').includes('Pending Admin COD Verification') && "✅ Partner collected cash. Waiting for Admin."}
                   {(o.status || '').includes('Completed') && "🎉 Task Successfully Completed!"}
                 </p>
                 
                 {o.partnerName && (
                   <div style={{marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #ddd'}}>
                     <p style={{fontSize: '12px', color: 'gray'}}>Assigned Partner:</p>
                     <p style={{fontSize: '13px', fontWeight: 'bold', color: '#333'}}>🧑‍🔧 {o.partnerName} | 📞 {o.partnerPhone}</p>
                   </div>
                 )}
               </div>

               {isOnlinePending && timeLeft > 0 && (
                  <div style={{background:'#fff0f0', border:'1px dashed red', padding:'10px', borderRadius:'8px', marginTop:'10px'}}>
                     <span style={{fontSize:'12px', color:'red', fontWeight:'bold'}}>⏳ Admin Approval Timer: {Math.floor(timeLeft/60)}:{timeLeft%60 < 10 ? '0':''}{timeLeft%60}</span>
                  </div>
               )}
               
               {(o.status === 'Pending Admin Assignment' || o.status === 'Awaiting Admin Approval') && (
                 <button className="btn-buy" style={{background:'#ffebee', color:'red', marginTop:'15px', width:'100%', padding: '12px'}} onClick={() => cancelOrder(o.id)}>❌ Cancel Order</button>
               )}

               {/* FIX: Removed Partner Review Button, Only Single Clean Product Review Button */}
               {(o.status || '').includes('Completed') && (
                 <button className="btn-buy" style={{background:'#111', color:'#ffcc00', marginTop:'15px', width:'100%', padding: '12px'}} onClick={() => setReviewModal({isOpen: true, item: o, rating: 5, comment: '', photo: ''})}>⭐ Write a Review with Photo</button>
               )}
             </div>
             )
          })}
          {orders.length === 0 && <p style={{color:'gray', textAlign: 'center', marginTop: '30px'}}>No orders placed yet.</p>}
        </div>
      )}

      {profileView === 'cart' && (
        <div>
          <button className="btn-buy" style={{marginBottom:'20px', background:'#eee', color:'#111', padding: '10px 20px'}} onClick={() => setProfileView('menu')}>← Back</button>
          <h3 className="section-title" style={{marginTop:0}}>Shopping Cart</h3>
          {cart?.map((item, i) => (
            <div key={i} className="product-card" style={{marginBottom: '15px'}}>
              <div className="product-details">
                <div className="product-title">{item.name}</div>
                <div className="product-price">₹{item.price}</div>
              </div>
              <button className="btn-buy" style={{background:'#ff4d4d', color:'#fff', padding: '8px 15px'}} onClick={() => {
                const newCart = [...cart]; newCart.splice(i, 1); setCart(newCart);
              }}>Remove</button>
            </div>
          ))}
          {cart?.length > 0 && (
            <div style={{background:'#fff', padding:'25px', borderRadius:'12px', marginTop:'25px', border:'1.5px solid #ffcc00'}}>
               <h4 style={{marginBottom:'15px', fontSize: '16px'}}>Checkout All Items<br/><span style={{color: 'green'}}>Total: ₹{cart.reduce((s, i) => s + Number(i.price), 0)}</span></h4>
               <select className="select-box" value={checkoutMode} onChange={e => setCheckoutMode(e.target.value)} style={{marginBottom: '15px'}}>
                 <option value="">Select Payment Method</option>
                 <option value="COD">Cash on Delivery</option>
                 <option value="Online">Online / UPI</option>
               </select>
               <button className="btn-main" onClick={handleCartCheckout} disabled={loading}>{loading ? 'Processing...' : 'Confirm Order & Share Location'}</button>
            </div>
          )}
        </div>
      )}

      {profileView === 'edit' && (
         <div>
           <button className="btn-buy" style={{marginBottom:'20px', background:'#eee', color:'#111', padding: '10px 20px'}} onClick={() => setProfileView('menu')}>← Back</button>
           <h3 className="section-title" style={{marginTop:0}}>Update Information</h3>
           <label className="input-label" style={{marginTop: '15px'}}>Full Name</label>
           <input className="input-box" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} />
           <label className="input-label" style={{marginTop: '15px'}}>Mobile Number</label>
           <input className="input-box" value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} />
           <label className="input-label" style={{marginTop: '15px'}}>Street Address</label>
           <input className="input-box" value={editData.address} onChange={e => setEditData({...editData, address: e.target.value})} />
           <button className="btn-main" style={{marginTop: '25px'}} onClick={saveCustomerProfile}>Save Changes</button>
        </div>
      )}

      {reviewModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{padding: '25px'}}>
            <h3 style={{marginBottom: '15px', color: '#111'}}>Product Review</h3>
            <p style={{fontSize:'13px', color:'gray', marginBottom:'20px'}}>{reviewModal.item.itemDetails}</p>
            
            <select className="select-box" value={reviewModal.rating} onChange={e => setReviewModal({...reviewModal, rating: e.target.value})} style={{marginBottom: '15px'}}>
              <option value="5">⭐⭐⭐⭐⭐</option><option value="4">⭐⭐⭐⭐</option><option value="3">⭐⭐⭐</option><option value="2">⭐⭐</option><option value="1">⭐</option>
            </select>
            <textarea className="input-box" placeholder="Describe your experience..." rows="3" value={reviewModal.comment} onChange={e => setReviewModal({...reviewModal, comment: e.target.value})} style={{marginBottom: '15px'}}></textarea>
            
            <div style={{textAlign: 'left', marginBottom: '20px', background: '#f9f9f9', padding: '15px', borderRadius: '8px', border: '1px dashed #ccc'}}>
              <label className="input-label">Attach Photo (Optional)</label>
              <input type="file" accept="image/*" onChange={handleReviewPhotoUpload} style={{marginTop: '10px'}} />
              {reviewModal.photo && <img src={reviewModal.photo} alt="Review" style={{width: '80px', borderRadius: '5px', marginTop: '15px', border: '1px solid #ddd'}} />}
            </div>
            
            <button className="btn-main" onClick={submitReview}>Submit Public Review</button>
            <button className="btn-main" style={{background:'#eee', color:'red', marginTop:'15px'}} onClick={() => setReviewModal({isOpen: false, item: null, rating: 5, comment: '', photo: ''})}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}