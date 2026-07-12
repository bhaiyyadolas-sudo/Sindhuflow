// Shared helper: verifies the Supabase access token sent from the browser
// and returns the real, authenticated user - so nobody can fake a user_id.

export async function getVerifiedUser(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!token) return null;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': SUPABASE_PUBLISHABLE_KEY
    }
  });

  if (!response.ok) return null;
  const user = await response.json();
  return user && user.id ? user : null;
}
