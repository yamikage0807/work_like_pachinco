function parseMessage(rawText) {
  const lines = rawText.split("\n").map(l => l.trim());

  const nameLine = lines.find(l => l.includes("応募者名"));
  const jobIdLine = lines.find(l => l.includes("応募求人"));
  const loginLine = lines.find(l => l.includes("メールアドレス"));
  const passLine = lines.find(l => l.includes("パスワード"));
  const rawUrl = lines.find(l => l.includes("https://hr.type.jp/"));

  const extractValue = (line, sep) => line?.split(sep)[1]?.replace("様", "").trim();

  const name = extractValue(nameLine, "：") || extractValue(nameLine, ":");
  const jobId = extractValue(jobIdLine, "：") || extractValue(jobIdLine, ":");
  const loginId = extractValue(loginLine, ":");
  const password = extractValue(passLine, ":");

  if (!jobId || !loginId || !password) {
    console.error("❌ パース失敗", { jobIdLine, loginLine, passLine });
    throw new Error("応募メッセージの解析に失敗しました");
  }

  return {
    name,
    jobId,
    applicantId: jobId,
    applicantUrl: `https://hr.type.jp/#/applicants/${jobId}`,
    loginId,
    password
  };
}

module.exports = {
  parseMessage
};