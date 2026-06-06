FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV VISIONOPS_DB_PATH=/app/data/visionops.db
ENV VISIONOPS_SAMPLE_DATA_DIR=/app/sample_data
ENV VISIONOPS_UPLOAD_DIR=/app/data/uploads

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend/app /app/app
COPY sample_data /app/sample_data

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

