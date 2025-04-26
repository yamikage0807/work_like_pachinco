const puppeteer = require("puppeteer");

async function runScraper(rawMessage) {
  console.log("run_scraper/EN 開始");
  const { loginUrl, loginId, password, userId } = parseMessage(rawMessage);
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // ログインページへ遷移
  // ログイン後セッション確立までは普通に操作
  await page.goto("https://employment.en-japan.com/company_login/auth/login/", { waitUntil: "domcontentloaded" });
    console.log("ログイン画面に遷移");

    await page.type('[name="loginID"]', loginId);
    await page.type('[name="password"]', password);
    await page.click('[value="ログイン"]');
    console.log("ログイン情報入力してクリック");

    // ❌ NG: await page.waitForNavigation();
    // ⭕ OK: ログイン後の特定要素（たとえば会社名が表示されるヘッダーなど）を待つ
    await page.waitForSelector('[alt="エン転職"]');  // ← ここ適当にトップページにあるものにする
    console.log("✅ ログイン成功（セッション同期開始）");

    // 少し待ってセッションを安定させる
    await new Promise(res => setTimeout(res, 1000));

    // ログイン後ページ確認
    const currentUrl = page.url();
    console.log("🧭 ログイン後のURL:", currentUrl);

    // サービス選択画面にいる場合
    if (currentUrl.includes("/select_service/")) {
        console.log("🛠 サービス選択画面を検出。左側のサービスを自動選択します");
    
        // ✅ 左側の「サイトTOPへ」ボタンをクリック（input[type="submit"]）
        const leftButton = await page.$('form input[type="submit"][value="サイトTOPへ"]');
        if (leftButton) {
        await Promise.all([
            page.waitForNavigation({ waitUntil: "domcontentloaded" }),
            leftButton.click()
        ]);
        console.log("✅ サイトTOPに遷移しました");
        } else {
        throw new Error("❌ サービス選択ボタンが見つかりませんでした");
        }
    }
    
    // アドレスバー直打ち再現
    await page.evaluate(url => {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_self';
    document.body.appendChild(a);
    a.click();
    }, loginUrl);

    console.log("アドレスバー直打ち再現");

    // そしてナビゲーション待ち
    await page.waitForNavigation({ waitUntil: "domcontentloaded" });
    console.log("✅ 応募者詳細ページに遷移成功");

    // ページを開いた直後、または職務経歴スクショ前に挿入
    //await resumePage.setViewport({ width: 1400, height: 1200 });
    //console.log("🖥 ビューポートを拡大しました");


    // 応募者詳細画面で履歴書リンクを取得
    const resumeUrl = await page.$eval('td.name a', el => el.href);
    console.log("📄 履歴書URL:", resumeUrl);

    // 新しいタブで履歴書ページを開く
    const resumePage = await browser.newPage();
    await resumePage.goto(resumeUrl, { waitUntil: "domcontentloaded" });
    console.log("✅ 履歴書ページを新しいタブで開きました");

    // 氏名行からテキストを取得
    const nameRaw = await resumePage.$eval('.profileArea tr:nth-child(1) .dataSet', el => el.textContent.trim());
    const name = nameRaw.split("／")[0].trim(); // 氏名だけにする

    // 電話・メールの行から両方取得
    const contactRaw = await resumePage.$eval('.profileArea tr:nth-child(3) .dataSet', el => el.textContent);
    const phoneMatch = contactRaw.match(/0\d{1,4}-\d{1,4}-\d{3,4}/);

    const phone = phoneMatch ? phoneMatch[0] : null;

    console.log("👤 氏名:", name);
    console.log("📞 電話番号:", phone);

    await resumePage.setViewport({ width: 1000, height: 1200 }); // 👈 画面サイズを広げる

    // subtitle（職務経歴）の要素を取得
    const subtitleHandle = await resumePage.$('.contents .subTitle');
    if (!subtitleHandle) throw new Error("❌ 『職務経歴』の見出しが見つかりません");

    await new Promise(res => setTimeout(res, 300));

    const boundingBox = await subtitleHandle.boundingBox();
    if (!boundingBox) throw new Error("❌ boundingBoxが取得できません");

    const viewport = resumePage.viewport();

    // ページ全体の高さを取得
    const fullHeight = await resumePage.evaluate(() => document.body.scrollHeight);

    // スクリーンショットのclip範囲（職務経歴の下から最後まで）
    const buffer = await resumePage.screenshot({
    clip: {
        x: 0,
        y: boundingBox.y + boundingBox.height,
        width: viewport.width,
        height: fullHeight - (boundingBox.y + boundingBox.height)
    }
    });

    const base64 = buffer.toString("base64");
    console.log("📸 職務経歴以下をスクリーンショットに成功しました！");

    return {
        status: "success",
        screenshot: base64,
        mimeType: "image/png",
        name: name,
        phone: phone
    };
  
}

function parseMessage(rawMessage) {
  const cleaned = rawMessage.replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();

  const loginUrlMatch = cleaned.match(/https:\/\/employment\.en-japan\.com\/company\/appcontrol\/applicant_desc\/\?ApplyID=\d+/);
  const loginUrl = loginUrlMatch ? loginUrlMatch[0] : null;

  const loginIdMatch = cleaned.match(/メールアドレス: ?([^\s]+)/);
  const loginId = loginIdMatch ? loginIdMatch[1] : null;

  const passwordMatch = cleaned.match(/パスワード: ?([^\s]+)/);
  const password = passwordMatch ? passwordMatch[1] : null;

  const userIdMatch = cleaned.match(/【 会員ID 】 ?(\d+)/);
  const userId = userIdMatch ? userIdMatch[1] : null;

  const parsed = {
    loginUrl,
    loginId,
    password,
    userId
  };

  console.log("🧩 parse_message 出力:", parsed);
  return parsed;
}

module.exports = { runScraper, parseMessage };
