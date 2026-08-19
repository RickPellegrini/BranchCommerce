import { ProductPage } from "@/components/store/storefront"

export default async function StoreProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <ProductPage slug={slug} />
}
