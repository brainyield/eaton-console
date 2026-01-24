// Twilio Opt-Out Webhook
// Handles STOP/START keywords from incoming messages
// No JWT auth - called by Twilio

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Keywords for opt-out/opt-in
const OPT_OUT_KEYWORDS = ['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit']
const OPT_IN_KEYWORDS = ['start', 'unstop', 'subscribe']

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Supabase configuration missing')
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // Twilio sends form-encoded data
    const formData = await req.formData()

    const fromPhone = formData.get('From')?.toString()
    const body = formData.get('Body')?.toString()?.toLowerCase().trim()
    const messageSid = formData.get('MessageSid')?.toString()

    console.log('Opt-out webhook:', { fromPhone, body, messageSid })

    if (!fromPhone) {
      return new Response(
        JSON.stringify({ error: 'Missing From phone' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Determine action based on keyword
    const isOptOut = body ? OPT_OUT_KEYWORDS.includes(body) : false
    const isOptIn = body ? OPT_IN_KEYWORDS.includes(body) : false

    if (!isOptOut && !isOptIn) {
      // Not an opt-out/opt-in message - ignore
      console.log('Ignoring non-keyword message:', body)
      return new Response(
        JSON.stringify({ success: true, action: 'ignored' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract digits from phone for matching
    // Twilio sends +1XXXXXXXXXX format
    const phoneDigits = fromPhone.replace(/\D/g, '')
    const last10Digits = phoneDigits.slice(-10)

    if (last10Digits.length !== 10) {
      console.log('Invalid phone format:', fromPhone)
      return new Response(
        JSON.stringify({ error: 'Invalid phone format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create normalized E.164 format for matching
    const normalizedPhone = `+1${last10Digits}`

    // Find families - first try exact normalized format, then pattern match
    // Pattern uses word boundaries to avoid matching embedded digits
    const { data: matchingFamilies, error: queryError } = await supabase
      .from('families')
      .select('id, display_name, primary_phone')
      .or(`primary_phone.eq.${normalizedPhone},primary_phone.ilike.%${last10Digits.slice(0, 3)}-${last10Digits.slice(3, 6)}-${last10Digits.slice(6)}%`)

    if (queryError) {
      console.error('Error querying families:', queryError)
      throw queryError
    }

    if (!matchingFamilies || matchingFamilies.length === 0) {
      console.log('No families found matching phone:', fromPhone)
      return new Response(
        JSON.stringify({ success: true, action: 'no_match', phone: fromPhone }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update all matching families
    const now = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('families')
      .update({
        sms_opt_out: isOptOut,
        sms_opt_out_at: isOptOut ? now : null,
      })
      .in('id', matchingFamilies.map(f => f.id))

    if (updateError) {
      console.error('Error updating opt-out status:', updateError)
      throw updateError
    }

    const action = isOptOut ? 'opted_out' : 'opted_in'
    console.log(`Updated ${matchingFamilies.length} families to ${action}:`, matchingFamilies.map(f => f.display_name))

    // Log the opt-out/opt-in as a system message
    for (const family of matchingFamilies) {
      await supabase.from('sms_messages').insert({
        family_id: family.id,
        to_phone: fromPhone,
        from_phone: fromPhone, // Inbound, so from = to
        message_body: `[SYSTEM] ${isOptOut ? 'Opted out' : 'Opted in'} via ${body?.toUpperCase()} keyword`,
        message_type: 'custom',
        status: 'delivered',
        sent_by: 'system',
        sent_at: now,
        delivered_at: now,
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        action,
        familiesUpdated: matchingFamilies.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Opt-out webhook error:', error)
    // Return 200 to prevent Twilio retries
    return new Response(
      JSON.stringify({ error: 'Webhook processing error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
