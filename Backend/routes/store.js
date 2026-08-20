const express = require("express");
const router = express.Router();

const Order = require("../models/Order");
const { STORE_CATALOG, findProduct } = require("../lib/storeCatalog");
const { protect, authorize } = require("../middleware/auth");

// GET /api/store/items - public product catalog (no login required)
router.get("/items", (req, res) => {
  res.json({ success: true, items: STORE_CATALOG });
});

// POST /api/store/orders - public checkout submission (no login required)
router.post("/orders", async (req, res) => {
  try {
    const { customerName, email, phone, address, studentId, items, paymentMethod, transactionRef } = req.body;

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

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty." });
    }

    // Rebuild the order line-by-line from the trusted server catalog so a
    // tampered client request can't change prices or invent products.
    let totalAmount = 0;
    const orderItems = [];

    for (const line of items) {
      const product = findProduct(line.productId);
      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Unknown product: ${line.productId}`,
        });
      }

      const quantity = Number(line.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({
          success: false,
          message: `Invalid quantity for ${product.name}.`,
        });
      }

      orderItems.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity,
      });
      totalAmount += product.price * quantity;
    }

    const order = await Order.create({
      customerName,
      email,
      phone,
      address,
      studentId,
      items: orderItems,
      totalAmount,
      paymentMethod,
      transactionRef: paymentMethod === "UPI" ? transactionRef : undefined,
      paymentStatus: paymentMethod === "UPI" ? "Awaiting Verification" : "Pay on Pickup",
    });

    res.status(201).json({ success: true, order });
  } catch (err) {
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
        items: order.items,
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
