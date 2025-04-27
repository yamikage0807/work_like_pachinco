const express = require("express");
const cors     = require("cors");

// 各スクレイパー
const { runScraper: runTypeScraper    } = require("./scrapers/type_scrape");
const { runScraper: runMainabiScraper } = require("./scrapers/mainabi_scrape");
const { runScraper: runDodaScraper    } = require("./scrapers/doda_scrape");
const { runScraper: runENScraper      } = require("./scrapers/EN_scrape");
const { runScraper: runEngageScraper  } = require("./scrapers/engage_scrape");

const app  = express();
const PORT = process.env.PORT || 3000;

// ---------- middleware ----------
app.use(express.json());
app.use(cors({ origin: "*", credentials: true }));

// ---------- ユーティリティ ----------

/**
 * ネスト崩し + 空白/BOM 除去 + 小文字化 + 先頭語抽出
 * - messages[i] が JSON 文字列化されたオブジェクトだった場合は 1 段だけほどく
 * - 返り値: { head: "type" | "マイナビ" | …, body: 元の本文 }
 */

function normalize(raw) {
  let txt = raw;

  // JSON形式かどうか安全に確認してからパース
  if (typeof txt === "string") {
    try {
      const parsed = JSON.parse(txt);
      if (typeof parsed === "object" && parsed.message) {
        txt = parsed.message;
      }
    } catch (e) {
      // パース失敗＝普通の文字列 → そのままでOK
    }
  }

  // テキストでなければ空文字に
  if (typeof txt !== "string") txt = "";

  // BOM・全角/半角空白除去
  txt = txt.replace(/^\uFEFF/, "").trim();

  // 「より」までの語をheadとして抽出
  const match = txt.match(/^(.+?)より/);
  const head = match ? match[1].toLowerCase().trim() : "";

  console.log("🔍 normalized head:", head);
  return { head, body: txt };
}


  

// ---------- ルーティング ----------
app.post("/scrape", async (req, res) => {
  try {
    let { messages } = req.body;

    // 「messages」が文字列（丸ごと全部stringify）の場合のみ 1 回 parse
    if (typeof messages === "string") {
      try {
        messages = JSON.parse(messages);
      } catch {
        return res.status(400).json({ status:"error", message:"messages が不正な JSON 文字列です" });
      }
    }

    if (!Array.isArray(messages)) {
      return res.status(400).json({ status:"error", message:"messages 配列が必要です" });
    }

    const results = [];

    for (let i = 0; i < messages.length; i++) {
      const { head, body } = normalize(messages[i]);
      console.log(`[#${i}]`, head, "…");

      try {
        switch (true) {
          case head.startsWith("type"):
            results.push(await runTypeScraper(body));    break;

          case head.startsWith("マイナビ"):
            results.push(await runMainabiScraper(body)); break;

          case head.startsWith("doda"):
            results.push(await runDodaScraper(body));    break;

          case head.startsWith("en転職"):
          case head.startsWith("en"):                    // en/EN どちらでも
            results.push(await runENScraper(body));      break;

          case head.startsWith("エンゲージ"):
            results.push(await runEngageScraper(body));  break;

          default:
            results.push({ status:"skipped", index:i, message:"対象外のメッセージ" });
        }
      } catch (err) {
        results.push({ status:"error", index:i, message: err.message || String(err) });
      }
    }

    res.json(results);

  } catch (err) {
    console.error("サーバーエラー:", err);
    res.status(500).json({ status:"error", message:"内部サーバーエラーが発生しました" });
  }
});

// ---------- server ----------
app.listen(PORT, () => {
  console.log(`🚀  Server running on http://localhost:${PORT}`);
});
