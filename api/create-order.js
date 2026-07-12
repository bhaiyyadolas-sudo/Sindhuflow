// Creates a Razorpay order for the "5 resume credits" pack (₹149).
// The amount is fixed here on the server - never trust an amount sent from the browser.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST allowed' });

  const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
  const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return res.status(500).json({ error: 'Server is missing Razorpay keys.' });
  }

  const AMOUNT_IN_PAISE = 14900; // ₹149, fixed price for the 5-credit pack

  try {
    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify({
        amount: AMOUNT_IN_PAISE,
        currency: 'INR',
        notes: { product: 'SindhuFlow - 5 Resume Credits' }
      })
    });

    const order = await response.json();

    if (order.error) {
      return res.status(500).json({ error: order.error.description || 'Razorpay order creation failed' });
    }

    return res.status(200).json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: RAZORPAY_KEY_ID // public key, safe to send to browser
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error creating order' });
  }
}
