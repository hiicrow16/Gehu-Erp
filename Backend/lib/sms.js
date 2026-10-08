// Sends the "order confirmed" SMS to the buyer.
//
// Pick a provider in Backend/.env with SMS_PROVIDER:
//   twilio    -> needs TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM
//   fast2sms  -> needs FAST2SMS_API_KEY   (popular in India)
//   (unset)   -> SMS is skipped and the message is printed in the server log,
//                so checkout still works while you are developing.
//
// An SMS failure must NEVER fail the order, so callers should not await this
// for the HTTP response and errors are swallowed/logged here.

// Turn what the buyer typed into a clean number.
// 10-digit Indian mobile numbers get +91; anything with a country code is kept.
function normalizePhone(raw) {
  const digits = String(raw || "").replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  const plain = digits.replace(/^0+/, "");
  if (plain.length === 10) return `+91${plain}`;
  if (plain.length === 12 && plain.startsWith("91")) return `+${plain}`;
  return null;
}

function formatDate(d) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function buildOrderMessage(order) {
  const eta = formatDate(order.estimatedDelivery);
  return (
    `GEHU Store: Hi ${order.customerName.split(" ")[0]}, your order of Rs.${order.totalAmount} ` +
    `has been placed and will be delivered within 7 days (by ${eta}). ` +
    `Order ID: ${order._id}. Use it with your Student ID to track your order.`
  );
}

async function sendViaTwilio(to, body) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) {
    throw new Error("Twilio env vars missing");
  }
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body }),
    }
  );
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
}

async function sendViaFast2Sms(to, body) {
  const { FAST2SMS_API_KEY } = process.env;
  if (!FAST2SMS_API_KEY) throw new Error("FAST2SMS_API_KEY missing");
  // Fast2SMS wants the plain 10-digit number (no +91)
  const number = to.replace(/^\+91/, "");
  const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
    method: "POST",
    headers: { authorization: FAST2SMS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ route: "q", message: body, numbers: number }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.return === false) {
    throw new Error(`Fast2SMS ${res.status}: ${JSON.stringify(data)}`);
  }
}

async function sendOrderSms(order) {
  try {
    const to = normalizePhone(order.phone);
    if (!to) {
      console.warn(`[sms] Skipped: could not read phone number "${order.phone}"`);
      return false;
    }

    const body = buildOrderMessage(order);
    const provider = (process.env.SMS_PROVIDER || "").toLowerCase();

    if (provider === "twilio") await sendViaTwilio(to, body);
    else if (provider === "fast2sms") await sendViaFast2Sms(to, body);
    else {
      console.log(`[sms] SMS_PROVIDER not set - would have sent to ${to}: ${body}`);
      return false;
    }

    console.log(`[sms] Order confirmation sent to ${to}`);
    return true;
  } catch (err) {
    console.error("[sms] Failed to send order SMS:", err.message);
    return false;
  }
}

module.exports = { sendOrderSms, normalizePhone };
