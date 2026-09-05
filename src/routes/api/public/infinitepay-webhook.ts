import { createFileRoute } from "@tanstack/react-router";

/**
 * Recebe a confirmação de pagamento do InfinitePay e renova o acesso do
 * cliente automaticamente. O identificador do pedido (order_nsu) é o mesmo
 * gerado no checkout.
 */
export const Route = createFileRoute("/api/public/infinitepay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["INFINITEPAY_WEBHOOK_SECRET"];
        if (secret) {
          const provided =
            request.headers.get("x-webhook-secret") ??
            new URL(request.url).searchParams.get("secret");
          if (provided !== secret) return new Response("Invalid secret", { status: 401 });
        }

        let payload: Record<string, unknown>;
        try {
          payload = (await request.json()) as Record<string, unknown>;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const orderId = String(
          payload["order_nsu"] ?? payload["orderNsu"] ?? payload["external_order_id"] ?? "",
        );
        const paid =
          payload["paid"] === true ||
          ["paid", "approved", "succeeded", "confirmed"].includes(
            String(payload["status"] ?? "").toLowerCase(),
          );
        if (!orderId) return new Response("Missing order", { status: 400 });

        const { collections } = await import("@/lib/db.server");
        const { ObjectId } = await import("mongodb");
        const { payments, users, plans } = await collections();
        const payment = await payments.findOne({ orderId });
        if (!payment) return new Response("Unknown order", { status: 404 });
        if (payment.status === "paid") return new Response("ok");
        if (!paid) {
          await payments.updateOne({ orderId }, { $set: { status: "failed", raw: payload } });
          return new Response("ok");
        }

        const plan = await plans.findOne({ id: payment.planId });
        const days = plan?.days ?? 30;
        const user = await users.findOne({ _id: new ObjectId(payment.userId) } as never);
        if (user) {
          const base = Math.max(new Date(user.expiresAt).getTime(), Date.now());
          await users.updateOne({ _id: new ObjectId(payment.userId) } as never, {
            $set: {
              planId: payment.planId,
              planName: plan?.name ?? user.planName,
              expiresAt: new Date(base + days * 86400_000),
              status: "active",
              updatedAt: new Date(),
            },
          });
        }
        await payments.updateOne(
          { orderId },
          { $set: { status: "paid", paidAt: new Date(), raw: payload } },
        );
        return new Response("ok");
      },
    },
  },
});
