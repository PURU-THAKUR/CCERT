import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase/config';
import { collection, addDoc, serverTimestamp, doc, getDocs, getDoc, query, where } from 'firebase/firestore';

export default function CustomerHome({ userData, activeRole, cart, setCart }) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState(null); 
  const [checkoutItem, setCheckoutItem] = useState(null); 
  const [paymentMode, setPaymentMode] = useState('');
  
  const [products, setProducts] = useState([]); 
  const [reviews, setReviews] = useState([]); 
  const [adminQR, setAdminQR] = useState('');
  const [fees, setFees] = useState({ platformFee: 10, deliveryCommission: 40 });
  const [techPrices, setTechPrices] = useState({});
  const [loading, setLoading] = useState(false);
  
  const [liveLocation, setLiveLocation] = useState(null);

  const categories = ['All', 'Bullet', 'Dome', 'PTZ', 'DVR', 'Accessories', 'Others'];

  useEffect(() => {
    const fetchData = async () => {
      const snap = await getDocs(collection(db, "products"));
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      const qrSnap = await getDoc(doc(db, "settings", "payments"));
      if (qrSnap.exists()) {
        const data = qrSnap.data();
        setAdminQR(data.qrImageBase64 || '');
        setFees({ platformFee: Number(data.platformFee) || 10, deliveryCommission: Number(data.deliveryCommission) || 40 });
      }
    };
    fetchData();

    // NAYA: Auto-Sync Tech Prices every 5 seconds
    const fetchPrices = async () => {
      const pSnap = await getDoc(doc(db, "settings", "techPrices"));
      if(pSnap.exists()) setTechPrices(pSnap.data());
    };
    fetchPrices();
    const pollPrices = setInterval(fetchPrices, 5000);
    return () => clearInterval(pollPrices);
  }, []);

  const handleProductSelect = async (product) => { 
    setSelectedProduct(product); 
    const rSnap = await getDocs(query(collection(db, "reviews"), where("productName", "==", product.name)));
    // FIX: Strictly hide 'Partner' reviews from Product Page
    const validReviews = rSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(r => r.reviewType !== 'Partner')
      .sort((a,b) => b.timestampMs - a.timestampMs);
    setReviews(validReviews);
  };

  const handleAddToCart = (product) => { 
    setCart([...cart, product]); 
    alert("Added to cart!"); 
    setSelectedProduct(null); 
  };

  const fetchUserLocation = () => {
    if (navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLiveLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLoading(false);
          alert("✅ Live Location Fetched Successfully!");
        },
        (err) => {
          setLoading(false);
          alert("🚨 Please Enable GPS/Location in your device to proceed.");
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    } else {
      alert("Location is not supported on this device.");
    }
  };

  const handlePlaceOrder = async () => {
    if (!paymentMode) return alert("Select a payment method.");
    if (checkoutItem.type === 'Technician' && checkoutItem.issue === 'Select Problem') return alert("Please select your CCTV problem first!");

    setLoading(true);
    try {
      let userLocation = null;
      
      // NAYA: Silent & Optional Location Fetch (Localhost & Recording Friendly)
      if (navigator.geolocation) {
        try {
          // Sirf 3 second wait karega, nahi mila toh aage badh jayega
          const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000 }));
          userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        } catch (err) {
          console.warn("Location skipped or denied. Proceeding without it.");
        }
      }

      const totalAmount = checkoutItem.price + Number(fees.platformFee) + (checkoutItem.type !== 'Technician' ? Number(fees.deliveryCommission) : 0);

      await addDoc(collection(db, "orders"), {
        userId: auth.currentUser.uid, customerName: userData.name, customerPhone: userData.phone, customerAddress: userData.address,
        type: checkoutItem.type || 'Product', 
        itemDetails: checkoutItem.name || checkoutItem.issue,
        itemPrice: checkoutItem.price, 
        totalPaid: totalAmount, 
        partnerCommission: Number(fees.deliveryCommission),
        paymentMode: paymentMode, 
        status: paymentMode === 'Online' ? 'Awaiting Admin Approval' : 'Pending Admin Assignment',
        location: userLocation, // Agar nahi mila toh null jayega bina error ke
        createdAt: serverTimestamp(), timestampMs: Date.now()
      });

      alert(paymentMode === 'Online' ? "Payment Processing! Wait for Admin Approval." : "Order Confirmed!");
      setCheckoutItem(null); setPaymentMode(''); setSelectedProduct(null);
    } catch (error) { alert("Order failed!"); }
    setLoading(false);
  };

  const getTechPrice = (issueName) => techPrices[issueName] || 300;

  if (activeRole !== 'customer') return null; 

  return (
    <div className="content-area">
      {selectedProduct ? (
        <>
          <button className="btn-buy" style={{marginBottom:'20px', background:'#eee', color:'#111', padding: '10px 20px'}} onClick={() => setSelectedProduct(null)}>← Back to Store</button>
          
          <div style={{ background: '#fff', padding: '30px', borderRadius: '12px', textAlign: 'center', border: '1.5px solid #ffcc00' }}>
            {selectedProduct.imageBase64 ? (
               <img src={selectedProduct.imageBase64} alt="product" style={{ width: '100%', maxHeight: '250px', objectFit: 'contain', borderRadius: '8px' }} />
            ) : (
               <div style={{ fontSize: '80px', marginBottom: '20px' }}>📷</div>
            )}
            <h2 style={{ color: '#111', marginTop:'20px' }}>{selectedProduct.name}</h2>
            <p style={{ color: 'gray', marginTop:'5px', fontSize: '13px' }}>Category: {selectedProduct.category}</p>
            <h1 style={{ color: '#ff9900', marginTop: '15px', fontSize: '32px' }}>₹{selectedProduct.price}</h1>
            {!selectedProduct.inStock && <div style={{ color: 'red', fontWeight: 'bold', marginTop: '15px' }}>Currently Out of Stock</div>}
          </div>
          
          <div style={{ display: 'flex', gap: '15px', marginTop: '25px' }}>
            <button className="btn-main" style={{ background: '#fff', color: '#111', border: '2px solid #111' }} onClick={() => handleAddToCart(selectedProduct)} disabled={!selectedProduct.inStock}>Add to Cart</button>
            <button className="btn-main" onClick={() => setCheckoutItem(selectedProduct)} disabled={!selectedProduct.inStock}>Buy Now</button>
          </div>

          <h3 className="section-title" style={{ marginTop: '40px' }}>Customer Reviews</h3>
          {reviews.length === 0 ? (
            <p style={{ color: 'gray', fontSize: '14px', textAlign: 'center', padding: '25px', background: '#fff', borderRadius: '8px', border: '1px solid #eee' }}>No reviews yet. Be the first to review after purchase!</p>
          ) : (
            reviews.map(r => (
              <div key={r.id} style={{ background: '#fff', padding: '20px', borderRadius: '10px', marginBottom: '15px', border: '1px solid #eee' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '15px' }}>{r.customerName}</span>
                  <span style={{ color: '#ffcc00', fontSize: '14px' }}>{'⭐'.repeat(r.rating)}</span>
                </div>
                <p style={{ fontSize: '14px', color: '#444', lineHeight: '1.5' }}>{r.comment}</p>
                {r.photoBase64 && <img src={r.photoBase64} alt="Review attachment" style={{ width: '100px', borderRadius: '8px', marginTop: '15px', border: '1px solid #ddd' }} />}
              </div>
            ))
          )}
        </>
      ) : (

        <>
          <div className="header-top">Explore Store</div>
          <div className="category-scroll" style={{ marginTop: '20px', marginBottom: '20px' }}>
            {categories.map(cat => ( <div key={cat} className={`category-chip ${activeCategory === cat ? 'active' : ''}`} onClick={() => setActiveCategory(cat)}>{cat}</div> ))}
          </div>
          
          <h3 className="section-title">Products</h3>
          {products.length === 0 && <p style={{ textAlign: 'center', color: 'gray', marginTop: '20px' }}>No products listed yet.</p>}

          {products.filter(p => activeCategory === 'All' || p.category === activeCategory).map(p => (
            <div key={p.id} className={`product-card ${!p.inStock ? 'out-of-stock-card' : ''}`} onClick={() => handleProductSelect(p)} style={{ marginBottom: '15px' }}>
              {p.imageBase64 ? (
                <img src={p.imageBase64} alt="prod" style={{ width: '70px', height: '70px', borderRadius: '8px', objectFit: 'cover' }} />
              ) : (
                <div className="product-image-placeholder" style={{ width: '70px', height: '70px' }}>📷</div>
              )}
              <div className="product-details" style={{ marginLeft: '10px' }}>
                <div className="product-title" style={{ fontSize: '15px' }}>{p.name}</div>
                <div className="product-price" style={{ fontSize: '16px', marginTop: '5px' }}>₹{p.price}</div>
                {!p.inStock && <div className="out-of-stock-tag" style={{ marginTop: '5px' }}>Out of Stock</div>}
              </div>
            </div>
          ))}

          <h3 className="section-title" style={{ marginTop: '35px' }}>Services</h3>
          <div className="product-card" style={{ background: '#111', color: '#fff', marginTop: '15px', cursor:'pointer', padding: '20px' }} onClick={() => {
              setCheckoutItem({ type: 'Technician', issue: 'Select Problem', price: 300 });
            }}>
            <div style={{ fontSize: '35px' }}>🔧</div>
            <div className="product-details" style={{ marginLeft: '15px' }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ffde59' }}>Need a Technician?</div>
              <div style={{ fontSize: '13px', color: '#ccc', marginTop: '5px' }}>CCTV Repair at your doorstep</div>
            </div>
          </div>
        </>
      )}

      {checkoutItem && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ padding: '25px' }}>
            <h2 style={{borderBottom:'1.5px solid #eee', paddingBottom:'15px', marginBottom:'20px', color:'#ff9900'}}>Checkout</h2>
            
            {checkoutItem.type === 'Technician' ? (
              <div style={{textAlign:'left', marginBottom:'20px'}}>
                <label style={{fontSize:'13px', fontWeight:'bold', color: '#555', marginBottom: '8px', display: 'block'}}>Select Your CCTV Problem:</label>
                
                <select className="select-box" value={checkoutItem.issue} onChange={e => {
                   const selectedIssue = e.target.value;
                   const issuePrice = Number(techPrices[selectedIssue]) || 300;
                   setCheckoutItem({...checkoutItem, issue: selectedIssue, price: issuePrice});
                }}>
                  <option disabled value="Select Problem">Select Problem</option>
                  <option value="Camera Not Showing Picture">Camera Not Showing Picture - ₹{techPrices["Camera Not Showing Picture"] || 300}</option>
                  <option value="DVR Beeping Sound">DVR Beeping Sound - ₹{techPrices["DVR Beeping Sound"] || 300}</option>
                  <option value="Wiring/Cable Damaged">Wiring/Cable Damaged - ₹{techPrices["Wiring/Cable Damaged"] || 300}</option>
                  <option value="Hard Drive Not Recording">Hard Drive Not Recording - ₹{techPrices["Hard Drive Not Recording"] || 300}</option>
                  <option value="Power Supply Issue">Power Supply Issue - ₹{techPrices["Power Supply Issue"] || 300}</option>
                  <option value="Camera Shifting/Relocation">Camera Shifting/Relocation - ₹{techPrices["Camera Shifting/Relocation"] || 300}</option>
                  <option value="Mobile App Online Setup">Mobile App Online Setup - ₹{techPrices["Mobile App Online Setup"] || 300}</option>
                  <option value="Password Reset">Password Reset - ₹{techPrices["Password Reset"] || 300}</option>
                  <option value="Other Issue">Other Issue - ₹{techPrices["Other Issue"] || 300}</option>
                </select>
              </div>
            ) : (
              <div style={{textAlign:'left', marginBottom:'20px', fontSize: '15px'}}><strong>Item:</strong> {checkoutItem.name}</div>
            )}

            <div style={{marginBottom: '20px'}}>
              <button className="btn-buy" style={{background: liveLocation ? '#28a745' : '#111', color: '#fff', width: '100%', padding: '12px', display: 'flex', justifyContent: 'center', gap: '10px'}} onClick={fetchUserLocation} disabled={loading}>
                {liveLocation ? "✅ Live Location Attached" : "📍 Fetch Live Location (Required)"}
              </button>
            </div>

            <div style={{textAlign:'left', marginBottom:'25px', background: '#f9f9f9', padding: '15px', borderRadius: '8px', border: '1px solid #eee'}}>
              <div style={{ fontSize: '14px', marginBottom: '5px' }}><strong>Base Price:</strong> ₹{checkoutItem.price}</div>
              <div style={{ fontSize: '14px', marginBottom: '5px', color: 'gray' }}>+ Platform Fee: ₹{fees.platformFee}</div>
              {checkoutItem.type !== 'Technician' && <div style={{ fontSize: '14px', marginBottom: '5px', color: 'gray' }}>+ Delivery Charge: ₹{fees.deliveryCommission}</div>}
              
              {/* MISSING LIVE LOCATION BUTTON RESTORED */}
            <div style={{marginBottom: '20px'}}>
              <button className="btn-main" style={{background: liveLocation ? '#28a745' : '#111', color: '#fff', width: '100%', padding: '12px', display: 'flex', justifyContent: 'center', gap: '10px'}} onClick={fetchUserLocation} disabled={loading}>
                {liveLocation ? "✅ Live Location Attached" : "📍 Fetch Live Location (Required)"}
              </button>
            </div>

              <strong style={{fontSize:'20px', display:'block', marginTop:'15px', borderTop: '1px dashed #ccc', paddingTop: '10px'}}>
                Total to Pay: <span style={{color:'green'}}>₹{checkoutItem.price + Number(fees.platformFee) + (checkoutItem.type !== 'Technician' ? Number(fees.deliveryCommission) : 0)}</span>
              </strong>
            </div>

            <h4 style={{textAlign:'left', marginBottom:'15px', fontSize:'15px', color: '#333'}}>Select Payment Method</h4>
            <div style={{display:'flex', gap:'15px', marginBottom:'25px'}}>
              <button className="btn-main" style={{background: paymentMode === 'COD' ? '#28a745' : '#fff', color: paymentMode === 'COD' ? '#fff' : '#111', border: '1.5px solid #28a745', padding: '12px'}} onClick={() => setPaymentMode('COD')}>COD</button>
              <button className="btn-main" style={{background: paymentMode === 'Online' ? '#007bff' : '#fff', color: paymentMode === 'Online' ? '#fff' : '#111', border: '1.5px solid #007bff', padding: '12px'}} onClick={() => setPaymentMode('Online')}>Online</button>
            </div>

            {paymentMode === 'Online' && (
              <div style={{background:'#fff9e6', padding:'20px', borderRadius:'10px', marginBottom:'25px', border: '1.5px dashed #ffcc00'}}>
                <p style={{fontSize:'14px', fontWeight:'bold', color: '#111'}}>Scan QR to Pay</p>
                {adminQR ? <img src={adminQR} alt="QR" style={{width:'160px', margin:'15px auto', display:'block', borderRadius: '8px'}}/> : <p style={{color:'red', marginTop: '10px'}}>Admin QR missing.</p>}
              </div>
            )}
            
            <button className="btn-main" onClick={handlePlaceOrder} disabled={loading}>{loading ? 'Processing...' : 'Confirm Order'}</button>
            <button className="btn-main" style={{background:'#fff', color:'red', border:'none', marginTop:'10px'}} onClick={() => {setCheckoutItem(null); setPaymentMode(''); setLiveLocation(null);}}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}