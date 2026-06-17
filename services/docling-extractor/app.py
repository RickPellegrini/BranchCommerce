from __future__ import annotations

import io
import re
import tempfile
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from docling.document_converter import DocumentConverter

app = FastAPI(title="BranchCommerce Docling Supplier Extractor")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

converter = DocumentConverter()


def normalize_number(value: str) -> float | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    raw = re.sub(r"[R$r$\s]", "", raw)
    normalized = raw.replace(".", "").replace(",", ".") if "," in raw else raw
    try:
        parsed = float(normalized)
    except ValueError:
        return None
    return parsed


def normalize_gtin(value: str) -> str:
    return re.sub(r"\D", "", str(value or "")).strip()


def normalize_text(value: str) -> str:
    return str(value or "").strip()


def rows_to_text(rows: list[dict[str, Any]]) -> str:
    if not rows:
        return ""
    header = "codigo\tdescricao\tgtin\tcusto"
    lines = [
        f"{row['code']}\t{row['name']}\t{row['gtin']}\t{row['cost']:.2f}"
        for row in rows
    ]
    return "\n".join([header, *lines])


def normalize_candidate_row(record: dict[str, Any]) -> dict[str, Any] | None:
    code = normalize_text(record.get("code") or record.get("codigo") or record.get("sku"))
    name = normalize_text(
        record.get("name")
        or record.get("nome")
        or record.get("descricao")
        or record.get("descrição")
        or record.get("produto")
    )
    gtin = normalize_gtin(
        record.get("gtin")
        or record.get("ean")
        or record.get("gtin/ean")
        or record.get("barcode")
    )
    cost = normalize_number(
        record.get("cost")
        or record.get("custo")
        or record.get("preco")
        or record.get("preço")
    )
    if not name or not gtin or cost is None:
        return None
    return {"code": code, "name": name, "gtin": gtin, "cost": cost}


def extract_rows_from_markdown(markdown: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    for line in markdown.splitlines():
        normalized = re.sub(r"\s+", " ", line).strip(" |")
        if not normalized:
            continue
        match = re.match(r"^(\d+)\s+(.+?)\s+(\d{8,14})\s+(?:R\$\s*)?(\d+[.,]\d{2})$", normalized)
        if not match:
            continue
        cost = normalize_number(match.group(4))
        if cost is None:
            continue
        rows.append(
            {
                "code": match.group(1),
                "name": match.group(2).strip(),
                "gtin": match.group(3),
                "cost": cost,
            }
        )

    if rows:
        return rows

    table_lines = [line for line in markdown.splitlines() if "|" in line]
    if len(table_lines) < 2:
        return []

    headers = [normalize_text(cell).lower() for cell in table_lines[0].strip().strip("|").split("|")]
    body_lines = table_lines[2:] if len(table_lines) > 2 else table_lines[1:]

    def find_index(*names: str) -> int:
        for idx, header in enumerate(headers):
            if header in names:
                return idx
        return -1

    code_index = find_index("codigo", "código", "cod", "sku")
    name_index = find_index("descricao", "descrição", "produto", "nome")
    gtin_index = find_index("gtin", "ean", "gtin/ean", "codigo de barras")
    cost_index = find_index("custo", "preco", "preço", "valor")

    if name_index == -1 or gtin_index == -1 or cost_index == -1:
        return []

    for line in body_lines:
        cols = [normalize_text(cell) for cell in line.strip().strip("|").split("|")]
        if max(name_index, gtin_index, cost_index) >= len(cols):
          continue
        row = normalize_candidate_row(
            {
                "code": cols[code_index] if code_index >= 0 and code_index < len(cols) else "",
                "name": cols[name_index],
                "gtin": cols[gtin_index],
                "cost": cols[cost_index],
            }
        )
        if row:
            rows.append(row)

    return rows


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/extract")
async def extract_supplier(file: UploadFile = File(...)):
    suffix = Path(file.filename or "supplier.bin").suffix or ".bin"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        content = await file.read()
        temp_file.write(content)
        temp_path = Path(temp_file.name)

    try:
        result = converter.convert(str(temp_path))
        markdown = result.document.export_to_markdown()
        rows = extract_rows_from_markdown(markdown)

        return JSONResponse(
            {
                "ok": True,
                "data": {
                    "fileName": file.filename,
                    "rows": rows,
                    "rawText": rows_to_text(rows),
                    "markdown": markdown,
                },
            }
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        temp_path.unlink(missing_ok=True)
