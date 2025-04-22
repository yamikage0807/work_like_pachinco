import re

def parse_message(message: str) -> dict:
    # メールの本文からログインIDやパスワード、応募者名を抽出
    lines = message.split("\n")

    def extract(keywords):
        for line in lines:
            for kw in keywords:
                if kw in line:
                    parts = re.split("：|:", line)
                    if len(parts) > 1:
                        return parts[1].strip().replace("様", "")
        return None

    return {
        "loginId": extract(["メールアドレス"]),
        "password": extract(["パスワード"]),
        "name": extract(["応募者名"])
    }
