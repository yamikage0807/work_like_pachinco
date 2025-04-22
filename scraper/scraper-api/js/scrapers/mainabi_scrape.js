const puppeteer = require("puppeteer");

async function runScraper(rawMessage) {
  const { loginId, password, applyUrl } = parseMessage(rawMessage);
  if (!loginId || !password || !applyUrl) {
    throw new Error("メッセージからログイン情報または応募URLを抽出できませんでした。");
  }

  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  try {
    // マイナビ転職の企業ログインページにアクセス (URLは要確認)
    // 例: await page.goto("https://tenshoku.mynavi.jp/company/login/", { waitUntil: "domcontentloaded" });
    // 正確なログインページのURLに置き換えてください
    await page.goto("https://tenshoku.mynavi.jp/client/", { waitUntil: "domcontentloaded" }); // 仮のURL

    // ログインIDとパスワードを入力 (セレクタは実際のサイトに合わせてください)
    await page.type('#loginId', loginId); // 仮のセレクタ (ID用)
    await page.type('#password', password); // 仮のセレクタ (パスワード用)
    await page.click('button[type="submit"]'); // 仮のセレクタ (ログインボタン用)

    // ログイン後の遷移待機 (必要に応じて調整)
    await page.waitForNavigation({ waitUntil: "domcontentloaded" });
    console.log("✅ マイナビログイン試行完了");

    // 応募データ詳細URLに遷移
    await page.goto(applyUrl, { waitUntil: "domcontentloaded" });
    console.log(`✅ 応募詳細ページ (${applyUrl}) に遷移`);


    // 描画待機 (SPAなどの場合、適切な待機処理を追加)
    await new Promise(res => setTimeout(res, 3000)); // 3秒待機 (調整が必要)

    // 応募者情報の取得 (セレクタは実際のサイトに合わせてください)
    const applicantInfo = await page.evaluate(() => {
      // 例: 応募者名と電話番号を取得するセレクタ (実際のサイトに合わせてください)
      const nameEl = document.querySelector(".applicant-profile-name"); // 仮のセレクタ
      // 電話番号のセレクタも同様に見つける必要があります
      const phoneEl = document.querySelector(".applicant-profile-phone"); // 仮のセレクタ
      return {
        nameText: nameEl?.textContent.trim() || null,
        phoneText: phoneEl?.textContent.trim() || null // 電話番号がなければ null
      };
    });

    if (!applicantInfo.nameText) {
       console.warn("⚠️ 応募者名が取得できませんでした。セレクタを確認してください。");
       // スクリーンショットは撮る
    }
     console.log("👤 取得した応募者情報:", applicantInfo);


    // スクリーンショット（Base64で返却）
    const buffer = await page.screenshot({ fullPage: true });
    const base64 = buffer.toString("base64");

    return {
      status: "success",
      screenshot: base64,
      mimeType: "image/png",
      name: applicantInfo.nameText,
      phone: applicantInfo.phoneText
    };

  } catch (err) {
    console.error("❌ マイナビスクレイピングエラー:", err.message);
    // エラー時にもスクリーンショットを試みる (デバッグ用)
    try {
      const buffer = await page.screenshot({ fullPage: true });
      const base64 = buffer.toString("base64");
       process.stdout.write(JSON.stringify({
         status: "error",
         message: err.message,
         screenshot: base64, // エラー時のスクリーンショット
         mimeType: "image/png"
       }));
    } catch (screenShotError) {
       console.error("❌ エラー時のスクリーンショット取得失敗:", screenShotError);
       process.stdout.write(JSON.stringify({ status: "error", message: err.message }));
    }
    process.exit(0); // エラーでもFastAPI側で処理を続けるため正常終了扱い

  } finally {
    await browser.close();
  }
}

function parseMessage(rawText) {
  const cleaned = rawText.replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
  const lines = cleaned.split("\n").map(l => l.trim()).filter(Boolean);

  let loginId = null;
  let password = null;
  let applyUrl = null;

  for (const line of lines) {
    if (line.startsWith("メールアドレス:")) {
      loginId = line.split(":")[1]?.trim();
    } else if (line.startsWith("パスワード:")) {
      password = line.split(":")[1]?.trim();
    } else if (line.startsWith("https://tenshoku.mynavi.jp/d/c.cfm/")) {
      applyUrl = line;
    }
  }

  console.log("🧩 マイナビ parse_message 出力:", { loginId, password, applyUrl });
  return { loginId, password, applyUrl };
}

if (require.main === module) {
  // FastAPI連携時の標準入力引数からメッセージを受け取る
  const input = process.argv[2];
  if (!input) {
    console.error("❌ 入力データがありません。");
    process.exit(1);
  }
  let rawMessage;
  try {
    rawMessage = JSON.parse(input);
  } catch (err) {
    console.error("❌ 入力データのJSONパースに失敗:", err);
    process.stdout.write(JSON.stringify({ status: "error", message: "入力データのJSONパースに失敗しました" }));
    process.exit(0);
  }

  runScraper(rawMessage).then(result => {
    // 🔵 FastAPI 側で受け取るデータ（stdout）
    process.stdout.write(JSON.stringify(result));
  }).catch(err => {
    // 🔴 エラー処理は runScraper 内で行い stdout に出力される
    console.error("❌ runScraper でキャッチされなかったエラー:", err);
    process.stdout.write(JSON.stringify({ status: "error", message: err.message }));
    process.exit(0);
  });
}

module.exports = { runScraper, parseMessage };
