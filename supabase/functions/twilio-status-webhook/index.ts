// Twilio Status Webhook
// Receives delivery status updates from Twilio and updates sms_messages
// No JWT auth - called by Twilio

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

    const messageSid = formData.get('MessageSid')?.toString()
    const messageStatus = formData.get('MessageStatus')?.toString()
    const errorCode = formData.get('ErrorCode')?.toString()
    const errorMessage = formData.get('ErrorMessage')?.toString()

    console.log('Twilio status webhook:', { messageSid, messageStatus, errorCode })

    if (!messageSid) {
      console.error('Missing MessageSid in webhook')
      return new Response(
        JSON.stringify({ error: 'Missing MessageSid' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Map Twilio status to our status
    // Twilio statuses: queued, sending, sent, delivered, undelivered, failed
    let status = messageStatus
    if (messageStatus === 'sending' || messageStatus === 'queued') {
      status = 'sent'
    } else if (messageStatus === 'undelivered') {
      status = 'undelivered'
    } else if (messageStatus === 'failed') {
      status = 'failed'
    } else if (messageStatus === 'delivered') {
      status = 'delivered'
    } else if (messageStatus === 'sent') {
      status = 'sent'
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      status,
    }

    if (errorCode) {
      updateData.error_code = errorCode
    }

    if (errorMessage) {
      updateData.error_message = errorMessage
    }

    // Set timestamp based on status
    const now = new Date().toISOString()
    if (status === 'delivered') {
      updateData.delivered_at = now
    } else if (status === 'failed' || status === 'undelivered') {
      updateData.failed_at = now
    }

    // Update the message record
    const { error } = await supabase
      .from('sms_messages')
      .update(updateData)
      .eq('twilio_sid', messageSid)

    if (error) {
      console.error('Error updating SMS status:', error)
      // Don't return error - Twilio will retry
      // Log but respond with 200 to prevent infinite retries
    }

    console.log('Updated SMS status:', { messageSid, status })

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Webhook error:', error)
    // Return 200 to prevent Twilio retries for bad data
    return new Response(
      JSON.stringify({ error: 'Webhook processing error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
