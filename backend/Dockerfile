FROM python:3.11-slim

# Prevent Python from writing .pyc and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=10000

# Install OS libraries required for OpenCV, MediaPipe (libgles2, libegl1, libgl1), and PostgreSQL client
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libgles2 \
    libegl1 \
    libglib2.0-0 \
    ffmpeg \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY . /app/

# Create uploads directory
RUN mkdir -p /app/uploads

EXPOSE 10000

# Start server using Gunicorn binding to Render's 10000 port with live logging
CMD ["sh", "-c", "gunicorn --workers 1 --timeout 180 --access-logfile - --error-logfile - --bind 0.0.0.0:${PORT:-10000} run:app"]
