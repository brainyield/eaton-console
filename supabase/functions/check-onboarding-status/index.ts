// Check Onboarding Status API
// Calls N8N webhook to check Google Forms responses and marks completed forms
//
// Expected payload:
// {
//   enrollment_id: string
// }
//
// Required env vars:
// - N8N_CHECK_STATUS_WEBHOOK_URL: e.g., https://eatonacademic.app.n8n.cloud/webhook/check-forms

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CheckStatusPayload {
  enrollment_id: string
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const n8nCheckStatusUrl = Deno.env.get('N8N_CHECK_STATUS_WEBHOOK_URL')

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase configuration missing')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get auth header for JWT verification
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const payload: CheckStatusPayload = await req.json()

    // Validate required fields
    if (!payload.enrollment_id) {
      return new Response(
        JSON.stringify({ error: 'enrollment_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch pending onboarding items for this enrollment
    const { data: pendingItems, error: fetchError } = await supabase
      .from('enrollment_onboarding')
      .select('*')
      .eq('enrollment_id', payload.enrollment_id)
      .eq('status', 'sent')
      .not('form_id', 'is', null)

    if (fetchError) {
      console.error('Error fetching onboarding items:', fetchError)
      throw fetchError
    }

    if (!pendingItems || pendingItems.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          updated: 0,
          message: 'No pending form submissions to check',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${pendingItems.length} pending onboarding items to check`)

    // If N8N webhook is configured, trigger it to check form responses
    let updated = 0
    if (n8nCheckStatusUrl) {
      try {
        // Get enrollment details for the N8N workflow
        const { data: enrollment } = await supabase
          .from('enrollments')
          .select(`
            id,
            family:families(primary_email)
          `)
          .eq('id', payload.enrollment_id)
          .single()

        const n8nPayload = {
          enrollment_id: payload.enrollment_id,
          email: enrollment?.family?.primary_email,
          items: pendingItems.map(item => ({
            id: item.id,
            form_id: item.form_id,
            item_key: item.item_key,
            sent_at: item.sent_at,
          })),
        }

        const n8nResponse = await fetch(n8nCheckStatusUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(n8nPayload),
        })

        if (n8nResponse.ok) {
          const result = await n8nResponse.json()
          const completedIds = result.completed_ids || []

          // Update completed records in the database
          if (completedIds.length > 0) {
            const now = new Date().toISOString()
            const { error: updateError } = await supabase
              .from('enrollment_onboarding')
              .update({
                status: 'completed',
                completed_at: now
              })
              .in('id', completedIds)

            if (updateError) {
              console.error('Error updating onboarding records:', updateError)
            } else {
              updated = completedIds.length
              console.log(`Updated ${updated} onboarding records to completed`)
            }
          }

          console.log(`N8N workflow checked ${pendingItems.length} items, ${updated} completed`)
        } else {
          console.error('N8N check status failed:', await n8nResponse.text())
        }
      } catch (n8nError) {
        console.error('N8N check status error:', n8nError)
      }
    } else {
      // No N8N configured - just return current state
      console.log('N8N check status URL not configured')
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated,
        checked: pendingItems.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Check onboarding status error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
