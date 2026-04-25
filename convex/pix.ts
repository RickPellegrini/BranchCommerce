/** BR Code EMV (Pix) — puro. Ver branchcommerce-docs/05-pix-generator.md */
export type PixInput = {
  chave: string
  nome: string
  cidade: string
  valor: number
  txid?: string
}

function crc16(data: string): string {
  let crc = 0xffff
  for (const char of data) {
    crc ^= char.charCodeAt(0) << 8
    for (let i = 0; i < 8; i++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1)
      crc &= 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0")
}

function tlv(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, "0")
  return `${tag}${len}${value}`
}

export function gerarPix({ chave, nome, cidade, valor, txid = "***" }: PixInput): string {
  const nomeSafe = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 25)
  const cidadeSafe = cidade.normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 15)
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
    "6304"

  return payload + crc16(payload)
}
