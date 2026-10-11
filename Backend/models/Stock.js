const mongoose = require("mongoose");

// Live stock level per catalog product. The catalog file only supplies the
// STARTING stock the first time a product is seen; after that this collection
// is the source of truth (orders decrement it, cancellations restore it).
const stockSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true, unique: true, trim: true },
    stock: { type: Number, required: true, min: 0, default: 0 },
    lowStockAt: { type: Number, min: 0, default: 10 }, // admin sees a "low" warning at or below this
  },
  { timestamps: true }
);

module.exports = mongoose.model("Stock", stockSchema);
