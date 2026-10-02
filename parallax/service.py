"""FastAPI microservice wrapping DepthFlow: images -> 3D parallax videos.

The Studio never calls this service from the browser: it proxies /health and
/render server-side over the docker internal network (see web/src/app/api/
parallax/*). That keeps the service private — no public domain, no CORS.

`depthflow` (and the torch stack it pulls in) is imported lazily, inside the
functions that need it, so the module stays importable — and the request
validation stays testable — without those heavy, GPU-oriented dependencies.
"""

import asyncio
import logging
import os
import shutil
import tempfile
import zipfile
from pathlib import Path
from typing import Annotated

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response

_log_level_name = os.getenv("LOG_LEVEL", "WARNING").upper()
_log_level = getattr(logging, _log_level_name, logging.WARNING)
logging.basicConfig(level=_log_level)
logging.getLogger("uvicorn").setLevel(_log_level)
logging.getLogger("uvicorn.access").setLevel(_log_level)
logging.getLogger("uvicorn.error").setLevel(_log_level)

app = FastAPI(title="parallax-service", version="0.1.0")

# Serialize GPU work (renders and depth estimates alike): the depth model + GPU
# can only handle one at a time.
_render_lock: asyncio.Semaphore = asyncio.Semaphore(1)

# The depth estimator is expensive to build (loads a torch model), so the /depth
# endpoint keeps one around between requests. Populated lazily inside the
# executor, guarded by _render_lock, so no extra locking is needed here.
_estimator = None

ANIMATIONS = ("circle", "horizontal", "vertical", "zoom", "dolly", "orbital")
FPS_CHOICES = (24, 30, 60)
HEIGHT_CHOICES = (720, 1080, 1440, 1920)
SSAA_CHOICES = (1.0, 1.5, 2.0)


def _build_scene(animation: str, intensity: float):
    """Construct the DepthScene subclass. Imported here so the module loads
    (and the endpoint validates) without depthflow/torch installed."""
    import math as _math

    from attrs import define
    from depthflow.scene import DepthScene

    @define
    class ParallaxScene(DepthScene):
        """DepthScene subclass implementing the official animation presets."""

        animation: str = "circle"
        intensity: float = 0.5

        def update(self) -> None:
            """Drive camera state each frame, mirroring depthflow's presets."""
            i = self.intensity
            # Amplitude scale so intensity=0.5 reproduces the official presets.
            k = 2.0 * i
            cycle = self.cycle

            if self.animation == "circle":
                self.state.isometric = 0.60
                self.state.steady = 0.30
                self.state.offset = (
                    k * 0.50 * _math.sin(cycle + _math.pi / 2.0),
                    k * 0.50 * _math.sin(cycle),
                )
            elif self.animation == "horizontal":
                self.state.isometric = 0.60
                self.state.steady = 0.30
                self.state.offset = (k * 0.80 * _math.sin(cycle), 0.0)
            elif self.animation == "vertical":
                self.state.isometric = 0.60
                self.state.steady = 0.30
                self.state.offset = (0.0, k * 0.80 * _math.sin(cycle))
            elif self.animation == "zoom":
                self.state.height = 0.8 * (_math.sin(cycle / 2.0) ** 2.0)
            elif self.animation == "dolly":
                self.state.height = 0.30
                self.state.steady = 0.35
                self.state.focus = 0.35
                self.state.zoom = 0.95
                self.state.isometric = 0.5 * (1.0 - _math.cos(cycle))
            elif self.animation == "orbital":
                self.state.steady = 0.30
                self.state.focus = 0.30
                self.state.zoom = 0.98
                self.state.isometric = 0.50 * _math.cos(cycle) + 0.75
                self.state.offset = (k * 0.50 * _math.sin(cycle), 0.0)
            else:  # pragma: no cover - guarded by request validation
                raise ValueError(f"Unknown animation: {self.animation}")

    return ParallaxScene(backend="headless", animation=animation, intensity=intensity)


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

    from depthflow.state import DepthState

    scene = _build_scene(animation, intensity)
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


def _estimate_depth_png(image: Path) -> bytes:
    """Estimate the depthmap for one image and encode it as a grayscale PNG.

    This is the exact estimator DepthFlow feeds into the render, so the live
    preview built from this map matches what /render will produce — only the
    ffmpeg encode is skipped, which is the slow part. The map is min-max
    normalised to the full 0..255 range so faint depth still reads in the
    browser; near planes stay bright (high value), matching DepthFlow's own
    convention (and its invert_depth flag, which the client mirrors).
    """
    global _estimator

    import imageio.v3 as imageio
    import numpy as np

    if _estimator is None:
        from depthflow.scene import DepthScene

        _estimator = DepthScene(backend="headless").estimator

    array = imageio.imread(image)
    depth = np.asarray(_estimator.estimate(array), dtype=np.float32)
    lo = float(depth.min()) if depth.size else 0.0
    hi = float(depth.max()) if depth.size else 0.0
    norm = (depth - lo) / (hi - lo) if hi > lo else np.zeros_like(depth)
    gray = (norm * 255.0).round().astype(np.uint8)
    return imageio.imwrite("<bytes>", gray, extension=".png")


@app.get("/health")
async def health() -> dict:
    """Liveness probe with the wrapped DepthFlow version (if importable)."""
    try:
        import depthflow

        version = depthflow.__version__
    except Exception:  # pragma: no cover - depthflow absent in test/dev
        version = None
    return {"status": "ok", "depthflow": version}


@app.post("/depth")
async def depth(
    image: Annotated[UploadFile, File(description="A single input image")],
) -> Response:
    """Estimate a depthmap and return it as a grayscale PNG.

    Powers the Studio's live parallax preview: the browser fetches this once per
    image, then animates a depth-displacement in WebGL against the same camera
    presets as /render. No video is encoded here, so it answers in a fraction of
    a full render — the customisation loop never has to wait on ffmpeg.
    """
    loop = asyncio.get_running_loop()
    async with _render_lock:
        workdir = Path(tempfile.mkdtemp(prefix="parallax-depth-"))
        try:
            suffix = Path(image.filename or "image.png").suffix or ".png"
            target = workdir / f"input{suffix}"
            with open(target, "wb") as fh:
                shutil.copyfileobj(image.file, fh)
            png = await loop.run_in_executor(None, _estimate_depth_png, target)
        finally:
            shutil.rmtree(workdir, ignore_errors=True)

    return Response(content=png, media_type="image/png")


@app.post("/render")
async def render(
    background_tasks: BackgroundTasks,
    image: Annotated[list[UploadFile], File(description="One or more input images")],
    animation: Annotated[str, Form()] = "circle",
    intensity: Annotated[float, Form(ge=0.1, le=1.0)] = 0.5,
    time: Annotated[float, Form(ge=2.0, le=20.0)] = 5.0,
    # These arrive as multipart strings; declaring them as int/float lets
    # FastAPI coerce them (a numeric Literal would reject the string and 422),
    # then the allowed set is checked explicitly below.
    fps: Annotated[int, Form()] = 30,
    height_px: Annotated[int, Form()] = 1080,
    ssaa: Annotated[float, Form()] = 1.0,
    invert_depth: Annotated[bool, Form()] = False,
) -> FileResponse:
    """Render parallax videos: one mp4 if a single image, else a zip of mp4s."""
    if not image:
        raise HTTPException(status_code=422, detail="At least one image is required")
    if animation not in ANIMATIONS:
        raise HTTPException(
            status_code=422, detail=f"animation must be one of {', '.join(ANIMATIONS)}"
        )
    if fps not in FPS_CHOICES:
        raise HTTPException(status_code=422, detail="fps must be 24, 30 or 60")
    if height_px not in HEIGHT_CHOICES:
        raise HTTPException(
            status_code=422, detail="height_px must be 720, 1080, 1440 or 1920"
        )
    if ssaa not in SSAA_CHOICES:
        raise HTTPException(status_code=422, detail="ssaa must be 1, 1.5 or 2")

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
