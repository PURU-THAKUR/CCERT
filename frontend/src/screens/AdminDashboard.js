import React from 'react';

export default function AdminDashboard() {
  return (
    <>
      <div className="header-top" style={{ background: '#111', color: '#ffde59' }}>Admin Control</div>
      <div className="content-area">
        
        <h3 style={{ color: '#ff9900', marginBottom: '15px' }}>Pending Job Approvals</h3>
        <div className="card" style={{ borderLeft: '5px solid red' }}>
          <h4>Technician: Ramesh</h4>
          <p style={{ fontSize: '14px', color: '#555', marginTop: '5px', marginBottom: '10px' }}>Application received. Verify Aadhar & Driving License.</p>
          <button style={{ background: '#28a745', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px', marginRight: '10px' }}>Approve</button>
          <button style={{ background: '#dc3545', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '5px' }}>Reject</button>
        </div>

        <h3 style={{ marginTop: '30px', marginBottom: '15px' }}>Add Products / Services</h3>
        <div className="card">
          <input className="input-box" placeholder="Item Name (e.g., CP Plus DVR)" />
          <input className="input-box" placeholder="Price (₹)" type="number" />
          <button className="btn-main" style={{ background: '#ffde59', color: '#111' }}>Publish Listing</button>
        </div>

      </div>
    </>
  );
}