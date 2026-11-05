"""Generate a small synthetic PDF fixture without external dependencies."""

from pathlib import Path


def text(value: str, x: int, y: int, size: int = 11) -> bytes:
    assert value.isascii()
    escaped = value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    return f"BT /F1 {size} Tf 1 0 0 1 {x} {y} Tm ({escaped}) Tj ET\n".encode("ascii")


def page_one() -> bytes:
    parts = [
        text("TABELA DE OFERTAS", 72, 780, 15),
        text("Curso", 72, 740),
        text("Campus", 280, 740),
        text("Vagas", 450, 740),
        text("Matematica", 72, 715),
        text("Joao Pessoa", 280, 715),
        text("20", 450, 715),
        text("Fisica", 72, 690),
        text("Sousa", 280, 690),
        text("12", 450, 690),
        text("CRONOGRAMA", 72, 635, 15),
        text("Etapa", 72, 600),
        text("Inicio", 280, 600),
        text("Fim", 450, 600),
        text("Inscricao", 72, 575),
        text("01/03/2027", 280, 575),
        text("10/03/2027", 450, 575),
        text("Resultado", 72, 550),
        text("20/03/2027", 280, 550),
        text("20/03/2027", 450, 550),
    ]
    return b"".join(parts)


def page_two() -> bytes:
    return text("ANEXO A", 72, 780, 15) + text("Prazo de recurso", 72, 740) + text(
        "21/03/2027", 280, 740
    )


def stream(content: bytes) -> bytes:
    return f"<< /Length {len(content)} >>\nstream\n".encode("ascii") + content + b"endstream"


def build_pdf() -> bytes:
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R 5 0 R 7 0 R] /Count 3 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 9 0 R >> >> /Contents 4 0 R >>",
        stream(page_one()),
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 9 0 R >> >> /Contents 6 0 R >>",
        stream(page_two()),
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 9 0 R >> >> /Contents 8 0 R >>",
        stream(b""),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    output = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for index, object_body in enumerate(objects, start=1):
        offsets.append(len(output))
        output.extend(f"{index} 0 obj\n".encode("ascii"))
        output.extend(object_body)
        output.extend(b"\nendobj\n")
    xref_offset = len(output)
    output.extend(f"xref\n0 {len(offsets)}\n0000000000 65535 f \n".encode("ascii"))
    for offset in offsets[1:]:
        output.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    output.extend(
        f"trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n".encode(
            "ascii"
        )
    )
    return bytes(output)


if __name__ == "__main__":
    Path(__file__).with_name("table-schedule.v1.pdf").write_bytes(build_pdf())
