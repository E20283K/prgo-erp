"""
Temporary caching and file storage for Flexo label imposition jobs.
Stores uploaded PDFs and generated outputs with TTL cleanup (default 2 hours).
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger("imposition.cache")

# Default TTL: 90 days (7776000 seconds) - Flexo print jobs must persist for active production
DEFAULT_TTL_SECONDS = int(os.getenv("IMPOSITION_CACHE_TTL_SECONDS", str(90 * 86400)))

def _get_default_cache_dir() -> Path:
    env_dir = os.getenv("IMPOSITION_CACHE_DIR")
    if env_dir:
        p = Path(env_dir)
        p.mkdir(parents=True, exist_ok=True)
        return p
    app_cache = Path(__file__).resolve().parent.parent / "cache" / "imposition"
    try:
        app_cache.mkdir(parents=True, exist_ok=True)
        return app_cache
    except Exception:
        fallback = Path(tempfile.gettempdir()) / "printgoo-imposition"
        fallback.mkdir(parents=True, exist_ok=True)
        return fallback

DEFAULT_CACHE_DIR = _get_default_cache_dir()


class ImpositionCache:
    def __init__(self, base_dir: Optional[Path] = None, ttl_seconds: int = DEFAULT_TTL_SECONDS) -> None:
        self.base_dir = Path(base_dir) if base_dir else DEFAULT_CACHE_DIR
        self.ttl_seconds = ttl_seconds
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def cleanup_expired(self) -> int:
        """Removes job folders that are older than ttl_seconds."""
        now = time.time()
        removed_count = 0
        try:
            for item in self.base_dir.iterdir():
                if not item.is_dir():
                    continue
                try:
                    meta_path = item / "meta.json"
                    if meta_path.exists():
                        with open(meta_path, "r", encoding="utf-8") as f:
                            data = json.load(f)
                        created_at = float(data.get("created_at", item.stat().st_mtime))
                    else:
                        created_at = item.stat().st_mtime

                    if (now - created_at) > self.ttl_seconds:
                        shutil.rmtree(item, ignore_errors=True)
                        removed_count += 1
                except Exception as ex:
                    logger.warning(f"Error checking expired job {item}: {ex}")
        except Exception as ex:
            logger.warning(f"Error listing cache directory {self.base_dir}: {ex}")
        return removed_count

    def create_job(self, original_filename: str, file_bytes: bytes, job_id: Optional[str] = None) -> str:
        jid, _ = self.create_job_multi([(original_filename, file_bytes)], job_id=job_id)
        return jid

    def create_job_multi(self, files: List[Tuple[str, bytes]], job_id: Optional[str] = None) -> Tuple[str, List[Path]]:
        """
        Creates a job directory with one or multiple source PDF files.
        If job_id is provided, reuses/restores that job ID.
        Returns (job_id, list_of_saved_source_paths).
        """
        self.cleanup_expired()
        clean_id = Path(job_id).name if job_id else f"job-{uuid.uuid4().hex[:12]}"
        job_dir = self.base_dir / clean_id
        job_dir.mkdir(parents=True, exist_ok=True)
        (job_dir / "out").mkdir(parents=True, exist_ok=True)
        (job_dir / "source_previews").mkdir(parents=True, exist_ok=True)
        src_files_dir = job_dir / "source_files"
        src_files_dir.mkdir(parents=True, exist_ok=True)

        saved_paths: List[Path] = []
        filenames: List[str] = []

        for idx, (fname, fbytes) in enumerate(files):
            clean_name = Path(fname).name.replace(" ", "_")
            if not clean_name.lower().endswith(".pdf"):
                clean_name = f"{clean_name}.pdf"
            target_path = src_files_dir / f"{idx}_{clean_name}"
            target_path.write_bytes(fbytes)
            saved_paths.append(target_path)
            filenames.append(fname)
            # Save first file as source.pdf for backwards compatibility
            if idx == 0:
                (job_dir / "source.pdf").write_bytes(fbytes)

        summary_name = (
            filenames[0]
            if len(filenames) == 1
            else (", ".join(filenames) if len(filenames) <= 3 else f"{len(filenames)} ta fayl")
        )

        meta = {
            "job_id": clean_id,
            "original_filename": summary_name,
            "filenames": filenames,
            "created_at": time.time(),
            "status": "analyzed",
        }
        meta_path = job_dir / "meta.json"
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2)

        return clean_id, saved_paths

    def get_job_dir(self, job_id: str) -> Path:
        # Sanitize job_id
        clean_id = Path(job_id).name
        job_dir = self.base_dir / clean_id
        if job_dir.exists() and job_dir.is_dir():
            return job_dir
            
        # Fallback 1: check persistent /app/cache/imposition
        app_cache = Path("/app/cache/imposition") / clean_id
        if app_cache.exists() and app_cache.is_dir():
            return app_cache

        # Fallback 2: check legacy OS temp directory
        tmp_dir = Path(tempfile.gettempdir()) / "printgoo-imposition" / clean_id
        if tmp_dir.exists() and tmp_dir.is_dir():
            return tmp_dir

        raise FileNotFoundError(f"Job not found or expired: {clean_id}")

    def get_source_pdf_paths(self, job_id: str) -> List[Path]:
        """Returns all source PDF paths for the job."""
        job_dir = self.get_job_dir(job_id)
        src_files_dir = job_dir / "source_files"
        if src_files_dir.exists() and src_files_dir.is_dir():
            pdfs = sorted(src_files_dir.glob("*.pdf"))
            if pdfs:
                return pdfs
        src = job_dir / "source.pdf"
        if src.exists():
            return [src]
        raise FileNotFoundError(f"No source PDFs found for job: {job_id}")

    def get_source_pdf_path(self, job_id: str) -> Path:
        paths = self.get_source_pdf_paths(job_id)
        return paths[0]

    def get_meta(self, job_id: str) -> Dict[str, Any]:
        job_dir = self.get_job_dir(job_id)
        meta_path = job_dir / "meta.json"
        if not meta_path.exists():
            return {}
        with open(meta_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def update_meta(self, job_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        job_dir = self.get_job_dir(job_id)
        meta_path = job_dir / "meta.json"
        current: Dict[str, Any] = {}
        if meta_path.exists():
            with open(meta_path, "r", encoding="utf-8") as f:
                current = json.load(f)
        current.update(updates)
        current["updated_at"] = time.time()
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(current, f, indent=2)
        return current

    def get_safe_file_path(self, job_id: str, filename: str) -> Path:
        """
        Safely retrieves a file path within a job directory, preventing path traversal attacks.
        Supports fuzzy name matching (handling URL encodings, spaces vs underscores, [Master_PDF] prefixes,
        and design index suffixes e.g. _04.pdf).
        """
        import re
        import urllib.parse

        job_dir = self.get_job_dir(job_id).resolve()
        
        candidates: List[str] = [filename]
        decoded = urllib.parse.unquote(filename)
        if decoded != filename:
            candidates.append(decoded)
            
        extra: List[str] = []
        for c in list(candidates):
            extra.append(c.replace(" ", "_"))
            extra.append(c.replace("_", " "))
            extra.append(c.replace("[Master_PDF]_", ""))
            extra.append(c.replace("[Master PDF]_", ""))
            extra.append(c.replace("[Master_PDF] ", ""))
            extra.append(c.replace("[Master PDF] ", ""))
            extra.append(f"[Master_PDF]_{c}")
            extra.append(f"[Master PDF] {c}")
        candidates.extend(extra)
        
        search_dirs = [
            job_dir,
            job_dir / "source_previews",
            job_dir / "out",
            job_dir / "source_files",
        ]
        
        for cand in candidates:
            cand_clean = Path(cand).name
            for sdir in search_dirs:
                if not sdir.exists():
                    continue
                p = (sdir / cand_clean).resolve()
                if str(p).startswith(str(job_dir)) and p.exists() and p.is_file():
                    return p
                    
        # Index-based matching: e.g. looking for _04.pdf or _04.png
        suffix_match = re.search(r'_0?(\d+)\.(pdf|png)$', filename, re.IGNORECASE)
        if suffix_match:
            idx_num = suffix_match.group(1).zfill(2)
            ext = suffix_match.group(2).lower()
            for sdir in [job_dir / "source_previews", job_dir / "out", job_dir / "source_files"]:
                if not sdir.exists():
                    continue
                for f in sdir.glob(f"*{ext}"):
                    if f.name.endswith(f"_{idx_num}.{ext}") or f.name.endswith(f"_{int(idx_num)}.{ext}"):
                        resolved = f.resolve()
                        if str(resolved).startswith(str(job_dir)):
                            return resolved

        raise FileNotFoundError(f"File not found: {filename}")


# Singleton cache instance
imposition_cache = ImpositionCache()
