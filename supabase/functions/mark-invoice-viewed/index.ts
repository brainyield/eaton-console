// Mark Invoice Viewed
// Called when a customer views their invoice via the public invoice page
// Updates the viewed_at timestamp (only on first view)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { public_id } = await req.json()

    // Validate required field
    if (!public_id) {
      return new Response(
        JSON.stringify({ error: 'public_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Only update if viewed_at is currently null (first view only)
    const { data, error } = await supabase
      .from('invoices')
      .update({ viewed_at: new Date().toISOString() })
      .eq('public_id', public_id)
      .is('viewed_at', null)
      .select('id')

    if (error) {
      console.error('Error updating invoice:', error)
      throw error
    }

    const wasUpdated = data && data.length > 0

    console.log(`Invoice ${public_id} view tracking: ${wasUpdated ? 'marked as viewed' : 'already viewed'}`)

    return new Response(
      JSON.stringify({
        success: true,
        updated: wasUpdated,
        message: wasUpdated ? 'Invoice marked as viewed' : 'Invoice was already viewed'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Mark viewed error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
