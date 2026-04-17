FROM python:3.11-slim

WORKDIR /app

# System deps for psycopg2 and file handling
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc curl \
    && rm -rf /var/lib/apt/lists/*

# Create temp dir for file downloads
RUN mkdir -p /tmp/ogd_files && chmod 777 /tmp/ogd_files

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import redis; r=redis.from_url('${REDIS_URL}'); r.ping()" || exit 1

CMD ["python", "-u", "worker.py"]
