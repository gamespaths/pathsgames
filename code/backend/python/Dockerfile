FROM python:3.13-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY app/ ./app/

# Expose port
EXPOSE 8042

# Run with uvicorn in production mode
CMD ["uvicorn", "app.launcher:app", "--host", "0.0.0.0", "--port", "8042"]
