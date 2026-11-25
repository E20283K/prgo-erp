from typing import Any

def trunc(text: Any, max_len: int) -> str:
    s = str(text or "")
    return s[:max_len - 2] + ".." if len(s) > max_len else s
