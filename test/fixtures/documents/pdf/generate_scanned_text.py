"""Generate a synthetic image-only PDF fixture with Pillow for OCR tests."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def build_scanned_page(page_number: int) -> Image.Image:
    image = Image.new("RGB", (1800, 900), "white")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=86)
    draw.text((100, 160), "TESTE OCR SINTETICO", fill="black", font=font)
    draw.text((100, 360), f"PAGINA ESCANEADA {page_number}", fill="black", font=font)
    return image


def build_scanned_pdf(path: Path, page_count: int = 1) -> None:
    pages = [build_scanned_page(page_number) for page_number in range(1, page_count + 1)]
    pages[0].save(
        path,
        format="PDF",
        resolution=150.0,
        save_all=True,
        append_images=pages[1:],
    )


if __name__ == "__main__":
    fixture_dir = Path(__file__).parent
    build_scanned_pdf(fixture_dir / "scanned-text.v1.pdf")
    build_scanned_pdf(fixture_dir / "scanned-six-pages.v1.pdf", page_count=6)
