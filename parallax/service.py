"""FastAPI microservice wrapping DepthFlow: images -> 3D parallax videos."""

import asyncio
import math
import os
import shutil
import tempfile
import zipfile
from pathlib import Path
from typing import Annotated, Literal

import depthflow
from attrs import define
from depthflow.scene import DepthScene
from depthflow.state import DepthState
from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

app = FastAPI(title="parallax-service", version="0.1.0")

# The Studio (Next.js) lives on another origin; without this the browser blocks
# both the /health probe and the /render response on real cross-origin setups.
# Deployments serve the Studio from their own domain, so the list is read from
# PARALLAX_ALLOWED_ORIGINS (comma-separated) and falls back to the local ports.
DEFAULT_ALLOWED_ORIGINS = ("http://localhost:3000", "http://127.0.0.1:3000")

allowed_origins = [
    origin.strip()
    for origin in os.environ.get("PARALLAX_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
] or list(DEFAULT_ALLOWED_ORIGINS)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serialize renders: the depth model + GPU can only handle one at a time.
_render_lock: asyncio.Semaphore = asyncio.Semaphore(1)

Animation = Literal["circle", "horizontal", "vertical", "zoom", "dolly", "orbital"]


@define
class ParallaxScene(DepthScene):
    """DepthScene subclass implementing the official animation presets."""

    animation: str = "circle"
    intensity: float = 0.5

    def update(self) -> None:
        """Drive camera state each frame, mirroring depthflow's examples/presets."""
        i = self.intensity
        # Amplitude scale so that intensity=0.5 reproduces the official presets.
        k = 2.0 * i
        cycle = self.cycle

        if self.animation == "circle":
            self.state.isometric = 0.60
            self.state.steady = 0.30
            self.state.offset = (
                k * 0.50 * math.sin(cycle + math.pi / 2.0),
                k * 0.50 * math.sin(cycle),
            )
        elif self.animation == "horizontal":
            self.state.isometric = 0.60
            self.state.steady = 0.30
            self.state.offset = (k * 0.80 * math.sin(cycle), 0.0)
        elif self.animation == "vertical":
            self.state.isometric = 0.60
            self.state.steady = 0.30
            self.state.offset = (0.0, k * 0.80 * math.sin(cycle))
        elif self.animation == "zoom":
            self.state.height = 0.8 * (math.sin(cycle / 2.0) ** 2.0)
        elif self.animation == "dolly":
            self.state.height = 0.30
            self.state.steady = 0.35
            self.state.focus = 0.35
            self.state.zoom = 0.95
            self.state.isometric = 0.5 * (1.0 - math.cos(cycle))
        elif self.animation == "orbital":
            self.state.steady = 0.30
            self.state.focus = 0.30
            self.state.zoom = 0.98
            self.state.isometric = 0.50 * math.cos(cycle) + 0.75
            self.state.offset = (k * 0.50 * math.sin(cycle), 0.0)
        else:  # pragma: no cover - guarded by request validation
            raise ValueError(f"Unknown animation: {self.animation}")


def _render_batch(
    workdir: Path,
    images: list[Path],
    animation: str,
    intensity: float,
    time: float,
    fps: float,
    height: int,
    ssaa: float,
    invert_depth: bool,
) -> list[Path]:
    """Render one parallax video per input image; returns the mp4 paths."""
    import numpy as np

    scene = ParallaxScene(backend="headless", animation=animation, intensity=intensity)
    scene.ffmpeg.h264(preset="veryfast")

    outputs: list[Path] = []
    for image in images:
        # Fresh state per image, as in depthflow's examples/batch.py.
        scene.state = DepthState()

        if invert_depth:
            # Estimate then invert the depthmap ourselves, since DepthState
            # has no invert flag.
            import imageio.v3 as imageio

            array = imageio.imread(image)
            depth = scene.estimator.estimate(array)
            depth = np.asarray(depth, dtype=np.float32)
            peak = float(depth.max()) if depth.size else 0.0
            if peak > 0.0:
                depth = peak - depth
            scene.input(image=image, depth=depth)
        else:
            scene.input(image=image)

        output = workdir / f"{image.stem}.mp4"
        scene.main(
            output=output,
            time=time,
            fps=fps,
            ssaa=ssaa,
            height=height,
            width=None,  # keep the input image's aspect ratio
        )
        outputs.append(output)
    return outputs


@app.get("/health")
async def health() -> dict:
    """Liveness probe with the wrapped DepthFlow version."""
    return {"status": "ok", "depthflow": depthflow.__version__}


@app.post("/render")
async def render(
    background_tasks: BackgroundTasks,
    image: Annotated[list[UploadFile], File(description="One or more input images")],
    animation: Annotated[Animation, Form()] = "circle",
    intensity: Annotated[float, Form(ge=0.1, le=1.0)] = 0.5,
    time: Annotated[float, Form(ge=2.0, le=20.0)] = 5.0,
    fps: Annotated[Literal[24, 30, 60], Form()] = 30,
    height_px: Annotated[Literal[720, 1080, 1440, 1920], Form()] = 1080,
    ssaa: Annotated[Literal[1, 1.5, 2], Form()] = 1,
    invert_depth: Annotated[bool, Form()] = False,
) -> FileResponse:
    """Render parallax videos: one mp4 if a single image, else a zip of mp4s."""
    if not image:
        raise HTTPException(status_code=422, detail="At least one image is required")

    loop = asyncio.get_running_loop()
    async with _render_lock:
        workdir = Path(tempfile.mkdtemp(prefix="parallax-"))
        try:
            # Persist uploads first; DepthFlow takes paths/arrays, not streams.
            saved: list[Path] = []
            for upload in image:
                suffix = Path(upload.filename or "image.png").suffix or ".png"
                target = workdir / f"input-{len(saved)}{suffix}"
                with open(target, "wb") as fh:
                    shutil.copyfileobj(upload.file, fh)
                saved.append(target)

            videos = await loop.run_in_executor(
                None,
                lambda: _render_batch(
                    workdir=workdir,
                    images=saved,
                    animation=animation,
                    intensity=intensity,
                    time=time,
                    fps=float(fps),
                    height=int(height_px),
                    ssaa=float(ssaa),
                    invert_depth=invert_depth,
                ),
            )
        except Exception:
            shutil.rmtree(workdir, ignore_errors=True)
            raise

    # Cleanup once the response body has been streamed.
    background_tasks.add_task(shutil.rmtree, workdir, ignore_errors=True)

    if len(videos) == 1:
        return FileResponse(videos[0], media_type="video/mp4", filename=videos[0].name)

    zip_path = workdir / "parallax-videos.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_STORED) as zf:
        for video in videos:
            zf.write(video, video.name)
    return FileResponse(zip_path, media_type="application/zip", filename=zip_path.name)
