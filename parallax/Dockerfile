FROM python:3.12-slim

# ffmpeg is required by DepthFlow's video export; libgomp1 is needed by torch
# wheels, libegl1 + libgl1 by the headless (moderngl) rendering backend.
# Works on linux/amd64 and arm64.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libgomp1 libegl1 libgl1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# The deploy host is CPU-only (headless llvmpipe, no GPU). DepthFlow moves its
# depth model to torch.accelerator.current_accelerator(), which the default
# CUDA torch wheel reports as "cuda" even with no GPU present, crashing the
# render in torch._C._cuda_init(). Install CPU-only torch/torchvision so torch
# reports no accelerator and DepthFlow falls back to CPU (also a much smaller
# image). Both are unpinned DepthFlow deps, so pin both to the CPU index to
# stop the CUDA build being pulled back in transitively.
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu \
        torch torchvision

COPY pyproject.toml service.py ./
RUN pip install --no-cache-dir .

EXPOSE 8100

CMD ["uvicorn", "service:app", "--host", "0.0.0.0", "--port", "8100"]
