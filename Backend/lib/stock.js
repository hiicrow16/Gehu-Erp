// Stock management. Quantities are reserved with an atomic conditional update
// (stock >= qty), so two buyers can never both take the last unit.

const Stock = require("../models/Stock");
const { STORE_CATALOG } = require("./storeCatalog");
const { PricingError } = require("./pricing");

let seeded = false;

// Create a stock row for any catalog product that doesn't have one yet (starting value from the catalog file).
async function ensureStock() {
  if (seeded) return;
  await Stock.bulkWrite(
    STORE_CATALOG.map((p) => ({
      updateOne: { filter: { productId: p.id }, update: { $setOnInsert: { productId: p.id, stock: p.stock || 0 } }, upsert: true },
    })),
    { ordered: false }
  );
  seeded = true;
}

async function stockMap() {
  await ensureStock();
  const rows = await Stock.find();
  return Object.fromEntries(rows.map((r) => [r.productId, r]));
}

// A cart may list the same product twice (different size/color): total per product.
function totals(lines) {
  const t = {};
  for (const l of lines) t[l.productId] = (t[l.productId] || 0) + l.quantity;
  return t;
}

// Throws a friendly PricingError if anything in the cart isn't available.
async function assertAvailable(lines) {
  const map = await stockMap();
  for (const [id, qty] of Object.entries(totals(lines))) {
    const name = (lines.find((l) => l.productId === id) || {}).name || id;
    const have = map[id] ? map[id].stock : 0;
    if (have <= 0) throw new PricingError(`${name} is out of stock.`);
    if (qty > have) throw new PricingError(`Only ${have} of ${name} left in stock.`);
  }
}

// Take the stock for an order. All-or-nothing: if one product fails, the ones already taken are put back.
async function reserve(lines) {
  await ensureStock();
  const done = [];
  for (const [id, qty] of Object.entries(totals(lines))) {
    const r = await Stock.updateOne({ productId: id, stock: { $gte: qty } }, { $inc: { stock: -qty } });
    if (r.modifiedCount !== 1) {
      await release(done.map(([i, q]) => ({ productId: i, quantity: q })));
      const name = (lines.find((l) => l.productId === id) || {}).name || id;
      throw new PricingError(`Sorry, ${name} just ran out of stock or doesn't have enough left. Please reduce the quantity.`);
    }
    done.push([id, qty]);
  }
}

async function release(lines) {
  for (const [id, qty] of Object.entries(totals(lines))) {
    await Stock.updateOne({ productId: id }, { $inc: { stock: qty } });
  }
}

module.exports = { ensureStock, stockMap, assertAvailable, reserve, release };
