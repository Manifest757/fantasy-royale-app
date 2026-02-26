import { Router } from 'express';
import { supabaseAdmin } from './supabase-admin';

export function registerSponsorRoutes(router: Router) {

  async function getUserFromToken(authHeader?: string): Promise<string | null> {
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('[Auth:Sponsor] Missing or malformed Authorization header');
      return null;
    }
    try {
      const token = authHeader.slice(7);
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (error) {
        console.log(`[Auth:Sponsor] Token validation failed: ${error.message}`);
        return null;
      }
      return user?.id || null;
    } catch (e: any) {
      console.log(`[Auth:Sponsor] Token error: ${e.message || 'unknown'}`);
      return null;
    }
  }

  async function isAdmin(userId: string): Promise<boolean> {
    const { data } = await supabaseAdmin.from('user_profiles').select('is_admin').eq('id', userId).single();
    return data?.is_admin === true;
  }

  async function isSponsor(userId: string): Promise<string | null> {
    const { data } = await supabaseAdmin.from('sponsor_profiles').select('id, status').eq('user_id', userId).single();
    if (data?.status === 'approved') return data.id;

    const { data: profile } = await supabaseAdmin.from('user_profiles').select('role, username').eq('id', userId).single();
    if (profile?.role === 'sponsor') {
      if (data) {
        if (data.status !== 'approved') {
          const { data: updated } = await supabaseAdmin
            .from('sponsor_profiles')
            .update({ status: 'approved' })
            .eq('id', data.id)
            .select('id')
            .single();
          return updated?.id || null;
        }
        return data.id;
      }
      const { data: newSponsor } = await supabaseAdmin
        .from('sponsor_profiles')
        .insert({
          user_id: userId,
          company_name: profile.username || 'Sponsor',
          status: 'approved',
          contact_email: '',
        })
        .select('id')
        .single();
      return newSponsor?.id || null;
    }

    return null;
  }

  // ==========================================
  // Sponsor Profile Routes
  // ==========================================

  router.get('/api/sponsor/profile', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      let { data, error } = await supabaseAdmin
        .from('sponsor_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if ((error || !data)) {
        const { data: profile } = await supabaseAdmin.from('user_profiles').select('role, username').eq('id', userId).single();
        if (profile?.role === 'sponsor') {
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
          const { data: newSponsor, error: createErr } = await supabaseAdmin
            .from('sponsor_profiles')
            .insert({
              user_id: userId,
              company_name: profile.username || 'Sponsor',
              status: 'approved',
              contact_email: authUser?.user?.email || '',
            })
            .select('*')
            .single();
          if (createErr || !newSponsor) return res.status(404).json({ error: 'Sponsor profile not found' });
          return res.json(newSponsor);
        }
        return res.status(404).json({ error: 'Sponsor profile not found' });
      }

      res.json(data);
    } catch (err: any) {
      console.error('[Sponsor] profile get error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.put('/api/sponsor/profile', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const sponsorId = await isSponsor(userId);
      if (!sponsorId) return res.status(403).json({ error: 'Not an approved sponsor' });

      const { company_name, brand_logo, brand_color, website, description, contact_email } = req.body;

      const updateData: Record<string, any> = {};
      if (company_name !== undefined) updateData.company_name = company_name;
      if (brand_logo !== undefined) updateData.brand_logo = brand_logo;
      if (brand_color !== undefined) updateData.brand_color = brand_color;
      if (website !== undefined) updateData.website = website;
      if (description !== undefined) updateData.description = description;
      if (contact_email !== undefined) updateData.contact_email = contact_email;

      const { data, error } = await supabaseAdmin
        .from('sponsor_profiles')
        .update(updateData)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      res.json(data);
    } catch (err: any) {
      console.error('[Sponsor] profile update error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/api/sponsor/apply', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const { company_name, website, description, contact_email } = req.body;

      if (!company_name) return res.status(400).json({ error: 'company_name is required' });

      const { data: existing } = await supabaseAdmin
        .from('sponsor_profiles')
        .select('id, status')
        .eq('user_id', userId)
        .single();

      if (existing) return res.status(409).json({ error: 'Sponsor application already exists', status: existing.status });

      const { data, error } = await supabaseAdmin
        .from('sponsor_profiles')
        .insert({
          user_id: userId,
          company_name,
          website: website || null,
          description: description || null,
          contact_email: contact_email || null,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`[Sponsor] New application from user ${userId}: ${company_name}`);
      res.json({ success: true, profile: data });
    } catch (err: any) {
      console.error('[Sponsor] apply error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ==========================================
  // Sponsor Campaign Routes
  // ==========================================

  router.get('/api/sponsor/campaigns', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const sponsorId = await isSponsor(userId);
      if (!sponsorId) return res.status(403).json({ error: 'Not an approved sponsor' });

      const { data: campaigns, error } = await supabaseAdmin
        .from('sponsor_campaigns')
        .select('*, contests(*)')
        .eq('sponsor_id', sponsorId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      res.json(campaigns || []);
    } catch (err: any) {
      console.error('[Sponsor] campaigns list error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/api/sponsor/campaigns', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const sponsorId = await isSponsor(userId);
      if (!sponsorId) return res.status(403).json({ error: 'Not an approved sponsor' });

      const { title, description, sport, budget_crowns, prize_description, banner_image, brand_color, target_entries, starts_at, ends_at } = req.body;

      if (!title) return res.status(400).json({ error: 'title is required' });

      const { data: sponsorProfile } = await supabaseAdmin
        .from('sponsor_profiles')
        .select('*')
        .eq('id', sponsorId)
        .single();

      if (!sponsorProfile) return res.status(404).json({ error: 'Sponsor profile not found' });

      const { data: contest, error: contestError } = await supabaseAdmin
        .from('contests')
        .insert({
          title,
          sponsor: sponsorProfile.company_name,
          sponsor_logo: sponsorProfile.brand_logo,
          sponsor_id: sponsorProfile.id,
          league: sport || 'General',
          prize_pool: prize_description || 'Crowns',
          entries: 0,
          max_entries: target_entries || 1000,
          ends_at: ends_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          crowns: budget_crowns || 0,
          status: 'pending_approval',
          brand_id: sponsorProfile.id,
        })
        .select()
        .single();

      if (contestError) throw contestError;

      const { data: campaign, error: campaignError } = await supabaseAdmin
        .from('sponsor_campaigns')
        .insert({
          sponsor_id: sponsorId,
          title,
          description: description || null,
          sport: sport || null,
          status: 'draft',
          budget_crowns: budget_crowns || 0,
          prize_description: prize_description || null,
          banner_image: banner_image || null,
          brand_color: brand_color || null,
          target_entries: target_entries || 1000,
          starts_at: starts_at || null,
          ends_at: ends_at || null,
          contest_id: contest.id,
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      console.log(`[Sponsor] Campaign created: ${title} by sponsor ${sponsorId}`);
      res.json({ success: true, campaign, contest });
    } catch (err: any) {
      console.error('[Sponsor] campaign create error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/api/sponsor/campaigns/:id', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const sponsorId = await isSponsor(userId);
      if (!sponsorId) return res.status(403).json({ error: 'Not an approved sponsor' });

      const { data: campaign, error } = await supabaseAdmin
        .from('sponsor_campaigns')
        .select('*, contests(*)')
        .eq('id', req.params.id)
        .eq('sponsor_id', sponsorId)
        .single();

      if (error || !campaign) return res.status(404).json({ error: 'Campaign not found' });

      res.json(campaign);
    } catch (err: any) {
      console.error('[Sponsor] campaign get error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.put('/api/sponsor/campaigns/:id', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const sponsorId = await isSponsor(userId);
      if (!sponsorId) return res.status(403).json({ error: 'Not an approved sponsor' });

      const { data: existing } = await supabaseAdmin
        .from('sponsor_campaigns')
        .select('id, status')
        .eq('id', req.params.id)
        .eq('sponsor_id', sponsorId)
        .single();

      if (!existing) return res.status(404).json({ error: 'Campaign not found' });

      if (existing.status !== 'draft' && existing.status !== 'rejected') {
        return res.status(400).json({ error: 'Can only update draft or rejected campaigns' });
      }

      const { title, description, sport, budget_crowns, prize_description, banner_image, brand_color, target_entries, starts_at, ends_at } = req.body;

      const updateData: Record<string, any> = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (sport !== undefined) updateData.sport = sport;
      if (budget_crowns !== undefined) updateData.budget_crowns = budget_crowns;
      if (prize_description !== undefined) updateData.prize_description = prize_description;
      if (banner_image !== undefined) updateData.banner_image = banner_image;
      if (brand_color !== undefined) updateData.brand_color = brand_color;
      if (target_entries !== undefined) updateData.target_entries = target_entries;
      if (starts_at !== undefined) updateData.starts_at = starts_at;
      if (ends_at !== undefined) updateData.ends_at = ends_at;

      const { data, error } = await supabaseAdmin
        .from('sponsor_campaigns')
        .update(updateData)
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) throw error;

      res.json(data);
    } catch (err: any) {
      console.error('[Sponsor] campaign update error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.delete('/api/sponsor/campaigns/:id', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const sponsorId = await isSponsor(userId);
      if (!sponsorId) return res.status(403).json({ error: 'Not an approved sponsor' });

      const { data: campaign } = await supabaseAdmin
        .from('sponsor_campaigns')
        .select('id, status, contest_id')
        .eq('id', req.params.id)
        .eq('sponsor_id', sponsorId)
        .single();

      if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

      if (campaign.status !== 'draft') {
        return res.status(400).json({ error: 'Can only delete draft campaigns' });
      }

      if (campaign.contest_id) {
        await supabaseAdmin
          .from('contests')
          .delete()
          .eq('id', campaign.contest_id);
      }

      const { error } = await supabaseAdmin
        .from('sponsor_campaigns')
        .delete()
        .eq('id', req.params.id);

      if (error) throw error;

      console.log(`[Sponsor] Campaign deleted: ${req.params.id}`);
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Sponsor] campaign delete error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/api/sponsor/campaigns/:id/submit', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const sponsorId = await isSponsor(userId);
      if (!sponsorId) return res.status(403).json({ error: 'Not an approved sponsor' });

      const { data: campaign } = await supabaseAdmin
        .from('sponsor_campaigns')
        .select('id, status')
        .eq('id', req.params.id)
        .eq('sponsor_id', sponsorId)
        .single();

      if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

      if (campaign.status !== 'draft') {
        return res.status(400).json({ error: 'Can only submit draft campaigns' });
      }

      const { data, error } = await supabaseAdmin
        .from('sponsor_campaigns')
        .update({ status: 'pending_approval' })
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) throw error;

      console.log(`[Sponsor] Campaign submitted for approval: ${req.params.id}`);
      res.json({ success: true, campaign: data });
    } catch (err: any) {
      console.error('[Sponsor] campaign submit error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ==========================================
  // Sponsor Analytics Routes
  // ==========================================

  router.get('/api/sponsor/analytics', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const sponsorId = await isSponsor(userId);
      if (!sponsorId) return res.status(403).json({ error: 'Not an approved sponsor' });

      const { data: campaigns } = await supabaseAdmin
        .from('sponsor_campaigns')
        .select('id, status, actual_entries, impressions, clicks, contest_id')
        .eq('sponsor_id', sponsorId);

      const allCampaigns = campaigns || [];

      const total_campaigns = allCampaigns.length;
      const active_campaigns = allCampaigns.filter(c => c.status === 'active').length;
      const total_entries = allCampaigns.reduce((sum, c) => sum + (c.actual_entries || 0), 0);
      const total_impressions = allCampaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
      const total_clicks = allCampaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
      const total_reach = total_impressions + total_entries * 3;

      const contestIds = allCampaigns.map(c => c.contest_id).filter(Boolean);

      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const weekly_entries: { day: string; entries: number }[] = [];

      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        let dayEntries = 0;
        if (contestIds.length > 0) {
          const { count } = await supabaseAdmin
            .from('picks')
            .select('*', { count: 'exact', head: true })
            .in('contest_id', contestIds)
            .gte('created_at', dayStart.toISOString())
            .lte('created_at', dayEnd.toISOString());
          dayEntries = count || 0;
        }

        weekly_entries.push({
          day: dayNames[date.getDay()],
          entries: dayEntries,
        });
      }

      res.json({
        total_campaigns,
        active_campaigns,
        total_entries,
        total_impressions,
        total_clicks,
        total_reach,
        weekly_entries,
      });
    } catch (err: any) {
      console.error('[Sponsor] analytics error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/api/sponsor/campaigns/:id/analytics', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const sponsorId = await isSponsor(userId);
      if (!sponsorId) return res.status(403).json({ error: 'Not an approved sponsor' });

      const { data: campaign, error } = await supabaseAdmin
        .from('sponsor_campaigns')
        .select('*, contests(*)')
        .eq('id', req.params.id)
        .eq('sponsor_id', sponsorId)
        .single();

      if (error || !campaign) return res.status(404).json({ error: 'Campaign not found' });

      let entry_count = 0;
      if (campaign.contest_id) {
        const { count } = await supabaseAdmin
          .from('picks')
          .select('*', { count: 'exact', head: true })
          .eq('contest_id', campaign.contest_id);
        entry_count = count || 0;
      }

      const daily_entries: { date: string; entries: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        let dayEntries = 0;
        if (campaign.contest_id) {
          const { count } = await supabaseAdmin
            .from('picks')
            .select('*', { count: 'exact', head: true })
            .eq('contest_id', campaign.contest_id)
            .gte('created_at', dayStart.toISOString())
            .lte('created_at', dayEnd.toISOString());
          dayEntries = count || 0;
        }

        daily_entries.push({
          date: date.toISOString().split('T')[0],
          entries: dayEntries,
        });
      }

      res.json({
        campaign,
        entry_count,
        daily_entries,
      });
    } catch (err: any) {
      console.error('[Sponsor] campaign analytics error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ==========================================
  // Admin Sponsor Management Routes
  // ==========================================

  router.get('/api/admin/sponsors/:id/portal', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { data: sponsor, error } = await supabaseAdmin
        .from('sponsor_profiles')
        .select('*')
        .eq('id', req.params.id)
        .single();

      if (error || !sponsor) return res.status(404).json({ error: 'Sponsor not found' });

      const { data: campaigns } = await supabaseAdmin
        .from('sponsor_campaigns')
        .select('*, contests(*)')
        .eq('sponsor_id', sponsor.id)
        .order('created_at', { ascending: false });

      const allCampaigns = campaigns || [];
      const total_campaigns = allCampaigns.length;
      const active_campaigns = allCampaigns.filter((c: any) => c.status === 'active').length;
      const total_entries = allCampaigns.reduce((sum: number, c: any) => sum + (c.actual_entries || 0), 0);
      const total_impressions = allCampaigns.reduce((sum: number, c: any) => sum + (c.impressions || 0), 0);
      const total_clicks = allCampaigns.reduce((sum: number, c: any) => sum + (c.clicks || 0), 0);
      const total_reach = total_impressions + total_entries * 3;

      res.json({
        profile: sponsor,
        campaigns: allCampaigns,
        analytics: {
          total_campaigns,
          active_campaigns,
          total_entries,
          total_impressions,
          total_clicks,
          total_reach,
        },
      });
    } catch (err: any) {
      console.error('[Sponsor] admin portal view error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/api/admin/sponsors', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      let query = supabaseAdmin
        .from('sponsor_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      const status = req.query.status as string | undefined;
      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;

      res.json(data || []);
    } catch (err: any) {
      console.error('[Sponsor] admin sponsors list error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.put('/api/admin/sponsors/:id/approve', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { data: sponsor } = await supabaseAdmin
        .from('sponsor_profiles')
        .select('id')
        .eq('id', req.params.id)
        .single();

      if (!sponsor) return res.status(404).json({ error: 'Sponsor not found' });

      const { data, error } = await supabaseAdmin
        .from('sponsor_profiles')
        .update({ status: 'approved' })
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) throw error;

      console.log(`[Sponsor] Sponsor approved: ${req.params.id}`);
      res.json({ success: true, sponsor: data });
    } catch (err: any) {
      console.error('[Sponsor] admin approve error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.put('/api/admin/sponsors/:id/suspend', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { data: sponsor } = await supabaseAdmin
        .from('sponsor_profiles')
        .select('id')
        .eq('id', req.params.id)
        .single();

      if (!sponsor) return res.status(404).json({ error: 'Sponsor not found' });

      const { data, error } = await supabaseAdmin
        .from('sponsor_profiles')
        .update({ status: 'suspended' })
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) throw error;

      console.log(`[Sponsor] Sponsor suspended: ${req.params.id}`);
      res.json({ success: true, sponsor: data });
    } catch (err: any) {
      console.error('[Sponsor] admin suspend error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // --- Admin CRUD for Brand Sponsors ---

  async function ensureSponsorResourcesBucket() {
    try {
      await supabaseAdmin.storage.createBucket('sponsor-resources', { public: true });
    } catch (e: any) {
      if (!e?.message?.includes('already exists') && e?.statusCode !== '409' && e?.status !== 409) {
        console.warn('[Sponsor] bucket creation warning:', e?.message);
      }
    }
  }

  let bucketEnsured = false;
  async function lazyEnsureBucket() {
    if (!bucketEnsured) {
      await ensureSponsorResourcesBucket();
      bucketEnsured = true;
    }
  }

  router.post('/api/admin/sponsors', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { company_name, contact_email, website, description, brand_color, business_type, city, state, user_id } = req.body;

      if (!company_name) return res.status(400).json({ error: 'company_name is required' });

      const insertData: Record<string, any> = {
        company_name,
        contact_email: contact_email || '',
        status: 'approved',
      };
      if (website !== undefined) insertData.website = website;
      if (description !== undefined) insertData.description = description;
      if (brand_color !== undefined) insertData.brand_color = brand_color;
      if (business_type !== undefined) insertData.business_type = business_type;
      if (city !== undefined) insertData.city = city;
      if (state !== undefined) insertData.state = state;
      if (user_id) insertData.user_id = user_id;

      const { data, error } = await supabaseAdmin
        .from('sponsor_profiles')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      if (user_id) {
        await supabaseAdmin
          .from('user_profiles')
          .update({ role: 'sponsor' })
          .eq('id', user_id);
      }

      console.log(`[Sponsor] Admin created sponsor: ${company_name}`);
      res.json(data);
    } catch (err: any) {
      console.error('[Sponsor] admin create sponsor error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.put('/api/admin/sponsors/:id', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { data: existing } = await supabaseAdmin
        .from('sponsor_profiles')
        .select('id, user_id')
        .eq('id', req.params.id)
        .single();

      if (!existing) return res.status(404).json({ error: 'Sponsor not found' });

      const { company_name, contact_email, website, description, brand_color, business_type, city, state, user_id } = req.body;

      const updateData: Record<string, any> = {};
      if (company_name !== undefined) updateData.company_name = company_name;
      if (contact_email !== undefined) updateData.contact_email = contact_email;
      if (website !== undefined) updateData.website = website;
      if (description !== undefined) updateData.description = description;
      if (brand_color !== undefined) updateData.brand_color = brand_color;
      if (business_type !== undefined) updateData.business_type = business_type;
      if (city !== undefined) updateData.city = city;
      if (state !== undefined) updateData.state = state;
      if (user_id !== undefined) updateData.user_id = user_id || null;

      const { data, error } = await supabaseAdmin
        .from('sponsor_profiles')
        .update(updateData)
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) throw error;

      if (user_id !== undefined && user_id !== existing.user_id) {
        if (existing.user_id) {
          await supabaseAdmin
            .from('user_profiles')
            .update({ role: 'user' })
            .eq('id', existing.user_id);
        }
        if (user_id) {
          await supabaseAdmin
            .from('user_profiles')
            .update({ role: 'sponsor' })
            .eq('id', user_id);
        }
      }

      console.log(`[Sponsor] Admin updated sponsor: ${req.params.id}`);
      res.json(data);
    } catch (err: any) {
      console.error('[Sponsor] admin update sponsor error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.delete('/api/admin/sponsors/:id', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { data: existing } = await supabaseAdmin
        .from('sponsor_profiles')
        .select('id, user_id')
        .eq('id', req.params.id)
        .single();

      if (!existing) return res.status(404).json({ error: 'Sponsor not found' });

      const { error } = await supabaseAdmin
        .from('sponsor_profiles')
        .delete()
        .eq('id', req.params.id);

      if (error) throw error;

      if (existing.user_id) {
        await supabaseAdmin
          .from('user_profiles')
          .update({ role: 'user' })
          .eq('id', existing.user_id);
      }

      console.log(`[Sponsor] Admin deleted sponsor: ${req.params.id}`);
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Sponsor] admin delete sponsor error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/api/admin/sponsors/:id/resources', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      await lazyEnsureBucket();

      const { file_data, file_name, file_type, mime_type } = req.body;

      if (!file_data || !file_name) {
        return res.status(400).json({ error: 'file_data and file_name are required' });
      }

      const sponsorId = req.params.id;
      const buffer = Buffer.from(file_data, 'base64');
      const storagePath = `sponsors/${sponsorId}/${file_name}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('sponsor-resources')
        .upload(storagePath, buffer, {
          contentType: mime_type || 'application/octet-stream',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabaseAdmin.storage
        .from('sponsor-resources')
        .getPublicUrl(storagePath);

      console.log(`[Sponsor] Resource uploaded for sponsor ${sponsorId}: ${file_name}`);
      res.json({
        url: urlData.publicUrl,
        file_name,
        file_type: file_type || 'image',
      });
    } catch (err: any) {
      console.error('[Sponsor] admin resource upload error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/api/admin/sponsors/:id/resources', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      await lazyEnsureBucket();

      const sponsorId = req.params.id;
      const folder = `sponsors/${sponsorId}`;

      const { data: files, error } = await supabaseAdmin.storage
        .from('sponsor-resources')
        .list(folder);

      if (error) throw error;

      const resources = (files || [])
        .filter((f: any) => f.name && f.name !== '.emptyFolderPlaceholder')
        .map((f: any) => {
          const { data: urlData } = supabaseAdmin.storage
            .from('sponsor-resources')
            .getPublicUrl(`${folder}/${f.name}`);
          return {
            name: f.name,
            url: urlData.publicUrl,
            created_at: f.created_at || null,
          };
        });

      res.json(resources);
    } catch (err: any) {
      console.error('[Sponsor] admin resource list error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.delete('/api/admin/sponsors/:id/resources/:fileName', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      await lazyEnsureBucket();

      const sponsorId = req.params.id;
      const fileName = decodeURIComponent(req.params.fileName);
      const storagePath = `sponsors/${sponsorId}/${fileName}`;

      const { error } = await supabaseAdmin.storage
        .from('sponsor-resources')
        .remove([storagePath]);

      if (error) throw error;

      console.log(`[Sponsor] Resource deleted for sponsor ${sponsorId}: ${fileName}`);
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Sponsor] admin resource delete error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.put('/api/admin/sponsors/:id/reject', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { reason } = req.body;

      const { data: sponsor } = await supabaseAdmin
        .from('sponsor_profiles')
        .select('id')
        .eq('id', req.params.id)
        .single();

      if (!sponsor) return res.status(404).json({ error: 'Sponsor not found' });

      const { data, error } = await supabaseAdmin
        .from('sponsor_profiles')
        .update({ status: 'rejected' })
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) throw error;

      console.log(`[Sponsor] Sponsor rejected: ${req.params.id}, reason: ${reason || 'none'}`);
      res.json({ success: true, sponsor: data });
    } catch (err: any) {
      console.error('[Sponsor] admin reject error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/api/admin/sponsor-campaigns', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      let query = supabaseAdmin
        .from('sponsor_campaigns')
        .select('*, sponsor_profiles(*), contests(*)')
        .order('created_at', { ascending: false });

      const status = req.query.status as string | undefined;
      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;

      res.json(data || []);
    } catch (err: any) {
      console.error('[Sponsor] admin campaigns list error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.put('/api/admin/sponsor-campaigns/:id/approve', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { data: campaign } = await supabaseAdmin
        .from('sponsor_campaigns')
        .select('*, sponsor_profiles(*)')
        .eq('id', req.params.id)
        .single();

      if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

      const { error: campaignError } = await supabaseAdmin
        .from('sponsor_campaigns')
        .update({ status: 'active' })
        .eq('id', req.params.id);

      if (campaignError) throw campaignError;

      if (campaign.contest_id) {
        const { error: contestError } = await supabaseAdmin
          .from('contests')
          .update({ status: 'open' })
          .eq('id', campaign.contest_id);

        if (contestError) throw contestError;
      }

      const { data: updatedCampaign } = await supabaseAdmin
        .from('sponsor_campaigns')
        .select('*, contests(*)')
        .eq('id', req.params.id)
        .single();

      console.log(`[Sponsor] Campaign approved: ${req.params.id}`);
      res.json({ success: true, campaign: updatedCampaign });
    } catch (err: any) {
      console.error('[Sponsor] admin campaign approve error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.put('/api/admin/sponsor-campaigns/:id/reject', async (req, res) => {
    try {
      const userId = await getUserFromToken(req.headers.authorization);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!(await isAdmin(userId))) return res.status(403).json({ error: 'Forbidden' });

      const { admin_notes } = req.body;

      const { data: campaign } = await supabaseAdmin
        .from('sponsor_campaigns')
        .select('id')
        .eq('id', req.params.id)
        .single();

      if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

      const { data, error } = await supabaseAdmin
        .from('sponsor_campaigns')
        .update({ status: 'rejected', admin_notes: admin_notes || null })
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) throw error;

      console.log(`[Sponsor] Campaign rejected: ${req.params.id}`);
      res.json({ success: true, campaign: data });
    } catch (err: any) {
      console.error('[Sponsor] admin campaign reject error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}
