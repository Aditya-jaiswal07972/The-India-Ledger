// autoNews.js
import admin from "firebase-admin";
import fetch from "node-fetch";
import OpenAI from "openai";
import fs from "fs";
import Parser from "rss-parser";
import "dotenv/config";

// 1. Initialize Firebase
const serviceAccount = JSON.parse(fs.readFileSync("serviceAccountKey.json", "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// 2. Initialize OpenAI
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DEFAULT_IMAGE =
  "https://upload.wikimedia.org/wikipedia/commons/6/65/No-Image-Placeholder.svg";

// 3. Fetch Latest News (using NewsAPI, fallback RSS)
async function fetchNews() {
  try {
    const res = await fetch(
      `https://newsapi.org/v2/everything?q=India&sortBy=publishedAt&language=en&apiKey=${process.env.NEWS_API_KEY}`
    );
    const data = await res.json();

    if (data.articles && data.articles.length > 0) {
      console.log("✅ Using NewsAPI");
      const article = data.articles[0];
      return {
        title: article.title,
        description: article.description || article.content,
        url: article.url,
        imageUrl: article.urlToImage || DEFAULT_IMAGE,
      };
    }
  } catch (err) {
    console.warn("⚠️ NewsAPI failed:", err.message);
  }

  // --- Fallback: Google News RSS ---
  console.log("🔄 Falling back to Google News RSS...");
  const parser = new Parser();
  const feed = await parser.parseURL(
    "https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en"
  );

  if (!feed.items || feed.items.length === 0) {
    throw new Error("No articles found from either NewsAPI or Google News RSS");
  }

  const article = feed.items[0];
  return {
    title: article.title,
    description: article.contentSnippet,
    url: article.link,
    imageUrl: DEFAULT_IMAGE,
  };
}

// 4 + 5. Generate Summary + Detect Category Together
async function generateSummaryAndCategory(article) {
  try {
    const prompt = `
      Write a news piece in the style of Palki Sharma.
      Then classify it into one category.

      Return ONLY valid JSON in this format:
      {
        "headline": "catchy headline",
        "body": "60-80 word article body",
        "category": "one of [Politics, Business, Technology, Sports, Entertainment, Weather, India, World, Health, Science]"
      }

      Title: ${article.title}
      Description: ${article.description}
    `;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 400,
      response_format: { type: "json_object" }
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    return parsed; // { headline, body, category }
  } catch (err) {
    console.warn("⚠️ OpenAI quota issue, falling back to raw description.");
    return {
      headline: article.title,
      body: article.description || "No description available.",
      category: "World",
    };
  }
}


// 6. Save to Firestore
async function saveArticle(title, content, category, imageUrl, sourceUrl) {
  await db.collection("articles").add({
    title,
    content,
    category,
    imageUrl,
    sourceUrl,
    timestamp: Date.now(),
  });
  console.log("✅ Article published:", title);
}

// 7. Main Runner
(async () => {
  try {
    const news = await fetchNews();
    const { headline, body, category } = await generateSummaryAndCategory(news);

    await saveArticle(
      headline,
      body,
      category,
      news.imageUrl || "https://via.placeholder.com/600",
      news.url
    );
  } catch (err) {
    console.error("❌ Error:", err);
  }
})();
