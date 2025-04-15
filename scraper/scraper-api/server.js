const express = require("express");
const cors = require("cors");
const { runScraper } = require("./scrape");
const app = express();

const PORT = process.env.PORT || 3000;

// JSONボディの解析を有効化
app.use(express.json());

// CORSミドルウェアを追加
app.use(cors({
  origin: "*", // セキュリティを強化したい場合は特定のオリジンに制限する
  credentials: true
}));

// メッセージを解析する関数
function parseMessage(rawText) {
  // 改行や余分な文字を取り除く
  const cleaned = rawText.replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
  const lines = cleaned.split("\n").map(l => l.trim()).filter(Boolean);

  const nameLine = lines.find(l => l.includes("応募者名"));
  const jobIdLine = lines.find(l => l.includes("応募求人："));
  const loginLine = lines.find(l => l.includes("メールアドレス"));
  const passwordLine = lines.find(l => l.includes("パスワード"));

  const extractValue = (line, sep = "：") => {
    return line ? line.split(sep).pop().replace("様", "").trim() : null;
  };

  const parsed = {
    name: extractValue(nameLine),
    jobId: extractValue(jobIdLine),
    loginId: extractValue(loginLine, ":"),
    password: extractValue(passwordLine, ":"),
  };

  console.log("🧩 parse_message 出力:", parsed);
  return parsed;
}

app.post("/scrape", async (req, res) => {
  try {
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ 
        status: "error", 
        message: "リクエストには「messages」配列が必要です" 
      });
    }

    const results = [];

    // FastAPIバージョンと同様に複数メッセージを処理
    for (let i = 0; i < messages.length; i++) {
      try {
        const parsed = parseMessage(messages[i]);
        const result = await runScraper(parsed);
        results.push(result);
      } catch (error) {
        results.push({
          status: "error",
          index: i,
          message: error.message || String(error)
        });
      }
    }

    res.json(results);
  } catch (error) {
    console.error("サーバーエラー:", error);
    res.status(500).json({ 
      status: "error", 
      message: "内部サーバーエラーが発生しました" 
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});