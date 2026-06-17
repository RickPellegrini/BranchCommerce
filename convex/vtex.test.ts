import { expect, test } from "vitest"

import { parseVtexResponse } from "./vtex"

test("array vazio devolve estado vazio com SKU", () => {
  const p = parseVtexResponse("123", [])
  expect(p.sku).toBe("123")
  expect(p.disponivel).toBe(false)
  expect(p.preco).toBe(0)
})

test("estructura minima: nome e disponibilidade", () => {
  const data = [
    {
      productName: "Prod A",
      link: "/p",
      items: [
        {
          itemId: "999",
          sellers: [
            {
              commertialOffer: {
                IsAvailable: true,
                Price: 10,
                ListPrice: 20,
              },
            },
          ],
          images: [{ imageUrl: "https://i.example/x.jpg" }],
        },
      ],
    },
  ]
  const p = parseVtexResponse("999", data)
  expect(p.sku).toBe("999")
  expect(p.disponivel).toBe(true)
  expect(p.preco).toBe(10)
  expect(p.precoOriginal).toBe(20)
  expect(p.nomeProduto).toBe("Prod A")
  expect(p.imagemUrl).toBe("https://i.example/x.jpg")
})
