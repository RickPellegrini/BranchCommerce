# Docling Extractor

Microservico para extrair linhas de fornecedor com `Docling` e devolver JSON no formato que o Branch Hunter espera.

## Endpoint

- `POST /extract`
- campo `multipart/form-data`: `file`

## Resposta

```json
{
  "ok": true,
  "data": {
    "fileName": "ALIMENTOS.pdf",
    "rows": [
      {
        "code": "2485",
        "name": "ACHOCOLATADO PO TODDY 370G",
        "gtin": "7892840819507",
        "cost": 8.99
      }
    ],
    "rawText": "codigo\tdescricao\tgtin\tcusto\n2485\tACHOCOLATADO PO TODDY 370G\t7892840819507\t8.99",
    "markdown": "..."
  }
}
```

## Rodar local

```bash
pip install -r requirements.txt
uvicorn app:app --reload --port 8080
```

## Rodar via Docker

```bash
docker build -t branchcommerce-docling .
docker run --rm -p 8080:8080 branchcommerce-docling
```

## Configurar no BranchCommerce

Defina no app principal:

```env
DOCLING_SUPPLIER_EXTRACT_URL=http://localhost:8080/extract
```
