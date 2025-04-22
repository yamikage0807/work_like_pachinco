const puppeteer = require("puppeteer");

async function runScraper(rawMessage) {
  const { loginId, password, applyUrl } = parseMessage(rawMessage);
  if (!loginId || !password || !applyUrl) {
    throw new Error("メッセージからログイン情報または応募URLを抽出できませんでした。");
  }

  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  try {
    // エンゲージのログインページにアクセス (直接応募URLに行く前にログインが必要な場合を想定)
    // 必要に応じてログインページのURLに変更してください
    await page.goto("https://en-gage.net/company/login/", { waitUntil: "domcontentloaded" });

    // ログインIDとパスワードを入力 (セレクタは実際のサイトに合わせてください)
    await page.type('input[name="login_id"]', loginId); // 仮のセレクタ
    await page.type('input[name="password"]', password); // 仮のセレクタ
    await page.click('button[type="submit"]'); // 仮のセレクタ

    // ログイン後の遷移待機 (必要に応じて調整)
    await page.waitForNavigation({ waitUntil: "domcontentloaded" });

    // 応募内容の閲覧用URLに遷移
    await page.goto(applyUrl, { waitUntil: "domcontentloaded" });

    // 描画待機 (SPAなどの場合、適切な待機処理を追加)
    await new Promise(res => setTimeout(res, 3000)); // 3秒待機 (調整が必要)

    // 応募者情報の取得 (セレクタは実際のサイトに合わせてください)
    const applicantInfo = await page.evaluate(() => {
      // 例: 応募者名と電話番号を取得するセレクタ (実際のサイトに合わせてください)
      const nameEl = document.querySelector(".applicant-name"); // 仮のセレクタ
      const phoneEl = document.querySelector(".applicant-phone"); // 仮のセレクタ
      return {
        nameText: nameEl?.textContent.trim() || null,
        phoneText: phoneEl?.textContent.trim() || null
      };
    });

    if (!applicantInfo.nameText) {
       console.warn("⚠️ 応募者名が取得できませんでした。セレクタを確認してください。");
       // スクリーンショットは撮る
    }

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
  // テスト用の入力データ (実際のメッセージ形式に合わせてください)
  const testMessage = `
エンゲージよりエンジニアのミカタに応募がありました。

━━━━━━━━━━━━━━━━━

【 応募職種 】

ITエンジニア ◤年収UP＆理想の働き方を実現◢ フルリモ可／還元率最大90%／副業OK

【 応募内容の閲覧用URL 】

https://en-gage.net/company/manage/?apply_id=DUMMY_APPLY_ID

※閲覧にはID、パスワードが必要です。


━━━━━━━━━━━━━━━━━

【ログイン情報】
メールアドレス: test@example.com
パスワード: testpassword
面談者 小熊
 https://timerex.net/s/s.koguma_d39e/4c2d38e0
`;

  // 引数から入力を受け取る場合 (FastAPI連携時)
  // const input = process.argv[2];
  // const rawMessage = input ? JSON.parse(input) : testMessage; // JSON形式で渡される想定

  const rawMessage = testMessage; // テスト用メッセージを直接使用

  runScraper(rawMessage).then(result => {
    // 🔵 FastAPI 側で受け取るデータ（stdout）
    console.log("✅ スクレイピング成功");
    // 結果が大きい場合があるのでファイルに書き出すか、必要な情報だけ表示
    // process.stdout.write(JSON.stringify(result));
    if (result.screenshot) {
      console.log("Screenshot:", result.screenshot.substring(0, 100) + "..."); // 先頭のみ表示
    }
     console.log("Name:", result.name);
     console.log("Phone:", result.phone);

  }).catch(err => {
    // 🔴 エラー処理は runScraper 内で行い stdout に出力される
    console.error("❌ runScraper でキャッチされなかったエラー:", err);
    process.exit(1); // ここでエラー終了させる場合
  });
}

module.exports = { runScraper, parseMessage };
