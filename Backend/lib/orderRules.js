// Order lifecycle + cancellation rules, in one place so the customer screens,
// the admin screen and the API can never disagree.
//
//   Pending -> Processing -> Ready for Pickup -> Completed
//   Pending / Processing / Ready for Pickup -> Cancelled
//   Completed and Cancelled are final.

const STATUSES = ["Pending", "Processing", "Ready for Pickup", "Completed", "Cancelled"];
const PAYMENT_STATUSES = ["Awaiting Verification", "Pay on Pickup", "Paid", "Failed"];

const TRANSITIONS = {
  Pending: ["Processing", "Cancelled"],
  Processing: ["Ready for Pickup", "Cancelled"],
  "Ready for Pickup": ["Completed", "Cancelled"],
  Completed: [],
  Cancelled: [],
};

// CANCELLATION RULES
//  * A customer may cancel only while the order is still "Pending" (the store
//    hasn't started preparing it). After that, they must contact the store.
//  * Admin may cancel any order that isn't Completed or Cancelled, and must give a reason.
//  * Cancelling puts the stock back and frees a used coupon.
//  * If a UPI payment was already verified (Paid), the order is flagged "Refund Due".
const CUSTOMER_CANCELLABLE = ["Pending"];

function customerCancelError(order) {
  if (order.status === "Cancelled") return "This order is already cancelled.";
  if (order.status === "Completed") return "Completed orders can't be cancelled.";
  if (!CUSTOMER_CANCELLABLE.includes(order.status)) {
    return `This order is already "${order.status}", so it can no longer be cancelled online. Please contact the college store.`;
  }
  return null;
}

// Returns an error message, or null when moving `order` to `to` is allowed.
function statusChangeError(order, to) {
  if (!STATUSES.includes(to)) return "Invalid order status.";
  if (to === order.status) return null;
  if (!TRANSITIONS[order.status].includes(to)) {
    return `An order that is "${order.status}" can't move to "${to}".`;
  }
  if (to === "Processing" && order.paymentMethod === "UPI" && order.paymentStatus !== "Paid") {
    return "Verify the UPI payment (mark it Paid) before processing this order.";
  }
  return null;
}

module.exports = { STATUSES, PAYMENT_STATUSES, TRANSITIONS, customerCancelError, statusChangeError };
