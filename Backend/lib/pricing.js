// All order pricing lives here so the cart preview (POST /store/quote) and the
// real checkout (POST /store/orders) can never disagree. Nothing in this file
// trusts prices, discounts or totals sent by the browser.

const { findProduct } = require("./storeCatalog");
const { findCoupon, STUDENT_DISCOUNT } = require("./coupons");

class PricingError extends Error {}

const clean = (v) => (v == null ? "" : String(v).trim());

// Turn the cart sent by the browser into trusted order lines.
function buildLines(items) {
  if (!Array.isArray(items) || items.length === 0) throw new PricingError("Cart is empty.");

  const lines = [];
  for (const raw of items) {
    const product = findProduct(raw && raw.productId);
    if (!product) throw new PricingError(`Unknown product: ${raw && raw.productId}`);

    const quantity = Number(raw.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
      throw new PricingError(`Invalid quantity for ${product.name}.`);
    }

    const size = clean(raw.size);
    const color = clean(raw.color);

    if (product.sizes) {
      if (!size) throw new PricingError(`Please choose a size for ${product.name}.`);
      if (!product.sizes.includes(size)) throw new PricingError(`Invalid size for ${product.name}.`);
    } else if (size) {
      throw new PricingError(`${product.name} doesn't come in sizes.`);
    }

    if (product.colors) {
      if (!color) throw new PricingError(`Please choose a color for ${product.name}.`);
      if (!product.colors.includes(color)) throw new PricingError(`Invalid color for ${product.name}.`);
    } else if (color) {
      throw new PricingError(`${product.name} doesn't come in colors.`);
    }

    lines.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity,
      ...(size && { size }),
      ...(color && { color }),
    });
  }
  return lines;
}

function couponDiscount(coupon, subtotal) {
  if (coupon.expires) {
    const end = new Date(`${coupon.expires}T23:59:59`);
    if (Date.now() > end.getTime()) throw new PricingError(`Coupon ${coupon.code} has expired.`);
  }
  if (coupon.minSubtotal && subtotal < coupon.minSubtotal) {
    throw new PricingError(`${coupon.code} needs an order of at least Rs.${coupon.minSubtotal}.`);
  }
  let amount = coupon.type === "percent" ? Math.round((subtotal * coupon.value) / 100) : coupon.value;
  if (coupon.type === "percent" && coupon.maxDiscount) amount = Math.min(amount, coupon.maxDiscount);
  return Math.min(amount, subtotal);
}

// opts: { couponCode, isStudent }
// Only ONE discount applies: whichever saves the buyer more (no stacking).
function priceOrder(items, opts = {}) {
  const lines = buildLines(items);
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);

  let best = { amount: 0, label: "", couponCode: "", student: false };
  let coupon = null;

  if (clean(opts.couponCode)) {
    coupon = findCoupon(opts.couponCode);
    if (!coupon) throw new PricingError("That coupon code isn't valid.");
    const amount = couponDiscount(coupon, subtotal);
    best = { amount, label: coupon.label, couponCode: coupon.code, student: false };
  }

  if (opts.isStudent) {
    const amount = Math.min(
      Math.round((subtotal * STUDENT_DISCOUNT.percent) / 100),
      STUDENT_DISCOUNT.maxDiscount
    );
    if (amount > best.amount) {
      best = { amount, label: STUDENT_DISCOUNT.label, couponCode: "", student: true };
    }
  }

  return {
    lines,
    subtotal,
    discountAmount: best.amount,
    discountLabel: best.label,
    couponCode: best.couponCode,
    studentDiscount: best.student,
    // true when a coupon was entered but the student discount beat it
    couponSkipped: !!(coupon && best.couponCode !== coupon.code),
    coupon,
    totalAmount: subtotal - best.amount,
  };
}

module.exports = { priceOrder, PricingError };
