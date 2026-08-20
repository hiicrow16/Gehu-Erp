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
