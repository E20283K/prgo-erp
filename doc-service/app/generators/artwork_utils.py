"""Loads order artwork (data URLs, ERP public paths, remote URLs) for the PDF generators."""

import base64
import os
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, Optional

_EMPTY_ARTWORK_DOCS_CACHE: Dict[str, float] = {}

def probe_artwork_url(doc_no: str, s_code: str, side: str = "front", sku_id: str = "") -> Optional[str]:
    import time
    global _EMPTY_ARTWORK_DOCS_CACHE

    clean_doc = str(doc_no).strip()
    safe_wo = clean_doc.replace("/", "_").replace("\\", "_")
    clean_code = str(s_code).strip().upper()
    clean_sku = str(sku_id).strip()
    side_clean = side.strip().lower()

    # 1. Fast local disk probe (0.01ms - zero network overhead)
    local_roots = [
        "/app/public/artwork",
        os.path.join(os.path.dirname(__file__), "..", "..", "public", "artwork"),
        os.path.join(os.getcwd(), "public", "artwork"),
        "public/artwork",
    ]
    for root in local_roots:
        if os.path.isdir(root):
            wo_dir = os.path.join(root, safe_wo)
            if not os.path.isdir(wo_dir):
                return None
            try:
                files = os.listdir(wo_dir)
                c_sku_l = clean_sku.lower()
                c_code_l = clean_code.lower()
                match_targets = []
                if c_sku_l:
                    match_targets.append(f"{c_sku_l}-{side_clean}")
                if c_code_l and c_code_l != "ALL":
                    match_targets.append(f"{c_code_l}-{side_clean}")
                match_targets.append(side_clean)

                for target in match_targets:
                    for fn in files:
                        fn_l = fn.lower()
                        if target in fn_l and (fn_l.endswith(".pdf") or fn_l.endswith(".svg") or fn_l.endswith(".png") or fn_l.endswith(".jpg")):
                            return f"/artwork/{safe_wo}/{fn}"
                return None
            except Exception:
                return None

    # 2. Fast cache for negative lookups (avoids 1000+ repeated network attempts for missing orders)
    now = time.time()
    if clean_doc in _EMPTY_ARTWORK_DOCS_CACHE:
        if now - _EMPTY_ARTWORK_DOCS_CACHE[clean_doc] < 60.0:
            return None
        del _EMPTY_ARTWORK_DOCS_CACHE[clean_doc]

    # 3. Targeted remote HTTP probe with ThreadPoolExecutor (max 4 concurrent requests)
    candidates = []
    if clean_sku:
        candidates.append(f"/artwork/{clean_doc}/{clean_sku}-{side_clean}.pdf")
        if clean_code and clean_code != "ALL":
            candidates.append(f"/artwork/{clean_doc}/{clean_sku}-{clean_code}-{side_clean}.pdf")
    if clean_code and clean_code != "ALL":
        candidates.append(f"/artwork/{clean_doc}/{clean_code}-{side_clean}.pdf")
    candidates.append(f"/artwork/{clean_doc}/{side_clean}.pdf")
    candidates.append(f"/artwork/{clean_doc}/{side_clean}.svg")

    base_url = os.getenv("ERP_URL") or "http://host.docker.internal:3000"
    import urllib.request

    def _check_cand(cand: str) -> Optional[str]:
        try:
            req = urllib.request.Request(f"{base_url}{cand}", headers={"User-Agent": "PrintGoo-DocService"}, method="HEAD")
            with urllib.request.urlopen(req, timeout=0.4) as resp:
                if resp.status == 200:
                    return cand
        except Exception:
            pass
        return None

    with ThreadPoolExecutor(max_workers=min(4, len(candidates))) as executor:
        for res in executor.map(_check_cand, candidates):
            if res:
                return res

    _EMPTY_ARTWORK_DOCS_CACHE[clean_doc] = now
    return None

def get_raw_artwork(src: Optional[str]) -> Optional[Dict[str, Any]]:
    if not src or not isinstance(src, str):
        return None
    try:
        if src.startswith("data:application/pdf") or (";base64," in src and "pdf" in src[:30].lower()):
            _, body = src.split(",", 1)
            pdf_bytes = base64.b64decode(body)
            return {"kind": "pdf", "bytes": pdf_bytes, "source": src}
        elif src.startswith("data:image"):
            header, body = src.split(",", 1)
            if "svg" in header:
                svg_bytes = base64.b64decode(body) if ";base64" in header else body.encode("utf-8")
                return {"kind": "svg", "bytes": svg_bytes, "source": src}
            else:
                img_bytes = base64.b64decode(body)
                if img_bytes.startswith(b"%PDF"):
                    return {"kind": "pdf", "bytes": img_bytes, "source": src}
                return {"kind": "image", "bytes": img_bytes, "source": src}
        elif src.startswith("/"):
            # Check local disk first (0.1ms read)
            safe_clean = src.lstrip("/")
            local_roots = [
                "/app/public",
                os.path.join(os.path.dirname(__file__), "..", "..", "public"),
                os.path.join(os.getcwd(), "public"),
                "public",
            ]
            for root in local_roots:
                lp = os.path.join(root, safe_clean)
                if os.path.exists(lp) and os.path.isfile(lp):
                    try:
                        with open(lp, "rb") as f:
                            data = f.read()
                        if data.startswith(b"%PDF") or lp.lower().endswith(".pdf"):
                            return {"kind": "pdf", "bytes": data, "source": src}
                        elif lp.lower().endswith(".svg") or b"<svg" in data[:100]:
                            return {"kind": "svg", "bytes": data, "source": src}
                        else:
                            return {"kind": "image", "bytes": data, "source": src}
                    except Exception as e:
                        print(f"Error reading local artwork file ({lp}): {e}", flush=True)
                        break

            # Fallback to single primary remote host via HTTP
            base_url = os.getenv("ERP_URL") or "http://host.docker.internal:3000"
            import urllib.request
            try:
                full_url = f"{base_url}{src}"
                req = urllib.request.Request(full_url, headers={"User-Agent": "PrintGoo-DocService"})
                with urllib.request.urlopen(req, timeout=2.0) as resp:
                    if resp.status == 200:
                        data = resp.read()
                        if data.startswith(b"%PDF") or src.lower().endswith(".pdf"):
                            return {"kind": "pdf", "bytes": data, "source": src}
                        elif src.lower().endswith(".svg") or b"<svg" in data[:100]:
                            return {"kind": "svg", "bytes": data, "source": src}
                        else:
                            return {"kind": "image", "bytes": data, "source": src}
            except Exception as e:
                print(f"Failed to fetch remote artwork ({src}): {e}", flush=True)
        elif src.startswith("http://") or src.startswith("https://"):
            import urllib.request
            rewritten_src = src.replace("localhost:3000", "host.docker.internal:3000").replace("127.0.0.1:3000", "host.docker.internal:3000")
            req = urllib.request.Request(rewritten_src, headers={"User-Agent": "PrintGoo-DocService"})
            with urllib.request.urlopen(req, timeout=3) as resp:
                data = resp.read()
                if data.startswith(b"%PDF") or src.lower().endswith(".pdf"):
                    return {"kind": "pdf", "bytes": data, "source": src}
                elif src.lower().endswith(".svg") or b"<svg" in data[:100]:
                    return {"kind": "svg", "bytes": data, "source": src}
                else:
                    return {"kind": "image", "bytes": data, "source": src}
    except Exception as e:
        print(f"Failed to fetch raw artwork ({src}): {e}", flush=True)
    return None
