from fastapi import FastAPI
from pydantic import BaseModel
import subprocess
import json

from fastapi.middleware.cors import CORSMiddleware


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # セキュリティを強化したい場合は ["http://localhost:5500"] などに限定
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ パース関数
def parse_message(raw_text: str) -> dict:
    # 改行や余分な文字を取り除く
    cleaned = raw_text.replace('\\n', '\n').replace('\\"', '"').strip()
    lines = [line.strip() for line in cleaned.split("\n") if line.strip()]

    name_line = next((l for l in lines if "応募者名" in l), "")
    job_id_line = next((l for l in lines if "応募求人：" in l), "")
    login_line = next((l for l in lines if "メールアドレス" in l), "")
    password_line = next((l for l in lines if "パスワード" in l), "")

    def extract_value(line, sep="："):
        return line.split(sep)[-1].replace("様", "").strip() if line else None

    parsed = {
        "name": extract_value(name_line),
        "jobId": extract_value(job_id_line),
        "loginId": extract_value(login_line, sep=":"),
        "password": extract_value(password_line, sep=":"),
    }

    print("🧩 parse_message 出力:", parsed)
    return parsed

# ✅ リクエスト形式定義
class MessageRequest(BaseModel):
    messages: list[str]

# ✅ POSTエンドポイント
@app.post("/scrape")
async def scrape_handler(req: MessageRequest):
    results = []
    for i, message in enumerate(req.messages):
        try:
            parsed = parse_message(message)
            input_json = json.dumps(parsed)

            result = subprocess.run(
                ["node", "scrape.js", input_json],
                capture_output=True,
                text=True,
                timeout=30
            )

            try:
                # 標準出力をJSONとして読み取る
                data = json.loads(result.stdout.strip())
                results.append(data)
            except json.JSONDecodeError:
                raise Exception(f"stdout is not valid JSON: {result.stdout.strip()}")

        except Exception as e:
            results.append({
                "status": "error",
                "index": i,
                "message": str(e)
            })

    return results
