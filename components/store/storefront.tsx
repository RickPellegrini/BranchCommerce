"use client"

import { useDeferredValue, useEffect, useState, type FormEvent } from "react"
import { useMutation, useQuery } from "convex/react"
import {
  ArrowRight,
  PackageCheck,
  Search,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Trash2,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useUser } from "@clerk/nextjs"

import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type PublicProduct = {
  _id: Id<"storeProducts">
  slug: string
  title: string
  subtitle?: string
  description?: string
  price: number
  compareAtPrice?: number
  featured: boolean
  sku: string
  imageUrl?: string
  availableQuantity: number
  inStock: boolean
}

type CartPayload = {
  items: Array<{
    _id: string
    storeProductId: Id<"storeProducts">
    quantity: number
    unitPriceSnapshot: number
    lineTotal: number
    product: PublicProduct | null
  }>
  subtotal: number
  itemCount: number
}

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

function money(value: number) {
  return currency.format(value)
}

function StoreImage({ product, priority = false }: { product: PublicProduct; priority?: boolean }) {
  if (!product.imageUrl) {
    return (
      <div className="flex aspect-square items-center justify-center bg-[radial-gradient(circle_at_30%_20%,#f8d27a,transparent_35%),linear-gradient(135deg,#10251d,#47624a)] text-xs font-semibold uppercase tracking-[0.25em] text-white/80">
        Branch
      </div>
    )
  }

  return (
    <Image
      src={product.imageUrl}
      alt={product.title}
      width={700}
      height={700}
      priority={priority}
      unoptimized
      className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105"
    />
  )
}

export function StoreHero() {
  return (
    <section className="relative overflow-hidden border-b border-[#24382d]/10 bg-[#efe6d3]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_25%,rgba(237,126,64,0.28),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(48,91,70,0.25),transparent_24%),linear-gradient(135deg,rgba(255,255,255,0.7),rgba(231,218,190,0.5))]" />
      <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
        <div className="flex flex-col justify-center">
          <Badge className="mb-5 w-fit border-[#24382d]/20 bg-white/60 text-[#24382d]">
            <Sparkles className="mr-1 size-3" />
            Loja oficial Branch Commerce
          </Badge>
          <h1 className="max-w-3xl font-[var(--font-mobile-display)] text-4xl font-black tracking-[-0.05em] text-[#13251d] sm:text-6xl">
            Produtos escolhidos para vender bem, agora direto da Branch.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#425648] sm:text-lg">
            Uma vitrine propria, com estoque reservado no checkout e pedidos conectados ao
            backoffice. MVP enxuto por fora, engenharia cuidadosa por dentro.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-[#15251d] px-5 text-white hover:bg-[#223a2d]"
            >
              <a href="#catalogo">
                Ver produtos
                <ArrowRight className="ml-2 size-4" />
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-full border-[#15251d]/20 bg-white/70 px-5"
            >
              <Link href="/loja/carrinho">
                Carrinho
                <ShoppingCart className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:translate-y-4">
          <div className="rounded-[2rem] bg-[#16251d] p-5 text-white shadow-2xl shadow-[#16251d]/20">
            <p className="text-xs uppercase tracking-[0.35em] text-[#f2ca7a]">MVP</p>
            <p className="mt-12 text-3xl font-black tracking-tight">Checkout Mercado Pago</p>
            <p className="mt-3 text-sm leading-6 text-white/70">
              Pedido pendente, reserva ativa e baixa automatica apos pagamento confirmado.
            </p>
          </div>
          <div className="rounded-[2rem] border border-[#24382d]/10 bg-white/75 p-5 shadow-xl shadow-[#24382d]/10 sm:mt-12">
            <PackageCheck className="size-8 text-[#ce6d33]" />
            <p className="mt-10 text-2xl font-black tracking-tight text-[#16251d]">
              Estoque protegido
            </p>
            <p className="mt-3 text-sm leading-6 text-[#56675a]">
              O catalogo publico nunca recebe custo, margem, fornecedor ou kanban.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function ProductCard({ product }: { product: PublicProduct }) {
  return (
    <Card className="group border-[#1c2d23]/10 bg-white/85 p-0 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-[#1c2d23]/10">
      <Link href={`/loja/produto/${product.slug}`} className="block overflow-hidden">
        <StoreImage product={product} />
      </Link>
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link
              href={`/loja/produto/${product.slug}`}
              className="font-semibold leading-tight text-[#14251d] hover:underline"
            >
              {product.title}
            </Link>
            {product.subtitle ? (
              <p className="mt-1 text-xs text-[#5c6d61]">{product.subtitle}</p>
            ) : null}
          </div>
          {product.featured ? (
            <Badge className="bg-[#f2ca7a] text-[#14251d]">Destaque</Badge>
          ) : null}
        </div>
        <div className="mt-auto flex items-end justify-between gap-3">
          <div>
            {product.compareAtPrice ? (
              <p className="text-xs text-[#738176] line-through">{money(product.compareAtPrice)}</p>
            ) : null}
            <p className="text-lg font-black text-[#14251d]">{money(product.price)}</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#778579]">
              {product.inStock ? `${product.availableQuantity} disp.` : "sem estoque"}
            </p>
          </div>
          <AddToCartButton productId={product._id} disabled={!product.inStock} compact />
        </div>
      </CardContent>
    </Card>
  )
}

export function StoreHome() {
  const productsData = useQuery(api.storeCatalog.listPublishedProducts, { limit: 48 })
  const categories = useQuery(api.storeCatalog.listPublishedCategories, { limit: 12 })
  const [search, setSearch] = useState("")
  const deferredSearch = useDeferredValue(search.trim().toLowerCase())
  const products = productsData?.products ?? []
  const filtered = products.filter((product) => {
    if (!deferredSearch) return true
    return `${product.title} ${product.subtitle ?? ""} ${product.sku}`
      .toLowerCase()
      .includes(deferredSearch)
  })

  return (
    <>
      <StoreHero />
      <main id="catalogo" className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#ce6d33]">
              Catalogo
            </p>
            <h2 className="mt-2 font-[var(--font-mobile-display)] text-3xl font-black tracking-[-0.04em] text-[#14251d]">
              Prateleira principal
            </h2>
          </div>
          <label className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#738176]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por produto ou SKU"
              className="h-11 rounded-full border-[#24382d]/15 bg-white/80 pl-9"
            />
          </label>
        </div>

        {categories && categories.length > 0 ? (
          <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
            {categories.map((category) => (
              <Button
                key={category._id}
                asChild
                variant="outline"
                className="rounded-full bg-white/80"
              >
                <Link href={`/loja/categoria/${category.slug}`}>{category.name}</Link>
              </Button>
            ))}
          </div>
        ) : null}

        {!productsData ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-80 animate-pulse rounded-[1.5rem] bg-white/60" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed bg-white/70">
            <CardContent className="p-10 text-center text-sm text-[#5c6d61]">
              Nenhum produto publicado encontrado.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {filtered.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        )}
      </main>
    </>
  )
}

export function CategoryPage({ slug }: { slug: string }) {
  const data = useQuery(api.storeCatalog.listProductsByCategory, { slug, limit: 48 })

  return (
    <main className="mx-auto min-h-[70vh] max-w-7xl px-4 py-8 sm:px-6">
      <Button asChild variant="ghost" className="mb-5 rounded-full">
        <Link href="/loja">Voltar para loja</Link>
      </Button>
      <h1 className="font-[var(--font-mobile-display)] text-4xl font-black tracking-[-0.04em] text-[#14251d]">
        {data?.category?.name ?? "Categoria"}
      </h1>
      {data?.category?.description ? (
        <p className="mt-2 max-w-2xl text-[#5c6d61]">{data.category.description}</p>
      ) : null}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(data?.products ?? []).map((product) => (
          <ProductCard key={product._id} product={product} />
        ))}
      </div>
    </main>
  )
}

export function ProductPage({ slug }: { slug: string }) {
  const product = useQuery(api.storeCatalog.getProductBySlug, { slug })

  if (product === null) {
    return (
      <main className="mx-auto min-h-[70vh] max-w-4xl px-4 py-16 text-center">
        <h1 className="text-3xl font-black text-[#14251d]">Produto nao encontrado</h1>
        <Button asChild className="mt-6 rounded-full">
          <Link href="/loja">Voltar para loja</Link>
        </Button>
      </main>
    )
  }

  if (!product) {
    return <main className="mx-auto min-h-[70vh] max-w-7xl px-4 py-8">Carregando produto...</main>
  }

  return (
    <main className="mx-auto grid min-h-[70vh] max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.95fr_1fr]">
      <div className="overflow-hidden rounded-[2rem] bg-white shadow-xl shadow-[#14251d]/10">
        <StoreImage product={product} priority />
      </div>
      <section className="flex flex-col justify-center">
        <Badge className="mb-4 w-fit bg-[#f2ca7a] text-[#14251d]">SKU {product.sku}</Badge>
        <h1 className="font-[var(--font-mobile-display)] text-4xl font-black tracking-[-0.04em] text-[#14251d] sm:text-5xl">
          {product.title}
        </h1>
        {product.subtitle ? (
          <p className="mt-3 text-lg text-[#5c6d61]">{product.subtitle}</p>
        ) : null}
        <div className="mt-7 rounded-[1.5rem] border border-[#24382d]/10 bg-white/80 p-5">
          {product.compareAtPrice ? (
            <p className="text-sm text-[#738176] line-through">{money(product.compareAtPrice)}</p>
          ) : null}
          <p className="text-4xl font-black text-[#14251d]">{money(product.price)}</p>
          <p className="mt-2 text-sm text-[#5c6d61]">
            {product.inStock
              ? `${product.availableQuantity} unidades disponiveis para envio.`
              : "Produto sem estoque no momento."}
          </p>
          <AddToCartButton productId={product._id} disabled={!product.inStock} />
        </div>
        {product.description ? (
          <div className="mt-7 prose prose-sm max-w-none text-[#405247]">
            <p>{product.description}</p>
          </div>
        ) : null}
      </section>
    </main>
  )
}

export function AddToCartButton({
  productId,
  disabled,
  compact = false,
}: {
  productId: Id<"storeProducts">
  disabled?: boolean
  compact?: boolean
}) {
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState("")

  async function addToCart() {
    setPending(true)
    setMessage("")
    try {
      const response = await fetch("/api/store/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeProductId: productId, quantity: 1 }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(data.error ?? "Falha ao adicionar.")
      setMessage("Adicionado")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao adicionar.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={compact ? "" : "mt-5"}>
      <Button
        type="button"
        onClick={addToCart}
        disabled={disabled || pending}
        className={
          compact
            ? "rounded-full bg-[#14251d] px-3"
            : "h-11 rounded-full bg-[#14251d] px-6 text-sm text-white hover:bg-[#223a2d]"
        }
      >
        <ShoppingBag className="mr-2 size-4" />
        {pending ? "Adicionando" : compact ? "Comprar" : "Adicionar ao carrinho"}
      </Button>
      {message ? <p className="mt-2 text-xs text-[#ce6d33]">{message}</p> : null}
    </div>
  )
}

export function CartPageClient() {
  const [cart, setCart] = useState<CartPayload | null>(null)
  const [loading, setLoading] = useState(true)

  async function updateItem(storeProductId: Id<"storeProducts">, quantity: number) {
    const response = await fetch("/api/store/cart", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeProductId, quantity }),
    })
    setCart((await response.json()) as CartPayload)
  }

  async function removeItem(storeProductId: Id<"storeProducts">) {
    const response = await fetch(`/api/store/cart?storeProductId=${storeProductId}`, {
      method: "DELETE",
    })
    setCart((await response.json()) as CartPayload)
  }

  useEffect(() => {
    let cancelled = false
    fetch("/api/store/cart", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: CartPayload) => {
        if (cancelled) return
        setCart(data)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setCart({ items: [], subtotal: 0, itemCount: 0 })
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const items = cart?.items ?? []

  return (
    <main className="mx-auto min-h-[70vh] max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-[var(--font-mobile-display)] text-4xl font-black tracking-[-0.04em] text-[#14251d]">
        Carrinho
      </h1>
      {loading ? (
        <p className="mt-6 text-[#5c6d61]">Carregando carrinho...</p>
      ) : items.length === 0 ? (
        <Card className="mt-6 bg-white/80">
          <CardContent className="p-8 text-center">
            <p className="text-[#5c6d61]">Seu carrinho esta vazio.</p>
            <Button asChild className="mt-5 rounded-full">
              <Link href="/loja">Ver produtos</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            {items.map((item) => (
              <Card key={item._id} className="bg-white/85">
                <CardContent className="grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <p className="font-semibold text-[#14251d]">
                      {item.product?.title ?? "Produto indisponivel"}
                    </p>
                    <p className="text-sm text-[#5c6d61]">{money(item.unitPriceSnapshot)} cada</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => updateItem(item.storeProductId, item.quantity - 1)}
                    >
                      -
                    </Button>
                    <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => updateItem(item.storeProductId, item.quantity + 1)}
                    >
                      +
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeItem(item.storeProductId)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="h-fit bg-[#14251d] text-white">
            <CardHeader>
              <CardTitle>Resumo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between text-sm text-white/70">
                <span>{cart?.itemCount} itens</span>
                <span>{money(cart?.subtotal ?? 0)}</span>
              </div>
              <Button
                asChild
                className="mt-5 h-11 w-full rounded-full bg-[#f2ca7a] text-[#14251d] hover:bg-[#f7d992]"
              >
                <Link href="/loja/checkout">Ir para checkout</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  )
}

export function CheckoutPageClient() {
  const [cart, setCart] = useState<CartPayload | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/store/cart", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: CartPayload) => setCart(data))
      .catch(() => setCart({ items: [], subtotal: 0, itemCount: 0 }))
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError("")
    const form = new FormData(event.currentTarget)
    const payload = {
      customer: {
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? ""),
      },
      shippingAddress: {
        name: String(form.get("name") ?? ""),
        phone: String(form.get("phone") ?? ""),
        zipCode: String(form.get("zipCode") ?? ""),
        street: String(form.get("street") ?? ""),
        number: String(form.get("number") ?? ""),
        complement: String(form.get("complement") ?? ""),
        district: String(form.get("district") ?? ""),
        city: String(form.get("city") ?? ""),
        state: String(form.get("state") ?? ""),
      },
    }

    try {
      const response = await fetch("/api/store/checkout/mp-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = (await response.json()) as { initPoint?: string; error?: string }
      if (!response.ok || !data.initPoint) throw new Error(data.error ?? "Checkout indisponivel.")
      window.location.assign(data.initPoint)
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Checkout indisponivel.")
      setPending(false)
    }
  }

  return (
    <main className="mx-auto grid min-h-[70vh] max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_360px]">
      <form
        onSubmit={submit}
        className="space-y-5 rounded-[2rem] bg-white/85 p-5 shadow-xl shadow-[#14251d]/10"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#ce6d33]">
            Checkout
          </p>
          <h1 className="mt-2 font-[var(--font-mobile-display)] text-4xl font-black tracking-[-0.04em] text-[#14251d]">
            Dados para entrega
          </h1>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input name="name" placeholder="Nome completo" required className="h-11 rounded-xl" />
          <Input
            name="email"
            type="email"
            placeholder="Email"
            required
            className="h-11 rounded-xl"
          />
          <Input name="phone" placeholder="Telefone" className="h-11 rounded-xl" />
          <Input name="zipCode" placeholder="CEP" required className="h-11 rounded-xl" />
          <Input
            name="street"
            placeholder="Rua"
            required
            className="h-11 rounded-xl sm:col-span-2"
          />
          <Input name="number" placeholder="Numero" required className="h-11 rounded-xl" />
          <Input name="complement" placeholder="Complemento" className="h-11 rounded-xl" />
          <Input name="district" placeholder="Bairro" required className="h-11 rounded-xl" />
          <Input name="city" placeholder="Cidade" required className="h-11 rounded-xl" />
          <Input name="state" placeholder="UF" required maxLength={2} className="h-11 rounded-xl" />
        </div>
        {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <Button
          disabled={pending || !cart?.items.length}
          className="h-11 rounded-full bg-[#14251d] px-6"
        >
          {pending ? "Criando pagamento..." : "Pagar com Mercado Pago"}
        </Button>
      </form>
      <Card className="h-fit bg-[#14251d] text-white">
        <CardHeader>
          <CardTitle>Resumo do pedido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(cart?.items ?? []).map((item) => (
            <div key={item._id} className="flex justify-between gap-3 text-sm text-white/75">
              <span>
                {item.quantity}x {item.product?.title ?? "Produto"}
              </span>
              <span>{money(item.lineTotal)}</span>
            </div>
          ))}
          <div className="border-t border-white/15 pt-3 text-lg font-black">
            Subtotal {money(cart?.subtotal ?? 0)}
          </div>
          <p className="text-xs text-white/55">
            Frete calculado por regra fixa no backend no momento do pedido.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}

export function OrderStatusClient({ orderNumber }: { orderNumber: string }) {
  const [email, setEmail] = useState("")
  const [order, setOrder] = useState<unknown>(null)
  const [error, setError] = useState("")

  async function load(nextEmail = "") {
    const suffix = nextEmail ? `&email=${encodeURIComponent(nextEmail)}` : ""
    const response = await fetch(`/api/store/order-status?orderNumber=${orderNumber}${suffix}`, {
      cache: "no-store",
    })
    const data = await response.json()
    if (!response.ok) {
      setError("Informe o email usado na compra para consultar este pedido.")
      return
    }
    setOrder(data.order)
    setError("")
  }

  useEffect(() => {
    let cancelled = false
    const suffix = ""
    fetch(`/api/store/order-status?orderNumber=${orderNumber}${suffix}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json()
        if (cancelled) return
        if (!response.ok) {
          setError("Informe o email usado na compra para consultar este pedido.")
          return
        }
        setOrder(data.order)
        setError("")
      })
      .catch(() => {
        if (cancelled) return
        setError("Informe o email usado na compra para consultar este pedido.")
      })
    return () => {
      cancelled = true
    }
  }, [orderNumber])

  const publicOrder = order as {
    order: { status: string; paymentStatus: string; fulfillmentStatus: string; grandTotal: number }
    items: Array<{ title: string; quantity: number; total: number }>
  } | null

  return (
    <main className="mx-auto min-h-[70vh] max-w-3xl px-4 py-10 sm:px-6">
      <Card className="bg-white/85">
        <CardHeader>
          <CardTitle className="text-2xl">Pedido {orderNumber}</CardTitle>
        </CardHeader>
        <CardContent>
          {publicOrder ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Badge>Status: {publicOrder.order.status}</Badge>
                <Badge>Pagamento: {publicOrder.order.paymentStatus}</Badge>
                <Badge>Envio: {publicOrder.order.fulfillmentStatus}</Badge>
              </div>
              {publicOrder.items.map((item) => (
                <div key={item.title} className="flex justify-between text-sm">
                  <span>
                    {item.quantity}x {item.title}
                  </span>
                  <span>{money(item.total)}</span>
                </div>
              ))}
              <div className="border-t pt-4 text-xl font-black">
                Total {money(publicOrder.order.grandTotal)}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[#5c6d61]">{error || "Buscando pedido..."}</p>
              {error ? (
                <div className="flex gap-2">
                  <Input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="email da compra"
                  />
                  <Button onClick={() => load(email)}>Consultar</Button>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

export function AccountOrdersClient() {
  const { user, isLoaded } = useUser()
  const orders = useQuery(
    api.storeOrders.listCustomerOrders,
    user ? { clerkUserId: user.id, limit: 20 } : "skip",
  )

  if (isLoaded && !user) {
    return (
      <main className="mx-auto min-h-[70vh] max-w-3xl px-4 py-10 text-center">
        <h1 className="text-3xl font-black text-[#14251d]">Entre para ver seus pedidos</h1>
        <Button asChild className="mt-5 rounded-full">
          <Link href="/sign-in">Entrar</Link>
        </Button>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-[70vh] max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-[var(--font-mobile-display)] text-4xl font-black tracking-[-0.04em] text-[#14251d]">
        Minha conta
      </h1>
      <div className="mt-6 space-y-3">
        {(orders ?? []).map((row) => (
          <Card key={row.order.orderNumber} className="bg-white/85">
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div>
                <Link
                  href={`/loja/pedido/${row.order.orderNumber}`}
                  className="font-semibold hover:underline"
                >
                  {row.order.orderNumber}
                </Link>
                <p className="text-xs text-[#5c6d61]">
                  {row.order.paymentStatus} / {row.order.fulfillmentStatus}
                </p>
              </div>
              <p className="font-black">{money(row.order.grandTotal)}</p>
            </CardContent>
          </Card>
        ))}
        {orders?.length === 0 ? <p className="text-[#5c6d61]">Nenhum pedido encontrado.</p> : null}
      </div>
    </main>
  )
}

export function StoreAdminPage() {
  const { user } = useUser()
  const userId = user?.id ?? ""
  const rows = useQuery(
    api.storeCatalog.listAdminProducts,
    userId ? { userId, limit: 100 } : "skip",
  )
  const orders = useQuery(api.storeOrders.listAdminOrders, userId ? { userId, limit: 40 } : "skip")
  const upsert = useMutation(api.storeCatalog.upsertStoreProduct)
  const replaceImages = useMutation(api.storeCatalog.replaceProductImages)
  const [selectedId, setSelectedId] = useState<string>("")
  const selected = rows?.find((row) => row.stockProduct._id === selectedId) ?? rows?.[0]
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || !userId) return
    setSaving(true)
    setMessage("")
    const form = new FormData(event.currentTarget)
    try {
      const storeProductId = await upsert({
        userId,
        stockProductId: selected.stockProduct._id,
        storeProductId: selected.storeProduct?._id,
        title: String(form.get("title") ?? ""),
        slug: String(form.get("slug") ?? ""),
        subtitle: String(form.get("subtitle") ?? "") || undefined,
        description: String(form.get("description") ?? "") || undefined,
        price: Number(form.get("price") ?? 0),
        compareAtPrice: Number(form.get("compareAtPrice") || 0) || undefined,
        status: String(form.get("status") ?? "draft") as "draft" | "published" | "archived",
        featured: form.get("featured") === "on",
        sortOrder: Number(form.get("sortOrder") || 1000),
      })
      const imageUrl = String(form.get("imageUrl") ?? "").trim()
      if (imageUrl) {
        await replaceImages({
          userId,
          storeProductId,
          images: [{ url: imageUrl, alt: String(form.get("title") ?? selected.stockProduct.name) }],
        })
      }
      setMessage("Produto salvo na loja.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao salvar.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#ce6d33]">
            Backoffice
          </p>
          <h1 className="font-[var(--font-mobile-display)] text-4xl font-black tracking-[-0.04em] text-[#14251d]">
            Loja
          </h1>
        </div>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/loja" target="_blank">
            Abrir storefront
          </Link>
        </Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="bg-white/85">
          <CardHeader>
            <CardTitle>Produtos do estoque</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(rows ?? []).map((row) => (
              <button
                key={row.stockProduct._id}
                type="button"
                onClick={() => setSelectedId(row.stockProduct._id)}
                className="w-full rounded-xl border border-[#14251d]/10 bg-white p-3 text-left text-sm hover:border-[#ce6d33]"
              >
                <span className="font-semibold">{row.stockProduct.name}</span>
                <span className="mt-1 block text-xs text-[#5c6d61]">
                  {row.storeProduct?.status ?? "nao publicado"} / {row.stockProduct.quantity} un.
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card className="bg-white/85">
            <CardHeader>
              <CardTitle>Editar vitrine</CardTitle>
            </CardHeader>
            <CardContent>
              {selected ? (
                <form onSubmit={saveProduct} className="grid gap-3 sm:grid-cols-2">
                  <Input
                    name="title"
                    defaultValue={selected.storeProduct?.title ?? selected.stockProduct.name}
                    placeholder="Titulo publico"
                    required
                  />
                  <Input
                    name="slug"
                    defaultValue={selected.storeProduct?.slug ?? ""}
                    placeholder="slug-produto"
                  />
                  <Input
                    name="subtitle"
                    defaultValue={selected.storeProduct?.subtitle ?? ""}
                    placeholder="Subtitulo"
                  />
                  <Input
                    name="price"
                    type="number"
                    step="0.01"
                    defaultValue={
                      selected.storeProduct?.price ?? selected.stockProduct.sellingPrice ?? 0
                    }
                    placeholder="Preco"
                    required
                  />
                  <Input
                    name="compareAtPrice"
                    type="number"
                    step="0.01"
                    defaultValue={selected.storeProduct?.compareAtPrice ?? ""}
                    placeholder="Preco de"
                  />
                  <Input
                    name="imageUrl"
                    defaultValue={selected.images[0]?.url ?? selected.stockProduct.imageUrl ?? ""}
                    placeholder="URL da imagem"
                  />
                  <Input
                    name="sortOrder"
                    type="number"
                    defaultValue={selected.storeProduct?.sortOrder ?? 1000}
                    placeholder="Ordenacao"
                  />
                  <select
                    name="status"
                    defaultValue={selected.storeProduct?.status ?? "draft"}
                    className="h-9 rounded-xl border border-[#14251d]/15 bg-white px-3 text-sm"
                  >
                    <option value="draft">Rascunho</option>
                    <option value="published">Publicado</option>
                    <option value="archived">Arquivado</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      name="featured"
                      type="checkbox"
                      defaultChecked={selected.storeProduct?.featured ?? false}
                    />
                    Destaque na home
                  </label>
                  <Textarea
                    name="description"
                    defaultValue={selected.storeProduct?.description ?? ""}
                    placeholder="Descricao comercial"
                    className="sm:col-span-2"
                  />
                  <div className="sm:col-span-2">
                    <Button disabled={saving} className="rounded-full bg-[#14251d]">
                      {saving ? "Salvando..." : "Salvar produto"}
                    </Button>
                    {message ? (
                      <span className="ml-3 text-sm text-[#ce6d33]">{message}</span>
                    ) : null}
                  </div>
                </form>
              ) : (
                <p className="text-sm text-[#5c6d61]">Nenhum produto de estoque encontrado.</p>
              )}
            </CardContent>
          </Card>
          <Card className="bg-white/85">
            <CardHeader>
              <CardTitle>Pedidos recentes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(orders ?? []).map((row) => (
                <div
                  key={row.order._id}
                  className="flex items-center justify-between rounded-xl border border-[#14251d]/10 bg-white p-3 text-sm"
                >
                  <div>
                    <p className="font-semibold">{row.order.orderNumber}</p>
                    <p className="text-xs text-[#5c6d61]">
                      {row.order.email} / {row.order.paymentStatus} / {row.order.fulfillmentStatus}
                    </p>
                  </div>
                  <p className="font-black">{money(row.order.grandTotal)}</p>
                </div>
              ))}
              {orders?.length === 0 ? (
                <p className="text-sm text-[#5c6d61]">Ainda nao ha pedidos da loja.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
