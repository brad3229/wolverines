import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Removes every MFA factor from another admin's account -- the escape hatch
// for a lost authenticator now that MFA is mandatory for the admin role (see
// migration 20260808000000). A user can already unenroll their OWN factors
// straight from the client SDK (Security page's "Disable 2FA"); this exists
// specifically for the case where they can't sign in to do that themselves.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const {
      data: { user: caller },
    } = await callerClient.auth.getUser()
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: callerProfile } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()
    if (callerProfile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { profileId } = await req.json()
    if (!profileId) {
      return new Response(JSON.stringify({ error: 'profileId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: targetProfile } = await adminClient.from('profiles').select('role').eq('id', profileId).single()
    if (targetProfile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'That account is not an admin' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: targetUser, error: getUserError } = await adminClient.auth.admin.getUserById(profileId)
    if (getUserError || !targetUser?.user) {
      return new Response(JSON.stringify({ error: getUserError?.message ?? 'User not found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const factors = targetUser.user.factors ?? []
    for (const factor of factors) {
      // The admin JS client doesn't expose per-user factor deletion as a typed
      // method -- calling the GoTrue Admin REST endpoint directly instead.
      const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${profileId}/factors/${factor.id}`, {
        method: 'DELETE',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      })
      if (!res.ok) {
        const body = await res.text()
        return new Response(JSON.stringify({ error: `Failed to remove factor ${factor.id}: ${body}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    return new Response(JSON.stringify({ profileId, factorsRemoved: factors.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
