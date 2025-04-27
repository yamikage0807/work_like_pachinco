const puppeteer = require("puppeteer");

async function runScraper(rawMessage) {
  const { loginId, password, name } = parseMessage(rawMessage); // parse raw message here
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  try {
    //typeのログインページにアクセス
    await page.goto("https://hr.type.jp/#/", { waitUntil: "domcontentloaded" });

    await page.type("#loginId", loginId);
    await page.type("#loginPassword", password);
    await page.click('[data-test="login-button"]');

    //ログイン完了、SPAの描画待機(待機時間動的にしたいけどうまくいかなかったのでこのまま)
    await new Promise(res => setTimeout(res, 2000));

    //応募者一覧のページに遷移
    await page.goto("https://hr.type.jp/#/applicants", { waitUntil: "domcontentloaded" });
    await new Promise(res => setTimeout(res, 2000));

    //応募者名で探索
    const applicantLink = await page.evaluate((targetName) => {
      const normalize = str => str.replace(/\s+/g, "").trim(); // 空白除去
      const rows = Array.from(document.querySelectorAll("tr"));
    
      for (const row of rows) {
        if (normalize(row.textContent).includes(normalize(targetName))) {
          const link = row.querySelector("a[href*='/applicants/']");
          return link?.getAttribute("href") || null;
        }
      }
      return null;
    }, name);    

    if (!applicantLink) throw new Error("応募者詳細ページが見つかりません");

    const detailUrl = `https://hr.type.jp${applicantLink}`;
    //応募者詳細ページへ遷移
    await page.goto(detailUrl, { waitUntil: "domcontentloaded" });
    await new Promise(res => setTimeout(res, 2000));

    const { nameText, phoneText } = await page.evaluate(() => {
      const nameEl = document.querySelector('[data-test="label-name"]');
      const phoneEl = document.querySelector('[data-test="mobile"]');
      return {
        nameText: nameEl?.textContent.trim() || null,
        phoneText: phoneEl?.textContent.trim() || null
      };
    });

    // スクリーンショット（職務経歴書部分から下）
    const resumeSectionHandle = await page.evaluateHandle(() => {
      const elements = Array.from(document.querySelectorAll('div.boss-resume-sheet-title'));
      return elements.find(el => el.textContent.trim() === '職務経歴書') || null;
    });

    if (!resumeSectionHandle) throw new Error("職務経歴書セクションが見つかりません");

    const boundingBox = await resumeSectionHandle.boundingBox();
    if (!boundingBox) throw new Error("職務経歴書セクションの位置を取得できません");

    const pageHeight = await page.evaluate(() => document.body.scrollHeight);

    const buffer = await page.screenshot({
      clip: {
        x: 0,
        y: boundingBox.y + boundingBox.height - 50, // Start below the section
        width: page.viewport().width,
        height: pageHeight - (boundingBox.y + boundingBox.height) // Capture until the end of the page
      }
    });

    const base64 = buffer.toString("base64");

    return {
      status: "success",
      screenshot: base64,
      mimeType: "image/png",
      name: nameText,
      phone: phoneText
    };

  } catch (err) {
    console.error("❌ エラー:", err.message);
    throw err;
  } finally {
    await browser.close();
  }
}

function parseMessage(rawText) {
    // まず無駄なエスケープだけ除去
    const cleaned = rawText.replace(/\\n/g, '').replace(/\\"/g, '"').trim();
  
    // 値を切り出す関数
    const extractBetween = (text, startKey, endKey) => {
      const start = text.indexOf(startKey);
      if (start === -1) return null;
      const afterStart = start + startKey.length;
      const end = text.indexOf(endKey, afterStart);
      if (end === -1) {
        return text.slice(afterStart).trim(); // 終端が見つからないなら最後まで
      }
      return text.slice(afterStart, end).trim();
    };
  
    const name = extractBetween(cleaned, "応募者名：", "応募求人：")?.replace("様", "").trim();
    const jobId = extractBetween(cleaned, "応募求人：", "ITエンジニア")?.trim(); // 職種名の前で区切る
    const loginId = extractBetween(cleaned, "メールアドレス:", "パスワード")?.trim();
    const password = extractBetween(cleaned, "パスワード:", "面談者")?.trim();
  
    const parsed = {
      name,
      jobId,
      loginId,
      password,
    };
  
    console.log("🧩 parse_message 出力:", parsed);
    return parsed;
  }
  

if (require.main === module) {
  const input = process.argv[2];

  try {
    const parsed = JSON.parse(input);
    parsed.name = "南延香"; 
    runScraper(parsed).then(result => {
      // 🔵 FastAPI 側で受け取るデータ（stdout）
      process.stdout.write(JSON.stringify(result));
    }).catch(err => {
      // 🔴 FastAPI 側には error オブジェクトを stdout で返す
      process.stdout.write(JSON.stringify({ status: "error", message: err.message }));
      process.exit(0); // 明示的に 0 を返すことで「正常終了」扱いに
    });
  } catch (err) {
    // 🔴 パース失敗時も stdout に JSON を出す
    process.stdout.write(JSON.stringify({ status: "error", message: err.message }));
    process.exit(0);
  }
}

module.exports = { runScraper, parseMessage };