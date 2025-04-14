const express = require("express");
const bodyParser = require("body-parser");
const { parseMessage } = require("./parse");
const { runScraper } = require("./scrape");
const path = require("path");

const app = express();
app.use(bodyParser.json()); // JSONで配列を受け取る

app.use('/resumes', express.static(path.join(__dirname, 'resumes')));

app.post("/scrape", async (req, res) => {
  const messages = req.body.messages;

  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: "messages must be an array of text" });
  }

  try {
    const results = await Promise.all(
      messages.map(async (message, index) => {
        try {
          const parsed = parseMessage(message);
          const result = await runScraper(parsed);
          return {
            status: "success",
            index,
            ...result
          };
        } catch (error) {
          console.error(`❌ 応募${index + 1}でエラー`, error);
          return {
            status: "error",
            index,
            message: error.message || "Unknown error"
          };
        }
      })
    );

    res.json(results);
  } catch (error) {
    console.error("❌ 全体処理でエラー:", error);
    res.status(500).json({ error: "Batch scraping failed" });
  }
});

// サーバ起動
app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});
