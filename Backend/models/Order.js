const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    size: { type: String, trim: true },  // only for items that come in sizes
    color: { type: String, trim: true }, // only for items that come in colors
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    studentId: { type: String, trim: true }, // optional roll no., for pickup verification
    items: {
      type: [orderItemSchema],
      required: true,
      validate: (v) => Array.isArray(v) && v.length > 0,
    },
    subtotal: { type: Number, min: 0 },        // before any discount (older orders don't have this)
    discountAmount: { type: Number, default: 0, min: 0 },
    discountLabel: { type: String, trim: true }, // e.g. "Fresher offer: 10% off"
    couponCode: { type: String, trim: true, uppercase: true },
    studentDiscount: { type: Boolean, default: false },
    totalAmount: { type: Number, required: true, min: 0 }, // what the buyer actually pays
    paymentMethod: {
      type: String,
      enum: ["UPI", "COD"],
      required: true,
    },
    transactionRef: { type: String, trim: true }, // buyer-entered UPI transaction/UTR ID, only for UPI orders
    paymentStatus: {
      type: String,
      enum: ["Awaiting Verification", "Pay on Pickup", "Paid", "Failed"],
      required: true,
    },
    estimatedDelivery: { type: Date }, // set at checkout: order date + 7 days
    status: {
      type: String,
      enum: ["Pending", "Processing", "Ready for Pickup", "Completed", "Cancelled"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
