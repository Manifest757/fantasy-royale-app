import { createClient } from '@supabase/supabase-js';
async function main() {
  const s = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  // Check streak for Manifesto (the winner)
  const userId = 'd7e3e3c7-60a9-40ce-86cb-dc6c84d758e0';
  const { data: streak } = await s.from('streak_tracking').select('*').eq('user_id', userId).single();
  console.log('Streak for Manifesto:', JSON.stringify(streak, null, 2));
  
  // Check wins - current query uses 'rank' column
  const { count: winsRank, error: e1 } = await s.from('contest_scores').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('rank', 1);
  console.log('Wins (rank=1):', winsRank, 'error:', e1?.message);
  
  const { count: winsRankInt, error: e2 } = await s.from('contest_scores').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('rank_int', 1);
  console.log('Wins (rank_int=1):', winsRankInt, 'error:', e2?.message);
  
  // Check picks count
  const { data: picks, count: picksCount } = await s.from('picks').select('contest_id', { count: 'exact', head: false }).eq('user_id', userId);
  console.log('Picks:', picks?.length, 'Count:', picksCount);
}
main();
