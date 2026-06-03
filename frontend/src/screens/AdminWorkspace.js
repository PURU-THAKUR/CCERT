import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, addDoc, getDocs, updateDoc, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';

export default function AdminWorkspace() {
  const [products, setProducts] = useState([]);
  const [newProduct, setNewProduct] = useState({ name: '', category: 'Bullet', price: '', size: '', warranty: '', rating: '5.0', inStock: true });
  const [productImage, setProductImage] = useState(''); 
  const [qrImage, setQrImage] = useState('');
  
  const [fees, setFees] = useState({ platformFee: 10, deliveryCommission: 40 });
  const [helpInfo, setHelpInfo] = useState({ phone: '', email: '' });
  
  // NAYA: Tech Prices ka alag State
  const [techPrices, setTechPrices] = useState({
    "Camera Not Showing Picture": 300,
    "DVR Beeping Sound": 250,
    "Wiring/Cable Damaged": 400,
    "Hard Drive Not Recording": 350,
    "Power Supply Issue": 200,
    "Camera Shifting/Relocation": 500,
    "Mobile App Online Setup": 150,
    "Password Reset": 200,
    "Other Issue": 300
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchProducts(); fetchSettings(); fetchTechPrices(); }, []);

  const fetchProducts = async () => {
    const snap = await getDocs(collection(db, "products"));
    setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const fetchSettings = async () => {
    try {
      const snap = await getDoc(doc(db, "settings", "payments"));
      if (snap.exists()) {
        const data = snap.data();
        setQrImage(data.qrImageBase64 || '');
        if(data.platformFee) setFees({ platformFee: data.platformFee, deliveryCommission: data.deliveryCommission });
        if(data.helpPhone) setHelpInfo({ phone: data.helpPhone, email: data.helpEmail });
      }
    } catch (e) {}
  };

  // NAYA: Fetch Tech Prices independently
  const fetchTechPrices = async () => {
    try {
      const snap = await getDoc(doc(db, "settings", "techPrices"));
      if (snap.exists()) setTechPrices(snap.data());
    } catch (e) {}
  };

  const compressImage = (file, callback) => {
    const reader = new FileReader(); reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image(); img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400; const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH; canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        callback(canvas.toDataURL('image/jpeg', 0.6));
      }
    };
  };

  const saveSettings = async () => {
    setLoading(true);
    await setDoc(doc(db, "settings", "payments"), { 
      qrImageBase64: qrImage,
      platformFee: Number(fees.platformFee),
      deliveryCommission: Number(fees.deliveryCommission),
      helpPhone: helpInfo.phone,
      helpEmail: helpInfo.email
    }, { merge: true });
    alert("System Settings Saved Successfully! ✅");
    setLoading(false);
  };

  // NAYA: Save Tech Prices separately
  const saveTechPrices = async () => {
    setLoading(true);
    await setDoc(doc(db, "settings", "techPrices"), techPrices);
    alert("Technician Prices Updated Everywhere! ✅");
    setLoading(false);
  };

  const addProduct = async () => {
    if (!newProduct.name || !newProduct.price) return alert("Fill Name and Price!");
    if (!productImage) return alert("Product Photo is REQUIRED!"); 
    
    setLoading(true);
    await addDoc(collection(db, "products"), { 
      ...newProduct, 
      price: Number(newProduct.price), 
      imageBase64: productImage, 
      inStock: true 
    });
    alert("Product Listed! ✅");
    setNewProduct({ name: '', category: 'Bullet', price: '', size: '', warranty: '', rating: '5.0', inStock: true }); 
    setProductImage(''); 
    fetchProducts();
    setLoading(false);
  };

  const deleteProduct = async (id) => { if(window.confirm("Delete?")) { await deleteDoc(doc(db, "products", id)); fetchProducts(); } };
  const toggleStock = async (id, currentStatus) => { await updateDoc(doc(db, "products", id), { inStock: !currentStatus }); fetchProducts(); };

  return (
    <div className="content-area">
      <div className="header-top">Admin Workspace</div>

      <h3 className="section-title">System Settings (Fees & QR)</h3>
      <div style={{ background: '#fff', padding: '15px', borderRadius: '10px', border: '1.5px solid #ffcc00', marginBottom: '30px' }}>
        <div style={{display:'flex', gap:'10px', marginBottom:'15px'}}>
          <div style={{flex: 1}}>
            <p style={{ fontSize: '12px', color: 'gray', fontWeight:'bold' }}>Platform Fee (₹)</p>
            <input className="input-box" style={{marginBottom:0}} type="number" value={fees.platformFee} onChange={e => setFees({...fees, platformFee: e.target.value})} />
          </div>
          <div style={{flex: 1}}>
            <p style={{ fontSize: '12px', color: 'gray', fontWeight:'bold' }}>Partner Comm. (₹)</p>
            <input className="input-box" style={{marginBottom:0}} type="number" value={fees.deliveryCommission} onChange={e => setFees({...fees, deliveryCommission: e.target.value})} />
          </div>
        </div>

        <p style={{ fontSize: '12px', color: 'gray', fontWeight:'bold', marginBottom:'5px' }}>Support Phone & Email</p>
        <input className="input-box" placeholder="Phone No." value={helpInfo.phone} onChange={e => setHelpInfo({...helpInfo, phone: e.target.value})} />
        <input className="input-box" placeholder="Email ID" value={helpInfo.email} onChange={e => setHelpInfo({...helpInfo, email: e.target.value})} />

        <p style={{ fontSize: '12px', color: 'gray', fontWeight:'bold', marginBottom:'5px', marginTop:'10px' }}>Global Payment QR</p>
        <input type="file" accept="image/*" onChange={(e) => {if(e.target.files[0]) compressImage(e.target.files[0], setQrImage)}} />
        {qrImage && <img src={qrImage} alt="QR" style={{ width: '120px', margin: '15px auto', display: 'block', border:'1px solid #eee', borderRadius:'8px' }} />}
        
        <button className="btn-main" onClick={saveSettings} disabled={loading}>{loading ? 'Saving...' : 'Save Settings & QR'}</button>
      </div>

      {/* NAYA: Alag Box for Technician Prices */}
      <h3 className="section-title">🔧 Technician Pricing Setup</h3>
      <div style={{ background: '#fff', padding: '15px', borderRadius: '10px', border: '1.5px solid #007bff', marginBottom: '30px' }}>
        <p style={{fontSize: '12px', color: 'gray', marginBottom: '15px'}}>Update prices here. It will auto-sync in Customer App every 5 seconds.</p>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px'}}>
          {Object.keys(techPrices).map(issue => (
            <div key={issue}>
              <p style={{fontSize: '11px', color: 'gray', marginBottom: '3px', fontWeight: 'bold'}}>{issue}</p>
              <input className="input-box" style={{marginBottom: 0, padding: '8px', fontSize: '13px', background: '#f9f9f9'}} type="number" value={techPrices[issue]} onChange={e => setTechPrices({...techPrices, [issue]: Number(e.target.value)})} />
            </div>
          ))}
        </div>
        <button className="btn-main" style={{background: '#007bff'}} onClick={saveTechPrices} disabled={loading}>{loading ? 'Saving...' : 'Save Tech Prices'}</button>
      </div>

      <h3 className="section-title">List New Product</h3>
      <div style={{ background: '#fff', padding: '20px', borderRadius: '10px', border: '1.5px solid #eee', marginBottom: '30px' }}>
        <input className="input-box" placeholder="Product Name" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
        
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <select className="select-box" style={{marginBottom: 0}} value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})}>
            <option value="Bullet">Bullet</option><option value="Dome">Dome</option><option value="PTZ">PTZ</option><option value="DVR">DVR</option><option value="Accessories">Accessories</option><option value="Others">Others</option>
          </select>
          <input className="input-box" style={{marginBottom: 0}} type="number" placeholder="Price (₹)" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} />
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <input className="input-box" style={{marginBottom: 0}} placeholder="Size/Variant (e.g. 2MP, 8CH)" value={newProduct.size} onChange={e => setNewProduct({...newProduct, size: e.target.value})} />
          <input className="input-box" style={{marginBottom: 0}} placeholder="Warranty (e.g. 1 Year)" value={newProduct.warranty} onChange={e => setNewProduct({...newProduct, warranty: e.target.value})} />
        </div>

        <input className="input-box" placeholder="Initial Rating (e.g. 4.5)" value={newProduct.rating} onChange={e => setNewProduct({...newProduct, rating: e.target.value})} />

        <p style={{fontSize:'12px', color:'red', fontWeight:'bold', marginBottom:'5px'}}>Product Photo (Mandatory) *</p>
        <input type="file" accept="image/*" onChange={(e) => {if(e.target.files[0]) compressImage(e.target.files[0], setProductImage)}} style={{marginBottom: '10px'}} />
        {productImage && <img src={productImage} alt="Preview" style={{width:'80px', display:'block', marginBottom:'15px', borderRadius:'8px'}}/>}
        
        <button className="btn-main" onClick={addProduct} disabled={loading}>{loading ? 'Listing...' : 'List Product'}</button>
      </div>

      <h3 className="section-title">Manage Catalog</h3>
      {products.map(p => (
        <div key={p.id} className="product-card" style={{ display: 'block' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
            <span>{p.name} <span style={{ color: '#ff9900' }}>(₹{p.price})</span></span>
            <span style={{ color: p.inStock ? 'green' : 'red', fontSize: '12px' }}>{p.inStock ? 'In Stock' : 'Out of Stock'}</span>
          </div>
          <div style={{display:'flex', gap:'10px', marginTop:'15px'}}>
            <button className="btn-buy" style={{ flex:1, background: p.inStock ? '#eee' : '#28a745', color: p.inStock ? '#111' : '#fff' }} onClick={() => toggleStock(p.id, p.inStock)}>{p.inStock ? 'Mark Out of Stock' : 'Mark In Stock'}</button>
            <button className="btn-buy" style={{ background: '#dc3545', color: '#fff' }} onClick={() => deleteProduct(p.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}