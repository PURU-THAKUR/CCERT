import React, { useState } from 'react';

export default function JobSeeker({ setScreen }) {
  const [jobType, setJobType] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    alert("Application Submitted! Admin will verify your documents.");
    setScreen('auth'); // Sends back to login to await approval
  };

  if (!jobType) {
    return (
      <div className="content-area" style={{ textAlign: 'center', paddingTop: '50px' }}>
        <h2>Select Job Profile</h2>
        <button className="btn-main" onClick={() => setJobType('delivery')} style={{ marginTop:'30px' }}>📦 Delivery Boy</button>
        <button className="btn-main" onClick={() => setJobType('tech')} style={{ marginTop:'20px', background: '#333' }}>🔧 CCTV Technician</button>
      </div>
    );
  }

  return (
    <div className="content-area">
      <h2 style={{ color: '#ff9900', marginBottom: '20px' }}>{jobType === 'delivery' ? "Delivery Boy Application" : "Technician Application"}</h2>
      <form onSubmit={handleSubmit}>
        {jobType === 'tech' && (
          <input className="input-box" placeholder="Years of Experience in TECHNICIAN ROLE" required />
        )}
        <input className="input-box" placeholder="Aadhar Card Number" required />
        <input className="input-box" placeholder="Driving License Number" required />
        <div style={{ marginTop: '15px', marginBottom: '25px', background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #eee' }}>
          <label style={{ fontSize: '14px', color: '#555', fontWeight: 'bold' }}>Upload Selfie / Photo</label>
          <input type="file" style={{ width: '100%', marginTop: '10px' }} required />
        </div>
        <button type="submit" className="btn-main">Submit Application</button>
      </form>
    </div>
  );
}