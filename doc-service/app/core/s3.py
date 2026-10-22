import io
import os
import boto3
from botocore.client import Config

def get_s3_client():
    endpoint = os.getenv("S3_INTERNAL_ENDPOINT", "http://localhost:9000")
    access_key = os.getenv("S3_ACCESS_KEY", "printgoo_minio")
    secret_key = os.getenv("S3_SECRET_KEY", "printgoo_minio_secret_key")
    region = os.getenv("S3_REGION", "us-east-1")

    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name=region,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )

def upload_buffer_to_s3(buffer: io.BytesIO, bucket: str, object_key: str, content_type: str) -> str:
    s3 = get_s3_client()
    buffer.seek(0)
    s3.upload_fileobj(
        buffer,
        bucket,
        object_key,
        ExtraArgs={"ContentType": content_type},
    )
    return object_key
