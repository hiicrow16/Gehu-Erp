const express = require("express");
const router = express.Router();

const Order = require("../models/Order");
const Student = require("../models/Student");
const { STORE_CATALOG } = require("../lib/storeCatalog");
const { priceOrder, PricingError } = require("../lib/pricing");
const { protect, optionalAuth, authorize } = require("../middleware/auth");
const { sendOrderSms } = require("../lib/sms");

const DELIVERY_DAYS = 7;

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

// GET /api/store/items - public product catalog (no login required)
// Each item also carries `sold` (units in non-cancelled orders) for "Popularity" sorting.
router.get("/items", async (req, res) => {
  let soldById = {};
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
  res.json({
    success: true,
    items: STORE_CATALOG.map((p) => ({ ...p, sold: soldById[p.id] || 0 })),
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
      student: {
        name: student.name,
        email: student.email || "",
        phone: student.phone || "",
        studentId: student.studentId,
      },
    });
  } catch (err) {
    console.error(err);
    res.json({ success: true, student: null });
  }
});

// POST /api/store/quote - price a cart without placing an order.
// Body: { items, couponCode, email?, studentId? }. Used by the cart drawer and
// checkout screen to show the exact amount BEFORE the buyer pays (email /
// studentId let us catch an already-used once-per-customer coupon early).
// The real checkout recalculates everything again.
router.post("/quote", optionalAuth, async (req, res) => {
  try {
    const student = await getLoggedInStudent(req);
    const { items, couponCode, email, studentId } = req.body;

    const priced = priceOrder(items, { couponCode, isStudent: !!student });

    const who = { email, studentId: student ? student.studentId : studentId };
    if (await couponAlreadyUsed(priced.coupon, who)) {
      throw new PricingError(`You've already used ${priced.coupon.code}.`);
    }

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
    if (err instanceof PricingError) return res.status(400).json({ success: false, message: err.message });
    console.error(err);
    res.status(500).json({ success: false, message: "Could not price your cart." });
  }
});

// POST /api/store/orders - public checkout submission (no login required)
router.post("/orders", optionalAuth, async (req, res) => {
  try {
    const { customerName, email, phone, address, studentId, items, paymentMethod, transactionRef, couponCode } = req.body;

    if (!customerName || !email || !phone || !address) {
      return res.status(400).json({
        success: false,
        message: "Name, email, phone and address are required.",
      });
    }

    if (!["UPI", "COD"].includes(paymentMethod)) {
      return res.status(400).json({ success: false, message: "Choose a valid payment method." });
    }

    if (paymentMethod === "UPI" && !transactionRef) {
      return res.status(400).json({
        success: false,
        message: "Enter your UPI transaction/reference ID after paying.",
      });
    }

    // Rebuild the order from the trusted server catalog and rules so a
    // tampered client request can't change prices, sizes or discounts.
    const student = await getLoggedInStudent(req);
    const priced = priceOrder(items, { couponCode, isStudent: !!student });

    // A logged-in student's real roll number always wins over whatever was typed,
    // so their order can be tracked and the discount can't be borrowed.
    const finalStudentId = student ? student.studentId : studentId;

    if (await couponAlreadyUsed(priced.coupon, { email, studentId: finalStudentId })) {
      return res.status(400).json({ success: false, message: `You've already used ${priced.coupon.code}.` });
    }

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
      transactionRef: paymentMethod === "UPI" ? transactionRef : undefined,
      paymentStatus: paymentMethod === "UPI" ? "Awaiting Verification" : "Pay on Pickup",
      estimatedDelivery: new Date(Date.now() + DELIVERY_DAYS * 24 * 60 * 60 * 1000),
    });

    // Text the buyer their confirmation. Not awaited on purpose: a slow or
    // failing SMS provider must never delay or break a saved order.
    sendOrderSms(order);

    res.status(201).json({ success: true, order });
  } catch (err) {
    if (err instanceof PricingError) return res.status(400).json({ success: false, message: err.message });
    console.error(err);
    res.status(500).json({ success: false, message: "Could not place order." });
  }
});

// GET /api/store/track?orderId=...&studentId=...
// Public order lookup for the "Track Your Order" form — no login required,
// since checkout itself doesn't require login. Requires BOTH the order ID
// and the student ID that was entered at checkout, so knowing the order ID
// alone (e.g. from a leaked link) isn't enough to see someone else's order.
// Returns only what's needed to show status — not the buyer's email/phone/
// address, which stay admin-only.
router.get("/track", async (req, res) => {
  try {
    const { orderId, studentId } = req.query;

    if (!orderId || !studentId) {
      return res.status(400).json({ success: false, message: "Enter both your Order ID and Student ID." });
    }

    let order;
    try {
      order = await Order.findById(String(orderId).trim());
    } catch (err) {
      // Malformed ObjectId (wrong length/characters) - treat as "not found"
      // rather than a 500, same as a genuinely missing order.
      order = null;
    }

    const enteredStudentId = String(studentId).trim().toLowerCase();
    const matches = order && order.studentId && order.studentId.trim().toLowerCase() === enteredStudentId;

    if (!matches) {
      // Same message whether the order doesn't exist or the student ID is
      // wrong, so this can't be used to probe for valid order IDs.
      return res.status(404).json({ success: false, message: "No matching order found. Double-check your Order ID and Student ID." });
    }

    res.json({
      success: true,
      order: {
        _id: order._id,
        createdAt: order.createdAt,
        estimatedDelivery: order.estimatedDelivery,
        items: order.items,
        subtotal: order.subtotal,
        discountAmount: order.discountAmount,
        discountLabel: order.discountLabel,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        status: order.status,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Could not look up that order." });
  }
});

// GET /api/store/orders - admin-only order list.
// Orders contain customer email/phone/address, so this stays behind login
// even though browsing and checkout are public.
router.get("/orders", protect, authorize("admin"), async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 });
  res.json({ success: true, orders });
});

// PATCH /api/store/orders/:id - admin-only: update payment/fulfillment status
router.patch("/orders/:id", protect, authorize("admin"), async (req, res) => {
  const { paymentStatus, status } = req.body;
  const update = {};
  if (paymentStatus) update.paymentStatus = paymentStatus;
  if (status) update.status = status;

  const order = await Order.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!order) return res.status(404).json({ success: false, message: "Order not found" });
  res.json({ success: true, order });
});

module.exports = router;
