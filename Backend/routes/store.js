const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const Order = require("../models/Order");
const Student = require("../models/Student");
const Stock = require("../models/Stock");
const { STORE_CATALOG } = require("../lib/storeCatalog");
const { priceOrder, PricingError } = require("../lib/pricing");
const inventory = require("../lib/stock");
const rules = require("../lib/orderRules");
const { protect, optionalAuth, authorize } = require("../middleware/auth");
const { sendOrderSms } = require("../lib/sms");

const DELIVERY_DAYS = 7;

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const sameId = (a, b) => !!a && !!b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
const fail = (res, code, message) => res.status(code).json({ success: false, message });

// If the request carries a valid STUDENT token, return that student's profile
// (checked against the database, so a deactivated account loses the discount).
// Anyone else - guest, faculty, admin, expired token - gets null.
async function getLoggedInStudent(req) {
  if (!req.user || req.user.role !== "student" || !req.user.profileId) return null;
  const student = await Student.findById(req.user.profileId).populate("user", "isActive");
  if (!student || !student.user || student.user.isActive === false) return null;
  return student;
}

// Has this customer already used a once-per-customer coupon?
async function couponAlreadyUsed(coupon, { email, studentId }) {
  if (!coupon || !coupon.oncePerCustomer) return false;
  const who = [];
  if (email) who.push({ email: String(email).trim().toLowerCase() });
  if (studentId) who.push({ studentId: new RegExp(`^${escapeRegex(String(studentId).trim())}$`, "i") });
  if (!who.length) return false;
  return !!(await Order.exists({ couponCode: coupon.code, status: { $ne: "Cancelled" }, $or: who }));
}

// Optional global cap: add `maxUses: 100` to a coupon in lib/coupons.js. Cancelled orders free their use.
async function couponExhausted(coupon) {
  if (!coupon || !coupon.maxUses) return false;
  return (await Order.countDocuments({ couponCode: coupon.code, status: { $ne: "Cancelled" } })) >= coupon.maxUses;
}

// Everything the buyer is allowed to see about an order (no email/phone/address).
function publicOrder(o) {
  return {
    _id: o._id,
    createdAt: o.createdAt,
    estimatedDelivery: o.estimatedDelivery,
    items: o.items,
    subtotal: o.subtotal,
    discountAmount: o.discountAmount,
    discountLabel: o.discountLabel,
    couponCode: o.couponCode,
    totalAmount: o.totalAmount,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    status: o.status,
    statusHistory: o.statusHistory && o.statusHistory.length ? o.statusHistory : [{ status: "Pending", at: o.createdAt }],
    cancellable: rules.customerCancelError(o) === null,
    cancelReason: o.cancelReason,
    cancelledBy: o.cancelledBy,
    refundStatus: o.refundStatus,
  };
}

// Cancel in ONE atomic step so two simultaneous cancels can't both restock.
// Returns the updated order, or null if it was no longer in a cancellable state.
async function cancelOrder(id, { by, reason, allowedFrom }) {
  const now = new Date();
  const prev = await Order.findOneAndUpdate(
    { _id: id, status: { $in: allowedFrom } },
    {
      $set: { status: "Cancelled", cancelledBy: by, cancelReason: reason, cancelledAt: now },
      $push: { statusHistory: { status: "Cancelled", at: now, by, note: reason } },
    },
    { new: false }
  );
  if (!prev) return null;
  const after = {};
  if (prev.stockReserved && !prev.stockRestored) {
    await inventory.release(prev.items);
    after.stockRestored = true;
  }
  if (prev.paymentMethod === "UPI" && prev.paymentStatus === "Paid") after.refundStatus = "Refund Due";
  if (Object.keys(after).length) await Order.updateOne({ _id: id }, { $set: after });
  return Order.findById(id);
}

// GET /api/store/items - public product catalog (no login required)
// Carries LIVE stock, and `sold` (units in non-cancelled orders) for "Popularity" sorting.
router.get("/items", async (req, res) => {
  let soldById = {};
  let stockById = {};
  try {
    const rows = await Order.aggregate([
      { $match: { status: { $ne: "Cancelled" } } },
      { $unwind: "$items" },
      { $group: { _id: "$items.productId", sold: { $sum: "$items.quantity" } } },
    ]);
    soldById = Object.fromEntries(rows.map((r) => [r._id, r.sold]));
  } catch (err) {
    console.error("Could not compute popularity:", err.message); // catalog still loads
  }
  try {
    const map = await inventory.stockMap();
    stockById = Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v.stock]));
  } catch (err) {
    console.error("Could not load stock:", err.message); // falls back to catalog numbers
  }
  res.json({
    success: true,
    items: STORE_CATALOG.map((p) => ({
      ...p,
      stock: stockById[p.id] !== undefined ? stockById[p.id] : p.stock,
      sold: soldById[p.id] || 0,
    })),
  });
});

// GET /api/store/me - pre-fill details for a logged-in student's checkout.
// Guests (or any non-student) just get { student: null }.
router.get("/me", optionalAuth, async (req, res) => {
  try {
    const student = await getLoggedInStudent(req);
    if (!student) return res.json({ success: true, student: null });
    res.json({
      success: true,
      student: { name: student.name, email: student.email || "", phone: student.phone || "", studentId: student.studentId },
    });
  } catch (err) {
    console.error(err);
    res.json({ success: true, student: null });
  }
});

// POST /api/store/quote - price a cart without placing an order.
// Body: { items, couponCode, email?, studentId? }. Prices, discounts and stock are
// all computed here; the browser only displays them. The real checkout recalculates everything again.
router.post("/quote", optionalAuth, async (req, res) => {
  try {
    const student = await getLoggedInStudent(req);
    const { items, couponCode, email, studentId } = req.body;

    const priced = priceOrder(items, { couponCode, isStudent: !!student });
    await inventory.assertAvailable(priced.lines);

    const who = { email, studentId: student ? student.studentId : studentId };
    if (await couponAlreadyUsed(priced.coupon, who)) throw new PricingError(`You've already used ${priced.coupon.code}.`);
    if (await couponExhausted(priced.coupon)) throw new PricingError(`${priced.coupon.code} has reached its usage limit.`);

    res.json({
      success: true,
      subtotal: priced.subtotal,
      discountAmount: priced.discountAmount,
      discountLabel: priced.discountLabel,
      couponCode: priced.couponCode,
      couponSkipped: priced.couponSkipped,
      studentDiscount: priced.studentDiscount,
      totalAmount: priced.totalAmount,
    });
  } catch (err) {
    if (err instanceof PricingError) return fail(res, 400, err.message);
    console.error(err);
    fail(res, 500, "Could not price your cart.");
  }
});

// POST /api/store/orders - public checkout submission (no login required)
router.post("/orders", optionalAuth, async (req, res) => {
  let reserved = null;
  try {
    const { customerName, email, phone, address, studentId, items, paymentMethod, transactionRef, couponCode } = req.body;

    if (!customerName || !email || !phone || !address) return fail(res, 400, "Name, email, phone and address are required.");
    if (!/^\S+@\S+\.\S+$/.test(String(email).trim())) return fail(res, 400, "Enter a valid email address.");
    if (String(phone).replace(/\D/g, "").length < 10) return fail(res, 400, "Enter a valid phone number.");
    if (!["UPI", "COD"].includes(paymentMethod)) return fail(res, 400, "Choose a valid payment method.");

    let ref;
    if (paymentMethod === "UPI") {
      ref = String(transactionRef || "").trim();
      if (!ref) return fail(res, 400, "Enter your UPI transaction/reference ID after paying.");
      if (!/^[A-Za-z0-9-]{6,40}$/.test(ref)) return fail(res, 400, "That UPI reference ID doesn't look right (6-40 letters/numbers).");
      // The same payment can't be used for two orders
      if (await Order.exists({ transactionRef: ref, status: { $ne: "Cancelled" } })) {
        return fail(res, 400, "That UPI reference ID has already been used on another order.");
      }
    }

    // Rebuild the order from the trusted server catalog and rules so a
    // tampered client request can't change prices, sizes, discounts or totals.
    const student = await getLoggedInStudent(req);
    const priced = priceOrder(items, { couponCode, isStudent: !!student });

    // A logged-in student's real roll number always wins over whatever was typed,
    // so their order can be tracked and the discount can't be borrowed.
    const finalStudentId = student ? student.studentId : studentId;

    if (await couponAlreadyUsed(priced.coupon, { email, studentId: finalStudentId })) {
      return fail(res, 400, `You've already used ${priced.coupon.code}.`);
    }
    if (await couponExhausted(priced.coupon)) return fail(res, 400, `${priced.coupon.code} has reached its usage limit.`);

    // Take the stock first (atomic); if saving the order then fails, it is put back.
    await inventory.reserve(priced.lines);
    reserved = priced.lines;

    const now = new Date();
    const order = await Order.create({
      customerName,
      email,
      phone,
      address,
      studentId: finalStudentId,
      items: priced.lines,
      subtotal: priced.subtotal,
      discountAmount: priced.discountAmount,
      discountLabel: priced.discountLabel || undefined,
      couponCode: priced.couponCode || undefined,
      studentDiscount: priced.studentDiscount,
      totalAmount: priced.totalAmount,
      paymentMethod,
      transactionRef: ref,
      paymentStatus: paymentMethod === "UPI" ? "Awaiting Verification" : "Pay on Pickup",
      estimatedDelivery: new Date(now.getTime() + DELIVERY_DAYS * 24 * 60 * 60 * 1000),
      statusHistory: [{ status: "Pending", at: now, by: "customer", note: "Order placed" }],
      stockReserved: true,
    });
    reserved = null;

    // Not awaited on purpose: a slow or failing SMS provider must never delay or break a saved order.
    sendOrderSms(order);

    res.status(201).json({ success: true, order });
  } catch (err) {
    if (reserved) await inventory.release(reserved).catch((e) => console.error("Stock rollback failed:", e.message));
    if (err instanceof PricingError) return fail(res, 400, err.message);
    console.error(err);
    fail(res, 500, "Could not place order.");
  }
});

// GET /api/store/track?orderId=...&studentId=...
// Public order lookup ("Track Your Order" form). Needs BOTH the order ID and the
// student ID entered at checkout. Returns status + timeline only, never email/phone/address.
router.get("/track", async (req, res) => {
  try {
    const { orderId, studentId } = req.query;
    if (!orderId || !studentId) return fail(res, 400, "Enter both your Order ID and Student ID.");

    const id = String(orderId).trim();
    const order = mongoose.isValidObjectId(id) ? await Order.findById(id) : null;

    // Same message whether the order doesn't exist or the student ID is wrong, so this can't probe for valid IDs.
    if (!order || !sameId(order.studentId, studentId)) {
      return fail(res, 404, "No matching order found. Double-check your Order ID and Student ID.");
    }
    res.json({ success: true, order: publicOrder(order) });
  } catch (err) {
    console.error(err);
    fail(res, 500, "Could not look up that order.");
  }
});

// GET /api/store/orders/mine - the logged-in student's order history
router.get("/orders/mine", protect, authorize("student"), async (req, res) => {
  try {
    const student = await Student.findById(req.user.profileId);
    if (!student) return res.json({ success: true, orders: [] });
    const orders = await Order.find({ studentId: new RegExp(`^${escapeRegex(student.studentId)}$`, "i") }).sort({ createdAt: -1 });
    res.json({ success: true, orders: orders.map(publicOrder) });
  } catch (err) {
    console.error(err);
    fail(res, 500, "Could not load your orders.");
  }
});

// POST /api/store/orders/:id/cancel - customer cancellation (rules in lib/orderRules.js)
// Logged-in student: must own the order. Guest: must send the studentId used at checkout.
router.post("/orders/:id/cancel", optionalAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const order = mongoose.isValidObjectId(id) ? await Order.findById(id) : null;
    const student = await getLoggedInStudent(req);
    const claimed = student ? student.studentId : req.body.studentId;
    if (!order || !sameId(order.studentId, claimed)) return fail(res, 404, "No matching order found.");

    const why = rules.customerCancelError(order);
    if (why) return fail(res, 400, why);

    const reason = String(req.body.reason || "").trim().slice(0, 200) || "Cancelled by customer";
    const updated = await cancelOrder(order._id, { by: "customer", reason, allowedFrom: ["Pending"] });
    if (!updated) return fail(res, 409, "This order was just updated by the store and can no longer be cancelled online.");
    res.json({ success: true, order: publicOrder(updated) });
  } catch (err) {
    console.error(err);
    fail(res, 500, "Could not cancel the order.");
  }
});

/* ---------------- ADMIN ---------------- */

// GET /api/store/orders - admin-only order list (contains customer email/phone/address)
router.get("/orders", protect, authorize("admin"), async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 }).limit(1000);
  res.json({ success: true, orders });
});

// PATCH /api/store/orders/:id - admin: payment status, order status, refund
// Body: { paymentStatus?, status?, reason? (required when cancelling), refundStatus?: "Refunded" }
router.patch("/orders/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const { paymentStatus, status, reason, refundStatus } = req.body;
    const order = mongoose.isValidObjectId(req.params.id) ? await Order.findById(req.params.id) : null;
    if (!order) return fail(res, 404, "Order not found");

    if (order.status === "Cancelled" && (paymentStatus || (status && status !== "Cancelled"))) {
      return fail(res, 400, "This order is cancelled; its status and payment can't be changed.");
    }

    if (refundStatus) {
      if (refundStatus !== "Refunded" || order.refundStatus !== "Refund Due") return fail(res, 400, "Only a refund that is due can be marked Refunded.");
      order.refundStatus = "Refunded";
      order.statusHistory.push({ status: order.status, by: "admin", note: "Refund marked as paid" });
    }

    if (paymentStatus) {
      if (!rules.PAYMENT_STATUSES.includes(paymentStatus)) return fail(res, 400, "Invalid payment status.");
      if (order.paymentMethod === "COD" && ["Awaiting Verification", "Failed"].includes(paymentStatus)) {
        return fail(res, 400, "That payment status doesn't apply to a pay-on-pickup order.");
      }
      if (order.paymentMethod === "UPI" && paymentStatus === "Pay on Pickup") return fail(res, 400, "That payment status doesn't apply to a UPI order.");
      if (paymentStatus !== order.paymentStatus) {
        order.paymentStatus = paymentStatus;
        order.statusHistory.push({ status: order.status, by: "admin", note: `Payment: ${paymentStatus}` });
      }
    }

    if (status === "Cancelled" && order.status !== "Cancelled") {
      const why = String(reason || "").trim();
      if (!why) return fail(res, 400, "Give a reason for cancelling this order.");
      if (order.isModified()) await order.save();
      const updated = await cancelOrder(order._id, { by: "admin", reason: why.slice(0, 200), allowedFrom: ["Pending", "Processing", "Ready for Pickup"] });
      if (!updated) return fail(res, 400, `A "${order.status}" order can't be cancelled.`);
      return res.json({ success: true, order: updated });
    }

    if (status && status !== order.status) {
      const err = rules.statusChangeError(order, status);
      if (err) return fail(res, 400, err);
      order.status = status;
      if (status === "Completed" && order.paymentMethod === "COD") order.paymentStatus = "Paid"; // cash collected at pickup
      order.statusHistory.push({ status, by: "admin" });
    }

    await order.save();
    res.json({ success: true, order });
  } catch (err) {
    console.error(err);
    fail(res, 500, "Could not update the order.");
  }
});

// GET /api/store/stock - admin: every product with live stock, low-stock level and units sold
router.get("/stock", protect, authorize("admin"), async (req, res) => {
  const map = await inventory.stockMap();
  const sold = await Order.aggregate([
    { $match: { status: { $ne: "Cancelled" } } },
    { $unwind: "$items" },
    { $group: { _id: "$items.productId", sold: { $sum: "$items.quantity" } } },
  ]);
  const soldById = Object.fromEntries(sold.map((r) => [r._id, r.sold]));
  res.json({
    success: true,
    items: STORE_CATALOG.map((p) => ({
      productId: p.id, name: p.name, category: p.category, price: p.price,
      stock: map[p.id] ? map[p.id].stock : 0,
      lowStockAt: map[p.id] && map[p.id].lowStockAt != null ? map[p.id].lowStockAt : 10,
      sold: soldById[p.id] || 0,
    })),
  });
});

// PATCH /api/store/stock/:productId - admin. Body: { stock } to set, or { adjust } (+/-) to add or remove, and/or { lowStockAt }
router.patch("/stock/:productId", protect, authorize("admin"), async (req, res) => {
  try {
    const id = req.params.productId;
    if (!STORE_CATALOG.some((p) => p.id === id)) return fail(res, 404, "Unknown product.");
    await inventory.ensureStock();
    const { stock, adjust, lowStockAt } = req.body;

    if (lowStockAt !== undefined) {
      const n = Number(lowStockAt);
      if (!Number.isInteger(n) || n < 0) return fail(res, 400, "Low-stock level must be a whole number, 0 or more.");
      await Stock.updateOne({ productId: id }, { $set: { lowStockAt: n } });
    }
    if (stock !== undefined) {
      const n = Number(stock);
      if (!Number.isInteger(n) || n < 0 || n > 100000) return fail(res, 400, "Stock must be a whole number, 0 or more.");
      await Stock.updateOne({ productId: id }, { $set: { stock: n } });
    } else if (adjust !== undefined) {
      const n = Number(adjust);
      if (!Number.isInteger(n) || n === 0 || Math.abs(n) > 100000) return fail(res, 400, "Adjustment must be a non-zero whole number.");
      const r = await Stock.updateOne({ productId: id, stock: { $gte: n < 0 ? -n : 0 } }, { $inc: { stock: n } });
      if (r.modifiedCount !== 1) return fail(res, 400, "That would take stock below zero.");
    }
    res.json({ success: true, item: await Stock.findOne({ productId: id }) });
  } catch (err) {
    console.error(err);
    fail(res, 500, "Could not update stock.");
  }
});

module.exports = router;
