const puppeteer = require("puppeteer");

async function runScraper(rawMessage) {
    console.log("run_scraper/duda 開始");
    const { loginUrl, loginId, password} = parseMessage(rawMessage); // parse raw message here
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    console.log("🧩 run_scraper 出力:", { loginUrl, loginId, password });

    await page.goto(loginUrl, { waitUntil: "domcontentloaded" });

    await page.type("#MailAddress", loginId);
    await page.type("#PassWd", password);
    await page.click('#LoginBtn');

    console.log("ログイン完了、SPAの描画待機");
    await page.waitForFunction(() => {
      const spinner = document.querySelector('.blockUI');
      const promo = document.querySelector('#autoThanksPromotionDialog');
      const spinnerGone = !spinner || spinner.offsetParent === null;
      const promoHidden = promo && promo.hasAttribute('hidden');
      return spinnerGone && promoHidden;
    }, { timeout: 60000 });
    
    console.log("✅ ローディング + ダイアログが消えました");
    
    //await new Promise(res => setTimeout(res, 2000));
    await page.waitForSelector('#topicJobHistory', { timeout: 60000 });

    console.log("職務経歴セクションが描画されました。");

    const { nameText, phoneText } = await page.evaluate(() => {
      const nameEl = document.querySelector('#fullName');
    
      const phoneText = (() => {
        const phoneDivs = Array.from(document.querySelectorAll('.fontSize12'));
        const phoneEl = phoneDivs.find(div => div.textContent.includes("電話番号"));
        if (!phoneEl) return null;
        const match = phoneEl.textContent.match(/0\d{9,10}/);
        return match ? match[0] : null;
      })();
    
      return {
        nameText: nameEl?.textContent.trim() || null,
        phoneText
      };
    });
    

    const resumeSectionHandle = await page.$('.jobCareerDetailTitle'); // ← h2の親をターゲット

    if (!resumeSectionHandle) throw new Error("職務経歴セクションが見つかりません");


    const boundingBox = await resumeSectionHandle.boundingBox();
    if (!boundingBox) throw new Error("職務経歴セクションの位置を取得できません");

    const pageHeight = await page.evaluate(() => document.body.scrollHeight);

    const buffer = await page.screenshot({
      clip: {
        x: 0,
        y: boundingBox.y + boundingBox.height ,
        width: 1000, // または明示的に設定した viewport width
        height: pageHeight - (boundingBox.y + boundingBox.height)
      }
    });
      
      const base64 = buffer.toString("base64");

      await browser.close();
  
      return {
        status: "success",
        screenshot: base64,
        mimeType: "image/png",
        name: nameText,
        phone: phoneText
      };

}

function parseMessage(rawMessage) {
    const cleaned = rawMessage.replace(/\\n/g, '').replace(/\\"/g, '"').trim();
  
    const extractBetween = (text, startKey, endKey) => {
      const start = text.indexOf(startKey);
      if (start === -1) return null;
      const afterStart = start + startKey.length;
      const end = text.indexOf(endKey, afterStart);
      if (end === -1) {
        return text.slice(afterStart).trim();
      }
      return text.slice(afterStart, end).trim();
    };
  
    const loginUrl = (() => {
      const urlMatch = cleaned.match(/https:\/\/assist\.doda\.jp\/[^\s]+/);
      return urlMatch ? urlMatch[0].trim() : null;
    })();
  
    const loginId = extractBetween(cleaned, "メールアドレス:", "パスワード")?.trim();
    const password = extractBetween(cleaned, "パスワード:", "面談者")?.trim();
  
    const parsed = {
      loginUrl,
      loginId,
      password,
    };
  
    console.log("🧩 parse_message 出力:", parsed);
    return parsed;
  }
  



module.exports = { runScraper, parseMessage };