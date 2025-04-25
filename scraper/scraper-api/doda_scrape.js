const puppeteer = require("puppeteer");

async function runScraper(rawMessage) {
    console.log("run_scraper/duda 開始");
    const { loginUrl, loginId, password} = parseMessage(rawMessage); // parse raw message here
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    console.log("🧩 run_scraper 出力:", { loginUrl, loginId, password });

    await page.goto(loginUrl, { waitUntil: "domcontentloaded" });

    await page.type("#MailAddress", loginId);
    await page.type("#PassWd", password);
    await page.click('#LoginBtn');

    console.log("ログイン完了、SPAの描画待機");

    //await new Promise(res => setTimeout(res, 2000));
    await page.waitForSelector('#topicJobHistory', { timeout: 60000 });
    console.log("職務経歴セクションが描画されました。");

    const { nameText, phoneText } = await page.evaluate(() => {
        const nameEl = document.querySelector('[data-test="label-name"]');
        const phoneEl = document.querySelector('[data-test="mobile"]');
        return {
          nameText: nameEl?.textContent.trim() || null,
          phoneText: phoneEl?.textContent.trim() || null
        };
    });

    const resumeSectionHandle = await page.evaluateHandle(() => {
      const element = document.querySelector('#topicJobHistory');
      return element?.textContent.trim() === '職務経歴' ? element : null;
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

}

function parseMessage(rawMessage) {
  const cleaned = rawMessage.replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
  const lines = cleaned.split("\n").map(l => l.trim()).filter(Boolean);

  const loginUrlLine = lines.find(l => l.startsWith("https://assist.doda.jp"));
  const loginIdLine  = lines.find(l => l.includes("メールアドレス"));
  const passwordLine = lines.find(l => l.includes("パスワード"));

  const extractValue = (line, sep = "：") => {
    return line ? line.split(sep).pop().replace("様", "").trim() : null;
  };

  const parsed = {
    loginUrl: loginUrlLine?.trim(),
    loginId:  extractValue(loginIdLine, ":"),
    password: extractValue(passwordLine, ":"),
  };

  console.log("🧩 parse_message 出力:", parsed);
  return parsed;
}



module.exports = { runScraper, parseMessage };