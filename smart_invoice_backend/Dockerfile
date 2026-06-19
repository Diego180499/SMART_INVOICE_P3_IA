# ── Imagen base ────────────────────────────────────────────────
FROM python:3.11-slim

# Evita prompts de apt y mejora el comportamiento de Python en contenedor
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DEBIAN_FRONTEND=noninteractive

# ── Dependencias del sistema (OCR, PDF, OpenCV + deps Chromium) ─
RUN apt-get update && apt-get install -y --no-install-recommends \
    # OCR
    tesseract-ocr \
    tesseract-ocr-spa \
    tesseract-ocr-eng \
    # PDF → imagen
    poppler-utils \
    # OpenCV
    libgl1 \
    libglib2.0-0 \
    # Chromium / Playwright (dependencias manuales)
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libasound2 \
    libx11-6 \
    libxext6 \
    libxcb1 \
    fonts-liberation \
    fonts-unifont \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Dependencias Python ────────────────────────────────────────
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Navegador para RPA (sin --with-deps: las deps ya están instaladas arriba)
RUN playwright install chromium

# ── Código de la aplicación ────────────────────────────────────
COPY . .

RUN mkdir -p uploads reports

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
