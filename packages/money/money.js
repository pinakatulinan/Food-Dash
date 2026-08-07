// money.js — every peso amount in this codebase is an integer number of
// centavos. The database stores centavos (price_cents, total_cents), so app
// state and props do too. Floats never touch money: 0.1 + 0.2 problems become
// real accounting problems once riders are settling cash by hand.
//
// Amounts convert at exactly two boundaries:
//   authoring a literal   -> pesos(129)
//   rendering to a screen -> formatMoney(12900)
//
// Anything named *Cents is centavos. If a value isn't named that way, it
// isn't money.

/** Author a centavo amount from a peso figure. Seeds, mocks and fixtures only. */
export const pesos = (amount) => Math.round(amount * 100);

/**
 * Render centavos for display. The single place the ₱ symbol and decimal
 * convention live — change the format here and every screen follows.
 */
export const formatMoney = (cents) => `₱${(cents / 100).toFixed(2)}`;

/**
 * Split an order's money across the three parties.
 *
 * Both cuts are snapshotted per order (orders.restaurant_commission_rate and
 * orders.rider_commission_rate) so changing your rates later never rewrites
 * what an old order paid out.
 *
 * Each party's cut is rounded to the centavo and the platform takes whatever
 * remains, so the three payouts always sum back to exactly totalCents — no
 * centavo goes missing or gets invented by rounding.
 */
export function splitOrderMoney({
  subtotalCents,
  deliveryFeeCents,
  restaurantCommissionRate,
  riderCommissionRate,
}) {
  const totalCents = subtotalCents + deliveryFeeCents;
  const restaurantPayoutCents =
    subtotalCents - Math.round(subtotalCents * restaurantCommissionRate);
  const riderPayoutCents =
    deliveryFeeCents - Math.round(deliveryFeeCents * riderCommissionRate);

  return {
    totalCents,
    restaurantPayoutCents,
    riderPayoutCents,
    platformRevenueCents: totalCents - restaurantPayoutCents - riderPayoutCents,
  };
}
