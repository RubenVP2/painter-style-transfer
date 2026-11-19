# parallax-service

FastAPI microservice wrapping [DepthFlow](https://github.com/BrokenSource/DepthFlow):
turns static images into 3D parallax videos (H.264 mp4).

## Endpoints

### `GET /health`

```json
{ "status": "ok", "depthflow": "1.0.1" }
```

### `POST /render`

Multipart form:

| Field         | Type              | Default   | Description                                  |
|---------------|-------------------|-----------|----------------------------------------------|
| `image`       | file (repeatable) | required  | One or more input images                     |
| `animation`   | string            | `circle`  | `circle` \| `horizontal` \| `vertical` \| `zoom` \| `dolly` \| `orbital` |
| `intensity`   | float             | `0.5`     | Offset amplitude, 0.1–1.0                    |
| `time`        | float (seconds)   | `5`       | Video length, 2–20 s                         |
| `fps`         | int               | `30`      | `24` \| `30` \| `60`                         |
| `height_px`   | int               | `1080`    | `720` \| `1080` \| `1440` \| `1920`          |
| `ssaa`        | float             | `1`       | `1` \| `1.5` \| `2`                          |
| `invert_depth`| bool              | `false`   | Invert the estimated depthmap               |

Response:
- 1 image → `video/mp4`
- N images → `application/zip` with one mp4 per image

Renders are serialized (`asyncio.Semaphore(1)`).

### `POST /depth`

Multipart form with a single `image` field. Runs only the depth estimator (the
same one `/render` feeds) and returns the depthmap as a grayscale `image/png`,
min-max normalised, near planes bright.

This is the cheap half of a render — no ffmpeg — so the Studio's **live preview**
can fetch it once per image and animate a WebGL depth-displacement in real time,
against the same camera presets as `/render`. The customisation loop never waits
on a full render; `/render` is only called once the settings are dialled in.

Serialized on the same GPU lock as `/render`.

## Run

With the rest of the stack, from the repository root:

```bash
docker compose up --build parallax
```

Or on its own:

```bash
docker build -t parallax-service ./parallax
docker run -p 8100:8100 parallax-service
```

Build works on `linux/amd64` and `linux/arm64`.

## Configuration

None. The browser never calls this service directly — the Studio proxies
`/api/parallax/*` to it server-side over the docker internal network — so there
is no CORS to configure and no public domain to expose. The Studio finds it via
its own `PARALLAX_INTERNAL_URL` (see the repository's compose files), not the
other way around.

## Tests

The request/response path is covered without depthflow/torch (the render is
stubbed), so the suite runs anywhere:

```bash
pip install -e '.[test]'
pytest
```

## curl examples

The service also answers directly (handy for debugging when its port is
published locally):

Single image (circle, defaults):

```bash
curl -f http://localhost:8100/render -F image=@photo.jpg -o parallax.mp4
```

Custom animation and options:

```bash
curl -f http://localhost:8100/render \
  -F image=@photo.jpg \
  -F animation=orbital \
  -F intensity=0.7 \
  -F time=8 \
  -F fps=60 \
  -F height_px=1440 \
  -F ssaa=1.5 \
  -F invert_depth=false \
  -o parallax.mp4
```

Multiple images → zip:

```bash
curl -f http://localhost:8100/render \
  -F image=@a.jpg -F image=@b.jpg -F animation=dolly \
  -o parallax.zip
```

Depthmap only (drives the live preview):

```bash
curl -f http://localhost:8100/depth -F image=@photo.jpg -o depth.png
```

Health check:

```bash
curl http://localhost:8100/health
```
