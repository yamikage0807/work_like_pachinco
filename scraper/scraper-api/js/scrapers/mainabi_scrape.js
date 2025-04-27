const puppeteer = require("puppeteer");

async function runScraper(rawMessage) {
  const { loginId, password, applyUrl } = parseMessage(rawMessage);
  if (!loginId || !password || !applyUrl) {
    throw new Error("メッセージからログイン情報または応募URLを抽出できませんでした。");
  }

  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  try {
    await page.goto("https://tenshoku.mynavi.jp/client/", { waitUntil: "domcontentloaded" }); // 仮のURL

    await page.waitForSelector('input[name="ap_login_id"]', { timeout: 10000 });
    await page.type('input[name="ap_login_id"]', loginId);
    
    await page.waitForSelector('input[name="ap_password"]', { timeout: 10000 });
    await page.type('input[name="ap_password"]', password);
    
    // ログインボタン押す（IDを指定しているならこれ）
    await page.click('#loginBtn');
    


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
      // XPath指定で要素を取得
      function getByXPath(xpath) {
        try {
          const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          return result.singleNodeValue;
        } catch (err) {
          console.error("❌ XPathエラー:", err);
          return null;
        }
      }
      const nameEl = getByXPath('/html/body/div/div[2]/div/div[2]/main/div/div/main/div/section/div/div[2]/div[2]/dl[1]/dd[1]');
      const phoneEl = getByXPath('/html/body/div/div[2]/div/div[2]/main/div/div/main/div/section/div/div[2]/div[2]/dl[1]/dd[2]');
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
  const cleaned = rawText.replace(/\\n/g, '').replace(/\\"/g, '"').trim();

  let loginId = null;
  let password = null;
  let applyUrl = null;

  // 応募詳細URL
  const urlMatch = cleaned.match(/https:\/\/tenshoku\.mynavi\.jp\/d\/c\.cfm\/[a-zA-Z0-9]+/);
  if (urlMatch) {
    applyUrl = urlMatch[0].trim();
  }

  // メールアドレスだけ抜き出し
  const loginIdMatch = cleaned.match(/メールアドレス:\s*([^\s]+)/);
  if (loginIdMatch) {
    loginId = loginIdMatch[1];
  }

  // パスワードだけ抜き出し
  const passwordMatch = cleaned.match(/パスワード:\s*([^\s]+)/);
  if (passwordMatch) {
    password = passwordMatch[1];
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
