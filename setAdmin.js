const admin = require("firebase-admin");

// Path to the downloaded service account key
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const uid = "fs02rP0NDfRNKQgVGWh9yuZdtCF2"; // from Firebase Console → Authentication → Users

admin.auth().setCustomUserClaims(uid, { admin: true })
  .then(() => {
    console.log("✅ Admin claim added to user:", uid);
    process.exit(0);
  })
  .catch(err => {
    console.error("Error:", err);
    process.exit(1);
  });
