FROM python:3.12-slim

# ffmpeg is required by DepthFlow's video export; libgomp1 is needed by torch
# wheels, libegl1 + libgl1 by the headless (moderngl) rendering backend.
# Works on linux/amd64 and arm64.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libgomp1 libegl1 libgl1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml service.py ./
RUN pip install --no-cache-dir .

EXPOSE 8100

CMD ["uvicorn", "service:app", "--host", "0.0.0.0", "--port", "8100"]
