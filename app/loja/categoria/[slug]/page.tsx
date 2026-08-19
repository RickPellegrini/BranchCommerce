import { CategoryPage } from "@/components/store/storefront"

export default async function StoreCategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <CategoryPage slug={slug} />
}
