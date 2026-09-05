/**
 * InfinitePay: o link de pagamento usa o "handle" da conta (o $nome).
 * Não precisa de chave de API para cobrar; a confirmação chega no webhook
 * configurado em /api/public/infinitepay-webhook.
 */
export function buildInfinitePayLink(
  handle: string,
  planName: string,
  price: number,
  orderId: string,
): string {
  const clean = handle.replace(/^\$/, "").trim();
  const items = encodeURIComponent(
    JSON.stringify([{ name: planName, price: Math.round(price * 100), quantity: 1 }]),
  );
  const redirect = encodeURIComponent(
    `${process.env["PUBLIC_SITE_URL"] ?? ""}/conta?pagamento=${orderId}`,
  );
  return `https://checkout.infinitepay.io/${clean}?items=${items}&order_nsu=${encodeURIComponent(orderId)}&redirect_url=${redirect}`;
}
