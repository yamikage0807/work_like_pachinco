const puppeteer = require("puppeteer");

async function runScraper(rawMessage) {
  const { loginId, password, applyUrl } = parseMessage(rawMessage);
  if (!loginId || !password || !applyUrl) {
    throw new Error("メッセージからログイン情報または応募URLを抽出できませんでした。");
  }

  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  try {
    await page.goto("https://employment.en-japan.com/company/select_service/?PK=2A3C3A", { waitUntil: "domcontentloaded" });

    // ログインIDとパスワードを入力 (セレクタは実際のサイトに合わせてください)
    await page.type('input[name="loginID"]', loginId); // 仮のセレクタ
    await page.type('input[name="password"]', password); // 仮のセレクタ
    await page.click('button[type="submit"]'); // 仮のセレクタ

    // ログイン後の遷移待機 (必要に応じて調整)
    await page.waitForNavigation({ waitUntil: "domcontentloaded" });
    console.log("✅ エンゲージログイン試行完了");

    // ログイン後の追加操作
    await page.click('/html/body/div[2]/section[1]/form/div[2]/span/input');
    console.log("✅ 最初のボタンをクリック");
    
    await new Promise(res => setTimeout(res, 1000)); // 操作間の待機
    
    await page.click('/html/body/div[1]/div/div[2]/label');
    console.log("✅ 2番目のボタンをクリック");
    
    await new Promise(res => setTimeout(res, 1000)); // 操作間の待機
    
    await page.click('/html/body/div[2]/div[3]/div/div[1]/div[2]/div[2]/table/tbody/tr/td[4]/a');
    console.log("✅ 応募者情報リンクをクリック");

    // 応募者情報ページへの遷移待機
    await page.waitForNavigation({ waitUntil: "domcontentloaded" });
    console.log("✅ 応募者情報ページに遷移");

    // 描画待機 (SPAなどの場合、適切な待機処理を追加)
    await new Promise(res => setTimeout(res, 3000)); // 3秒待機 (調整が必要)

    // 応募者情報の取得 (セレクタは実際のサイトに合わせてください)
    const applicantInfo = await page.evaluate(() => {
      // 例: 応募者名と電話番号を取得するセレクタ (実際のサイトに合わせてください)
      const nameEl = document.querySelector('/html/body/div[6]/div/div[2]/div[1]/div[2]/em/ruby'); // 仮のセレクタ
      // TODO: 電話番号のセレクタをどうするか？
      const phoneEl = document.querySelector('/html/body/div/div[2]/div/div[2]/main/div/div/main/div/section/div/div[2]/div[2]/dl[2]/dd[1]/text()'); // 仮のセレクタ
      return {
        nameText: nameEl?.textContent.trim() || null,
        phoneText: phoneEl?.textContent.trim() || null
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
      phone: applicantInfo.phoneText // 電話番号がない場合は null
    };

  } catch (err) {
    console.error("❌ エンゲージスクレイピングエラー:", err.message);
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
    } else if (line.startsWith("https://en-gage.net/company/manage/?apply_id=")) {
      applyUrl = line;
    }
  }

  // 面談者情報などは現時点では利用しない
  console.log("🧩 エンゲージ parse_message 出力:", { loginId, password, applyUrl });
  return { loginId, password, applyUrl };
}

if (require.main === module) {
  // FastAPI連携時の標準入力引数からメッセージを受け取る
  const input = process.argv[2];

  try {
    const rawMessage = JSON.parse(input);
    runScraper(rawMessage).then(result => {
      // 🔵 FastAPI 側で受け取るデータ（stdout）
      process.stdout.write(JSON.stringify(result));
    }).catch(err => {
      // 🔴 エラー処理は runScraper 内で行い stdout に出力される
      process.stdout.write(JSON.stringify({ status: "error", message: err.message }));
      process.exit(0); // エラーでもFastAPI側で処理を続けるため正常終了扱い
    });
  } catch (err) {
    // JSONパース失敗時
    process.stdout.write(JSON.stringify({ status: "error", message: err.message }));
    process.exit(0);
  }
}

module.exports = { runScraper, parseMessage };
