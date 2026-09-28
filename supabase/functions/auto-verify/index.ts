// Commissioner — automatic creator verification (YouTube).
//
// Deploy:  supabase functions deploy auto-verify
// Secret:  supabase secrets set YOUTUBE_API_KEY=<YouTube Data API v3 key>
//
// The signed-in creator calls this with their own session. The function reads
// the channel's REAL subscriber count and description from YouTube, then asks
// the database to verify only if the count meets the live threshold (15,000)
// and the creator's ownership code is in the channel description. The browser
// never decides the outcome.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const CHANNEL_ID = /^UC[\w-]{22}$/;
const handleFrom = (v: string) => {
  const t = (v || '').trim();
  if (/^@[\w.\-]{3,}$/.test(t)) return t;
  const m = t.match(/youtube\.com\/(@[\w.\-]{3,})/i);
  return m ? m[1] : '';
};
const channelIdFrom = (v: string) => {
  const t = (v || '').trim();
  if (CHANNEL_ID.test(t)) return t;
  const m = t.match(/youtube\.com\/channel\/(UC[\w-]{22})/i);
  return m ? m[1] : '';
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ytKey = Deno.env.get('YOUTUBE_API_KEY');

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ status: 'error', message: 'Please sign in again.' }, 401);

    if (!ytKey) {
      return json({ status: 'not_configured', message: 'Automatic checks are not switched on yet. Your request is in the admin review queue.' });
    }

    const admin = createClient(url, service);
    const { data: profile } = await admin.from('creator_profiles').select('id').eq('auth_user_id', user.id).maybeSingle();
    if (!profile) return json({ status: 'error', message: 'Creator profile not found.' }, 404);
    const { data: claim } = await admin.from('creator_verification_claims').select('*').eq('creator_profile_id', profile.id).maybeSingle();
    if (!claim) return json({ status: 'error', message: 'Submit your verification request first.' }, 404);
    if (claim.status === 'verified') return json({ status: 'verified', message: 'You are already verified.' });

    if (String(claim.platform || '').toLowerCase() !== 'youtube') {
      return json({ status: 'manual_review', message: 'Automatic checks currently cover YouTube. Your request is in the admin review queue.' });
    }
    if (!['code', 'bio'].includes(String(claim.ownership_method || ''))) {
      return json({ status: 'pending', message: 'Choose “Put a code in your bio” as the ownership proof to use automatic verification.' });
    }

    const idRaw = String(claim.platform_account_id || '');
    const userRaw = String(claim.claimed_username || '');
    const channelId = channelIdFrom(idRaw) || channelIdFrom(userRaw);
    const handle = handleFrom(userRaw) || handleFrom(idRaw);
    const lookup = channelId ? `id=${channelId}` : handle ? `forHandle=${encodeURIComponent(handle)}` : '';
    if (!lookup) {
      return json({ status: 'pending', message: 'Enter your channel ID (starts with UC) or your @handle so we can find your channel.' });
    }

    const yt = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&${lookup}&key=${ytKey}`);
    if (!yt.ok) return json({ status: 'error', message: 'YouTube could not be reached right now. Try again in a few minutes.' }, 502);
    const body = await yt.json();
    const item = body?.items?.[0];
    if (!item) return json({ status: 'pending', message: 'We could not find that YouTube channel. Check the channel ID or handle.' });

    const stats = item.statistics ?? {};
    const followers = stats.hiddenSubscriberCount ? null : Number(stats.subscriberCount ?? NaN);
    const code = `CMS-${String(profile.id).replace(/-/g, '').slice(0, 6).toUpperCase()}`;
    const description = String(item.snippet?.description ?? '').toUpperCase();
    const codeFound = description.includes(code);

    const { data: result, error } = await admin.rpc('service_auto_verify_creator', {
      p_claim_id: claim.id,
      p_followers: Number.isFinite(followers as number) ? followers : null,
      p_code_found: codeFound,
      p_channel_id: item.id,
      p_handle: item.snippet?.customUrl ?? null,
    });
    if (error) return json({ status: 'error', message: 'Automatic check failed. Your request is still in the admin review queue.' }, 500);

    const { data: fresh } = await admin.from('creator_verification_claims').select('auto_check_message').eq('id', claim.id).maybeSingle();
    return json({
      status: result?.status ?? 'pending',
      reason: result?.reason,
      followers,
      threshold: result?.threshold,
      message: result?.status === 'verified'
        ? 'You are verified. Your follower count and ownership code were confirmed automatically.'
        : (fresh?.auto_check_message || 'Your request is in the admin review queue.'),
    });
  } catch (_e) {
    return json({ status: 'error', message: 'Automatic check failed. Your request is still in the admin review queue.' }, 500);
  }
});
