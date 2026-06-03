const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize Admin SDK to bypass security rules from the backend
admin.initializeApp();
const db = admin.firestore();

// Trigger: Jab bhi 'orders' collection mein naya document create hoga
exports.onNewOrderCreated = functions.firestore
  .document("orders/{orderId}")
  .onCreate(async (snap, context) => {
    try {
      const orderData = snap.data();
      const orderId = context.params.orderId;

      console.log(`New Order Placed: ${orderId}`, orderData);

      // Create a notification for the Admin Panel
      await db.collection("notifications").add({
        title: "🚨 New Order / Service Request",
        body: `Item: ${orderData.item} | Price: ₹${orderData.price}`,
        type: orderData.type, // 'Repair Service' or 'Product Purchase'
        status: "unread",
        targetRole: "admin",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log("Admin notification created successfully.");
      return null;
    } catch (error) {
      console.error("Error processing new order:", error);
      // Try-catch ensures the cloud function doesn't crash the pipeline
      return null; 
    }
  });