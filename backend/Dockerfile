FROM python:3.12-slim
WORKDIR /srv
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY pyproject.toml ./
COPY app ./app
# Migrations (rodadas manualmente: alembic upgrade head) precisam estar na imagem.
COPY alembic.ini ./
COPY alembic ./alembic
RUN pip install --no-cache-dir . && useradd -m appuser
USER appuser
EXPOSE 8000
# Atrás do proxy do EasyPanel: defina FORWARDED_ALLOW_IPS para o uvicorn confiar no X-Forwarded-For.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
