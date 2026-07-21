import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    const { email, soldierId, redirectTo } = await req.json()
    if (!email || !soldierId) {
      return new Response(JSON.stringify({ error: 'email and soldierId are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Re-inviting (e.g. the first invite email pointed at a broken redirect) hits a
    // stale, unconfirmed auth user left over from the earlier invite -- inviteUserByEmail
    // errors "already registered" on that email otherwise. Since nothing was ever set up
    // on it (no confirmed sign-in), it's safe to drop and re-create; an account the
    // Soldier has actually signed into is left alone and reported back as a real error.
    const { data: existingSoldier } = await adminClient
      .from('soldiers')
      .select('profile_id')
      .eq('id', soldierId)
      .single()
    if (existingSoldier?.profile_id) {
      const { data: existingUser } = await adminClient.auth.admin.getUserById(existingSoldier.profile_id)
      if (existingUser?.user) {
        if (existingUser.user.last_sign_in_at) {
          return new Response(
            JSON.stringify({
              error: 'This Soldier already has an active account. Use password reset instead of re-inviting.',
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          )
        }
        await adminClient.auth.admin.deleteUser(existingSoldier.profile_id)
      }
    }

    const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { role: 'soldier' },
      redirectTo,
    })
    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: linkError } = await adminClient
      .from('soldiers')
      .update({ profile_id: invited.user.id })
      .eq('id', soldierId)
    if (linkError) {
      return new Response(JSON.stringify({ error: linkError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ profileId: invited.user.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
