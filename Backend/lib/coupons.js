// Coupon codes. Edit this list to add, change or retire a coupon.
// Codes are matched case-insensitively.
//
// Fields:
//   label            - text shown to the buyer
//   type             - "percent" or "flat"
//   value            - percent (e.g. 10) or rupees (e.g. 200)
//   maxDiscount      - (percent only) cap in rupees
//   minSubtotal      - order must be at least this many rupees
//   oncePerCustomer  - one use per email / student ID (cancelled orders don't count)
//   expires          - optional "YYYY-MM-DD" (valid through the end of that day)

const COUPONS = {
  FRESHER10: {
    label: "Fresher offer: 10% off",
    type: "percent",
    value: 10,
    maxDiscount: 300,
    minSubtotal: 500,
    oncePerCustomer: true,
  },
  BULK15: {
    label: "Bulk order: 15% off orders of Rs.3000+",
    type: "percent",
    value: 15,
    maxDiscount: 1000,
    minSubtotal: 3000,
  },
};

// Automatic discount for logged-in students (no code needed).
const STUDENT_DISCOUNT = { label: "Student discount: 5% off", percent: 5, maxDiscount: 500 };

function findCoupon(code) {
  if (!code) return null;
  const key = String(code).trim().toUpperCase();
  return COUPONS[key] ? { code: key, ...COUPONS[key] } : null;
}

module.exports = { COUPONS, STUDENT_DISCOUNT, findCoupon };
