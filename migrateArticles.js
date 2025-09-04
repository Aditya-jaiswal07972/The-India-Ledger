// migrateArticles.js
const admin = require("firebase-admin");

// ----------------- OLD PROJECT -----------------
const oldServiceAccount = require("./serviceAccountKey1.json");
const oldApp = admin.initializeApp(
  {
    credential: admin.credential.cert(oldServiceAccount),
  },
  "old"
);
const oldDb = oldApp.firestore();

// ----------------- NEW PROJECT -----------------
const newServiceAccount = require("./serviceAccountKey.json");
const newApp = admin.initializeApp(
  {
    credential: admin.credential.cert(newServiceAccount),
  },
  "new"
);
const newDb = newApp.firestore();

async function migrateArticles() {
  try {
    const snapshot = await oldDb.collection("articles").get();
    if (snapshot.empty) {
      console.log("⚠️ No articles found in old project.");
      return;
    }

    console.log(`Found ${snapshot.size} articles. Starting migration...`);

    for (const doc of snapshot.docs) {
      const data = doc.data();

      // Only keep expected fields (clean migration)
      const articleData = {
        title: data.title || "",
        content: data.content || "",
        categories: data.categories || [],
        imageUrl: data.imageUrl || "",
        timestamp: data.timestamp || admin.firestore.FieldValue.serverTimestamp(),
      };

      await newDb.collection("articles").doc(doc.id).set(articleData);
      console.log(`✅ Migrated article: ${doc.id}`);
    }

    console.log("🎉 Migration complete!");
  } catch (err) {
    console.error("❌ Migration failed:", err);
  }
}

migrateArticles();
