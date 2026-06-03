import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase/config';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

export default function AuthScreen({ setScreen, setUserData }) {
  const [isLogin, setIsLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [adminAlreadyExists, setAdminAlreadyExists] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({ 
    email: '', password: '', fullName: '', age: '', gender: '',
    countryCode: '+91', phone: '', street: '', landmark: '', pinCode: '', district: '', city: '', state: '',
    role: 'customer', jobType: '', experience: '', qualification: ''
  });

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const adminDoc = await getDoc(doc(db, 'settings', 'roles'));
        if (adminDoc.exists() && adminDoc.data().adminClaimed) {
          setAdminAlreadyExists(true);
        }
      } catch (error) { console.error(error); }
    };
    checkAdmin();
  }, []);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
          setScreen('main');
        } else {
          alert("User data not found. Please sign up.");
        }
      } else {
        if (formData.phone.length !== 10) { 
          alert("Enter exactly 10 digits for mobile number."); 
          setLoading(false); 
          return; 
        }
        
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        const userUid = userCredential.user.uid;

        const fullAddress = {
          street: formData.street || '', landmark: formData.landmark || '',
          pinCode: formData.pinCode || '', district: formData.district || '',
          city: formData.city || '', state: formData.state || ''
        };

        const newUserProfile = {
          uid: userUid, 
          email: formData.email, 
          name: formData.fullName, 
          age: formData.age, 
          gender: formData.gender,
          phone: `${formData.countryCode} ${formData.phone}`, 
          address: fullAddress, 
          role: formData.role,
          jobDetails: formData.role === 'job_seeker' ? {
            type: formData.jobType || 'Unassigned', 
            experience: formData.experience || '0', 
            qualification: formData.qualification || 'N/A', 
            isApproved: false
          } : null,
          createdAt: serverTimestamp()
        };

        await setDoc(doc(db, 'users', userUid), newUserProfile);
        if (formData.role === 'admin') {
          await setDoc(doc(db, 'settings', 'roles'), { adminClaimed: true }, { merge: true });
        }
        
        alert("Account Created Successfully!");
        setUserData(newUserProfile); 
        setScreen('main');
      }
    } catch (error) {
      if (error.code === 'auth/invalid-credential') alert("Invalid Email or Password. Please check again.");
      else if (error.code === 'auth/email-already-in-use') alert("Email already registered. Please log in.");
      else alert(error.message);
    }
    setLoading(false);
  };

  return (
    <div className="content-area" style={{ paddingBottom: '20px' }}>
      <h1 className="auth-title">{isLogin ? "Secure Login" : "Create Account"}</h1>
      
      <form onSubmit={handleAuthSubmit}>
        {!isLogin && (
          <>
            <h3 className="section-title">Personal Details</h3>
            <div className="input-group">
              <input className="input-box" placeholder="Full Name" required onChange={e => setFormData({...formData, fullName: e.target.value})} />
            </div>
            
            <div className="row" style={{marginBottom: 0}}>
              <div className="col">
                <select className="select-box" required onChange={e => setFormData({...formData, gender: e.target.value})}>
                  <option value="" disabled selected>Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="col">
                <input className="input-box" type="number" placeholder="Age (Years)" required onChange={e => setFormData({...formData, age: e.target.value})} />
              </div>
            </div>

            <div className="input-group">
              <div style={{ display: 'flex', gap: '10px' }}>
                <select className="select-box" style={{ width: '35%' }} value={formData.countryCode} onChange={e => setFormData({...formData, countryCode: e.target.value})}>
                  <option value="+91">🇮🇳 +91</option>
                </select>
                <input className="input-box" style={{ width: '65%' }} type="number" placeholder="Mobile Number" required onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
            </div>

            <h3 className="section-title">Address Details</h3>
            <div className="input-group"><input className="input-box" placeholder="Street Address / House No." required onChange={e => setFormData({...formData, street: e.target.value})} /></div>
            <div className="input-group"><input className="input-box" placeholder="Landmark (Optional)" onChange={e => setFormData({...formData, landmark: e.target.value})} /></div>
            <div className="row" style={{marginBottom: 0}}>
              <div className="col"><input className="input-box" placeholder="Pincode" type="number" required onChange={e => setFormData({...formData, pinCode: e.target.value})} /></div>
              <div className="col"><input className="input-box" placeholder="District" required onChange={e => setFormData({...formData, district: e.target.value})} /></div>
            </div>
            <div className="row">
              <div className="col"><input className="input-box" placeholder="City" required onChange={e => setFormData({...formData, city: e.target.value})} /></div>
              <div className="col"><input className="input-box" placeholder="State" required onChange={e => setFormData({...formData, state: e.target.value})} /></div>
            </div>

            <h3 className="section-title">Account Role</h3>
            <div className="input-group">
              <select className="select-box" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                <option value="customer">🛒 Customer (Buy/Repair)</option>
                <option value="job_seeker">💼 Job Seeker (Delivery/Tech)</option>
                {!adminAlreadyExists && <option value="admin">👑 System Admin (Owner)</option>}
              </select>
            </div>

            {formData.role === 'job_seeker' && (
              <div style={{ background: '#fff9e6', padding: '15px', borderRadius: '8px', border: '1.5px solid #ffcc00', marginBottom: '20px' }}>
                <select className="select-box" required onChange={e => setFormData({...formData, jobType: e.target.value})} style={{marginBottom:'15px'}}>
                  <option value="" disabled selected>Select Job Profile</option>
                  <option value="delivery">Delivery Partner</option>
                  <option value="technician">CCTV Technician</option>
                </select>
                
                {formData.jobType === 'technician' && (
                  <>
                    <select className="select-box" required onChange={e => setFormData({...formData, qualification: e.target.value})}>
                      <option value="" disabled selected>Highest Qualification</option>
                      <option value="10th">10th Pass</option>
                      <option value="diploma">Diploma</option>
                      <option value="degree">Other Degree</option>
                    </select>
                    <input className="input-box" type="number" placeholder="Years of Experience" required onChange={e => setFormData({...formData, experience: e.target.value})} />
                  </>
                )}
                
                <div className="input-group">
                  <label className="input-label">Identity Proof (Aadhar/DL/PAN) *</label>
                  <input type="file" accept="image/*,.pdf" />
                </div>
              </div>
            )}
          </>
        )}

        <h3 className="section-title">{isLogin ? "" : "Security"}</h3>
        <div className="input-group">
          <input className="input-box" type="email" placeholder="Email Address" autoComplete="username" required onChange={e => setFormData({...formData, email: e.target.value.trim()})} />
        </div>
        
        <div className="input-group" style={{ position: 'relative' }}>
          <input className="input-box" type={showPassword ? "text" : "password"} placeholder="Password (Min 6 chars)" required onChange={e => setFormData({...formData, password: e.target.value})} />
          <span onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '15px', top: '15px', cursor: 'pointer', fontSize: '20px' }}>
            {showPassword ? "👁️" : "🙈"}
          </span>
        </div>

        <button type="submit" className="btn-main" disabled={loading}>
          {loading ? "Processing..." : (isLogin ? "Secure Login" : "Create Account")}
        </button>
      </form>
      
      <p className="bottom-link">
        {isLogin ? "New to CCERT? " : "Already registered? "}
        <span onClick={() => setIsLogin(!isLogin)}>{isLogin ? "Sign Up Here" : "Login Here"}</span>
      </p>
    </div>
  );
}