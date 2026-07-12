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
      return res.status(401).json({ error: 'Please log in first.' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

    if (currentCredits < 1) {
      return res.status(402).json({ error: 'No credits remaining. Please buy a credits pack.', credits: 0 });
    }

    const newCredits = currentCredits - 1;

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
      return res.status(500).json({ error: 'Could not update credits.' });
    }

    return res.status(200).json({ success: true, credits: newCredits });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error using credit' });
  }
}
