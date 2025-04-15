export default function parseMessage(rawText) {
  const lines = rawText.split("\n").map(l => l.trim());

  return {
    name: extractValue(lines, "応募者名"),
    loginId: extractValue(lines, "メールアドレス"),
    password: extractValue(lines, "パスワード")
  }
}

function extractValue(lines, keyword) {
  for (const line of lines) {
    if (line.includes(keyword)) {
      // 「:」または「：」で分割
      const parts = line.split(/[:]|[：]/);
      if (parts.length > 1) {
        // 「様」がある場合は削除
        return parts[1].trim().replace("様", "");
      }
    }
  }
  return null;
}