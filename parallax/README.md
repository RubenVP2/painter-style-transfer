# parallax-service

FastAPI microservice wrapping [DepthFlow](https://github.com/Bing-Guo/DepthFlow):
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

| Variable | Default | Role |
|---|---|---|
| `PARALLAX_ALLOWED_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Comma-separated CORS origins — the domains the Studio is opened from. The browser calls this service directly, so a deployed Studio domain has to be listed here. |

## curl examples

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

Health check:

```bash
curl http://localhost:8100/health
```
