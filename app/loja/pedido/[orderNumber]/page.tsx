import { OrderStatusClient } from "@/components/store/storefront"

export default async function StoreOrderPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>
}) {
  const { orderNumber } = await params
  return <OrderStatusClient orderNumber={orderNumber} />
}
