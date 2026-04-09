#!/usr/bin/env python3
# ABOUT: One-time script to upload existing creature images to Cloudflare R2
# ABOUT: Run once during Phase 1 setup; safe to re-run (skips existing files)

import os
import sys
import boto3
from botocore.exceptions import ClientError
from pathlib import Path

# R2 config — all values from environment variables
ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID")
BUCKET_NAME = "qrious-specimens-images"
ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID")
SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY")

if not ACCOUNT_ID or not ACCESS_KEY_ID or not SECRET_ACCESS_KEY:
    print("Error: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY environment variables")
    print("  R2_ACCOUNT_ID is found in the Cloudflare dashboard → R2 → bucket Settings → S3 API URL")
    sys.exit(1)

ENDPOINT_URL = f"https://{ACCOUNT_ID}.r2.cloudflarestorage.com"

# Image source directory
SCRIPT_DIR = Path(__file__).parent
IMAGES_DIR = SCRIPT_DIR.parent / "downloads-claude-ship" / "qrious-images-2026-04-06"

if not IMAGES_DIR.exists():
    print(f"Error: images directory not found at {IMAGES_DIR}")
    sys.exit(1)

# Map local dirs to R2 paths
UPLOAD_DIRS = [
    (IMAGES_DIR / "original", "species/original", "image/png"),
    (IMAGES_DIR / "512",      "species/512",      "image/jpeg"),
    (IMAGES_DIR / "256",      "species/256",      "image/jpeg"),
]

s3 = boto3.client(
    "s3",
    endpoint_url=ENDPOINT_URL,
    aws_access_key_id=ACCESS_KEY_ID,
    aws_secret_access_key=SECRET_ACCESS_KEY,
    region_name="auto",
)

total = 0
skipped = 0
uploaded = 0

for local_dir, r2_prefix, content_type in UPLOAD_DIRS:
    files = list(local_dir.glob("*"))
    print(f"\n{r2_prefix}/ — {len(files)} files")

    for file_path in sorted(files):
        if file_path.name.startswith("."):
            continue

        r2_key = f"{r2_prefix}/{file_path.name}"
        total += 1

        # Check if already exists
        try:
            s3.head_object(Bucket=BUCKET_NAME, Key=r2_key)
            print(f"  skip  {r2_key}")
            skipped += 1
            continue
        except ClientError:
            pass

        # Upload
        s3.upload_file(
            str(file_path),
            BUCKET_NAME,
            r2_key,
            ExtraArgs={"ContentType": content_type},
        )
        print(f"  up    {r2_key}")
        uploaded += 1

print(f"\nDone. {uploaded} uploaded, {skipped} skipped, {total} total.")
