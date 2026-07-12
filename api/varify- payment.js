import crypto from 'crypto';
import { getVerifiedUser } from './_auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Only POST allowed' });

  try {
    const user = await getVerifiedUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Please log in before making a payment.' });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment details' });
    }

    const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment verification failed. Signature mismatch.' });
    }

    // Signature is valid - this payment is genuine. Add 5 credits to the user.
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const CREDITS_TO_ADD = 5;

    // Read current balance
    const getRes = await fetch(
      `${SUPABASE_URL}/rest/v1/user_credits?user_id=eq.${user.id}&select=credits`,
      {
        headers: {
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`
        }
      }
    );
    const rows = await getRes.json();
    const currentCredits = (rows && rows[0] && rows[0].credits) || 0;
    const newCredits = currentCredits + CREDITS_TO_ADD;

    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/user_credits`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify({
        user_id: user.id,
        credits: newCredits,
        updated_at: new Date().toISOString()
      })
    });

    if (!upsertRes.ok) {
      const errText = await upsertRes.text();
      console.error('Supabase upsert failed:', errText);
      return res.status(500).json({ error: 'Payment verified but could not update credits. Contact support.' });
    }

    return res.status(200).json({ success: true, credits: newCredits });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error verifying payment' });
  }
        }
