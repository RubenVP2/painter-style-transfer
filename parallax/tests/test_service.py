"""Request-validation tests for the parallax service.

These run without depthflow/torch: `_render_batch` is monkeypatched to write a
stub mp4 so the FastAPI request/response path can be exercised on any machine.

The `browser_form_*` cases are the regression for the 422 the service used to
return on every render — multipart form values arrive as strings, and the
`fps`/`height_px`/`ssaa` fields were once numeric `Literal`s that rejected them.
"""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import service

# A tiny but valid PNG header is all the (stubbed) render needs.
PNG = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"


@pytest.fixture
def client(monkeypatch):
    """A TestClient whose render writes stub mp4s instead of calling depthflow."""

    def fake_render_batch(*, workdir: Path, images, **_kwargs):
        outputs = []
        for image in images:
            out = workdir / f"{image.stem}.mp4"
            out.write_bytes(b"\x00\x00\x00\x18ftypisom")
            outputs.append(out)
        return outputs

    monkeypatch.setattr(service, "_render_batch", fake_render_batch)
    return TestClient(service.app)


def _browser_form():
    """Exactly what the Studio's FormData sends: every value a string."""
    return {
        "animation": "circle",
        "intensity": "0.4",
        "time": "6",
        "fps": "30",
        "height_px": "1080",
        "ssaa": "1",
        "invert_depth": "false",
    }


def _one_image():
    return [("image", ("wallpaper.png", PNG, "image/png"))]


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_browser_form_single_image_returns_mp4(client):
    response = client.post("/render", data=_browser_form(), files=_one_image())
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "video/mp4"


@pytest.mark.parametrize("ssaa", ["1", "1.5", "2"])
def test_ssaa_choices_accepted(client, ssaa):
    response = client.post(
        "/render", data={**_browser_form(), "ssaa": ssaa}, files=_one_image()
    )
    assert response.status_code == 200, response.text


def test_defaults_only_image(client):
    """No settings at all: the endpoint defaults must be valid, not 422."""
    response = client.post("/render", files=_one_image())
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "video/mp4"


def test_multiple_images_returns_zip(client):
    files = [
        ("image", ("a.png", PNG, "image/png")),
        ("image", ("b.png", PNG, "image/png")),
    ]
    response = client.post("/render", data=_browser_form(), files=files)
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "application/zip"


@pytest.mark.parametrize(
    "field,value",
    [("fps", "99"), ("height_px", "800"), ("ssaa", "3"), ("animation", "spin")],
)
def test_invalid_choice_rejected(client, field, value):
    response = client.post(
        "/render", data={**_browser_form(), field: value}, files=_one_image()
    )
    assert response.status_code == 422, response.text


def test_missing_image_rejected(client):
    response = client.post("/render", data=_browser_form())
    assert response.status_code == 422
