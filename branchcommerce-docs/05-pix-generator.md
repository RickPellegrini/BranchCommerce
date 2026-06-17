# 05 — Gerador de Pix (BR Code / EMV)

## Objetivo

Função pura que recebe `{ chave, nome, cidade, valor }` e devolve o Pix copia-e-cola conforme padrão do Banco Central.

## Por que implementar do zero (sem lib)

- Padrão público e estável (não muda)
- Zero dependências = zero supply chain risk
- Implementação cabe em ~50 linhas
- Testável 100%

## Especificação resumida

O Pix copia-e-cola é uma string TLV (Tag-Length-Value) com checksum CRC16-CCITT no final.

| Tag | Conteúdo                            | Exemplo                                 |
| --- | ----------------------------------- | --------------------------------------- |
| 00  | Payload Format Indicator            | `01`                                    |
| 01  | Point of Initiation                 | `12` (reutilizável)                     |
| 26  | Merchant Account Info (GUI + chave) | `0014BR.GOV.BCB.PIX0114teste@email.com` |
| 52  | Merchant Category Code              | `0000`                                  |
| 53  | Currency                            | `986` (BRL)                             |
| 54  | Amount                              | `113.91`                                |
| 58  | Country                             | `BR`                                    |
| 59  | Merchant Name                       | `Joao Silva` (max 25)                   |
| 60  | Merchant City                       | `Sao Paulo` (max 15, sem acentos)       |
| 62  | Additional Data                     | `0503***` ou txid                       |
| 63  | CRC16                               | `9068` (calculado por último)           |

## Arquivo: `convex/pix.ts`

```ts
function crc16(data: string): string {
  let crc = 0xffff
  for (const char of data) {
    crc ^= char.charCodeAt(0) << 8
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
      crc &= 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0")
}

function tlv(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, "0")
  return `${tag}${len}${value}`
}

export type PixInput = {
  chave: string
  nome: string
  cidade: string
  valor: number
  txid?: string // opcional, default "***"
}

export function gerarPix({ chave, nome, cidade, valor, txid = "***" }: PixInput): string {
  // Sanitização
  const nomeSafe = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .slice(0, 25)
  const cidadeSafe = cidade
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .slice(0, 15)
  const valorSafe = valor.toFixed(2)
  const txidSafe = txid.slice(0, 25)

  const mai = tlv("26", tlv("00", "BR.GOV.BCB.PIX") + tlv("01", chave))
  const additionalData = tlv("62", tlv("05", txidSafe))

  const payload =
    tlv("00", "01") +
    tlv("01", "12") +
    mai +
    tlv("52", "0000") +
    tlv("53", "986") +
    tlv("54", valorSafe) +
    tlv("58", "BR") +
    tlv("59", nomeSafe) +
    tlv("60", cidadeSafe) +
    additionalData +
    "6304" // tag + length do CRC, valor entra a seguir

  return payload + crc16(payload)
}
```

## Testes obrigatórios (Vitest)

```ts
// tests/pix.test.ts
import { describe, it, expect } from "vitest"
import { gerarPix } from "@/convex/pix"

describe("gerarPix", () => {
  it("gera código que começa com payload format 000201", () => {
    const pix = gerarPix({ chave: "teste@email.com", nome: "Joao", cidade: "SP", valor: 100 })
    expect(pix).toMatch(/^000201/)
  })

  it("contém o GUI do Pix", () => {
    const pix = gerarPix({ chave: "teste@email.com", nome: "Joao", cidade: "SP", valor: 100 })
    expect(pix).toContain("BR.GOV.BCB.PIX")
  })

  it("contém o valor formatado com 2 decimais", () => {
    const pix = gerarPix({ chave: "x", nome: "Y", cidade: "Z", valor: 113.9 })
    expect(pix).toContain("113.90")
  })

  it("CRC tem exatamente 4 hex chars no final", () => {
    const pix = gerarPix({ chave: "x", nome: "Y", cidade: "Z", valor: 1 })
    expect(pix.slice(-4)).toMatch(/^[0-9A-F]{4}$/)
  })

  it("trunca nome em 25 caracteres", () => {
    const nomeLongo = "A".repeat(50)
    const pix = gerarPix({ chave: "x", nome: nomeLongo, cidade: "Z", valor: 1 })
    expect(pix).toContain("A".repeat(25))
    expect(pix).not.toContain("A".repeat(26))
  })

  it("remove acentos do nome", () => {
    const pix = gerarPix({ chave: "x", nome: "João", cidade: "São Paulo", valor: 1 })
    expect(pix).toContain("Joao")
    expect(pix).toContain("Sao Paulo")
  })

  it("é determinístico — mesmo input gera mesmo output", () => {
    const a = gerarPix({ chave: "x", nome: "Y", cidade: "Z", valor: 50, txid: "ABC" })
    const b = gerarPix({ chave: "x", nome: "Y", cidade: "Z", valor: 50, txid: "ABC" })
    expect(a).toBe(b)
  })
})
```

## Validação manual final

Antes de marcar como pronto, **gerar um Pix real e validar em**:

- https://validacaobrcode.com — confere se o BR Code é parseável
- App de banco real — copiar e colar deve mostrar o valor correto

## Critério de aceite

- [ ] Todos os testes Vitest verdes
- [ ] Pix gerado validado em validador externo
- [ ] Pix gerado pago de teste (R$ 0,01) em banco real funciona
- [ ] Cobertura 100% no arquivo
