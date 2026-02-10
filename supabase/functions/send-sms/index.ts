// Send SMS Edge Function
// Sends SMS/MMS via Twilio API and logs to database
// Requires JWT authentication (called from admin UI)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SendSmsRequest {
  // Recipients - one of these is required
  familyId?: string
  familyIds?: string[] // For bulk send

  // Message content
  toPhone?: string // Required if no familyId
  messageBody: string
  messageType: 'invoice_reminder' | 'event_reminder' | 'announcement' | 'custom' | 'bulk'

  // Optional context
  invoiceId?: string
  templateKey?: string
  mergeData?: Record<string, unknown>
  campaignName?: string
  mediaUrls?: string[]

  // Metadata
  sentBy?: string
}

interface SendResult {
  familyId?: string
  phone: string
  success: boolean
  twilioSid?: string
  error?: string
}

// Map Twilio status to our allowed DB values
function mapTwilioStatus(twilioStatus: string | undefined): string {
  switch (twilioStatus) {
    case 'queued':
    case 'sending':
    case 'sent':
      return 'sent'
    case 'delivered':
      return 'delivered'
    case 'undelivered':
      return 'undelivered'
    case 'failed':
      return 'failed'
    default:
      return 'sent'
  }
}

// Normalize phone to E.164 format
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null

  const cleaned = phone.replace(/[^\d+]/g, '')

  let digits = cleaned
  if (digits.startsWith('+1')) {
    digits = digits.slice(2)
  } else if (digits.startsWith('1') && digits.length === 11) {
    digits = digits.slice(1)
  } else if (digits.startsWith('+')) {
    return null
  }

  if (digits.length !== 10) return null
  if (!/^[2-9]\d{9}$/.test(digits)) return null

  return `+1${digits}`
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Validate environment
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  const twilioFromPhone = Deno.env.get('TWILIO_PHONE_NUMBER')

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Supabase configuration missing')
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (!twilioAccountSid || !twilioAuthToken || !twilioFromPhone) {
    console.error('Twilio configuration missing')
    return new Response(
      JSON.stringify({ error: 'SMS service not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const payload: SendSmsRequest = await req.json()
    console.log('Send SMS request:', { ...payload, messageBody: payload.messageBody?.slice(0, 50) + '...' })

    // Validate required fields
    if (!payload.messageBody?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Message body is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Collect recipients
    const recipients: Array<{ familyId: string | null; phone: string; optedOut: boolean }> = []

    // Single family
    if (payload.familyId) {
      const { data: family, error } = await supabase
        .from('families')
        .select('id, primary_phone, sms_opt_out')
        .eq('id', payload.familyId)
        .maybeSingle()

      if (error) {
        console.error('Error fetching family:', error)
        throw new Error('Failed to fetch family')
      }

      if (!family) {
        return new Response(
          JSON.stringify({ error: 'Family not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const normalizedPhone = normalizePhone(family.primary_phone)
      if (!normalizedPhone) {
        return new Response(
          JSON.stringify({ error: 'Family has no valid phone number' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      recipients.push({
        familyId: family.id,
        phone: normalizedPhone,
        optedOut: family.sms_opt_out || false,
      })
    }
    // Bulk send to multiple families
    else if (payload.familyIds && payload.familyIds.length > 0) {
      const { data: families, error } = await supabase
        .from('families')
        .select('id, primary_phone, sms_opt_out')
        .in('id', payload.familyIds)

      if (error) {
        console.error('Error fetching families:', error)
        throw new Error('Failed to fetch families')
      }

      for (const family of families || []) {
        const normalizedPhone = normalizePhone(family.primary_phone)
        if (normalizedPhone) {
          recipients.push({
            familyId: family.id,
            phone: normalizedPhone,
            optedOut: family.sms_opt_out || false,
          })
        }
      }
    }
    // Direct phone number
    else if (payload.toPhone) {
      const normalizedPhone = normalizePhone(payload.toPhone)
      if (!normalizedPhone) {
        return new Response(
          JSON.stringify({ error: 'Invalid phone number format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      recipients.push({
        familyId: null,
        phone: normalizedPhone,
        optedOut: false,
      })
    } else {
      return new Response(
        JSON.stringify({ error: 'No recipient specified' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Filter out opted-out recipients
    const eligibleRecipients = recipients.filter(r => !r.optedOut)
    const optedOutCount = recipients.length - eligibleRecipients.length

    if (eligibleRecipients.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: optedOutCount > 0 ? 'All recipients have opted out of SMS' : 'No valid recipients',
          sent: 0,
          skipped: optedOutCount,
          failed: 0,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send to each recipient
    const results: SendResult[] = []
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`
    const authHeader = 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`)
    const statusCallbackUrl = `${supabaseUrl}/functions/v1/twilio-status-webhook`

    for (const recipient of eligibleRecipients) {
      try {
        // Build Twilio request
        const formData = new URLSearchParams()
        formData.append('To', recipient.phone)
        formData.append('From', twilioFromPhone)
        formData.append('Body', payload.messageBody)
        formData.append('StatusCallback', statusCallbackUrl)

        // Add media URLs for MMS
        if (payload.mediaUrls && payload.mediaUrls.length > 0) {
          for (const url of payload.mediaUrls) {
            formData.append('MediaUrl', url)
          }
        }

        // Call Twilio API
        const twilioResponse = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData,
        })

        const twilioData = await twilioResponse.json()

        if (!twilioResponse.ok) {
          console.error('Twilio error:', twilioData)
          results.push({
            familyId: recipient.familyId || undefined,
            phone: recipient.phone,
            success: false,
            error: twilioData.message || 'Twilio API error',
          })

          // Log failed message
          await supabase.from('sms_messages').insert({
            family_id: recipient.familyId,
            invoice_id: payload.invoiceId || null,
            to_phone: recipient.phone,
            from_phone: twilioFromPhone,
            message_body: payload.messageBody,
            message_type: payload.messageType || 'custom',
            status: 'failed',
            error_code: twilioData.code?.toString() || null,
            error_message: twilioData.message || null,
            template_key: payload.templateKey || null,
            merge_data: payload.mergeData || null,
            campaign_name: payload.campaignName || null,
            sent_by: payload.sentBy || 'system',
            failed_at: new Date().toISOString(),
          })

          continue
        }

        // Log successful send
        const { data: smsRecord, error: insertError } = await supabase
          .from('sms_messages')
          .insert({
            family_id: recipient.familyId,
            invoice_id: payload.invoiceId || null,
            to_phone: recipient.phone,
            from_phone: twilioFromPhone,
            message_body: payload.messageBody,
            message_type: payload.messageType || 'custom',
            status: mapTwilioStatus(twilioData.status),
            twilio_sid: twilioData.sid,
            template_key: payload.templateKey || null,
            merge_data: payload.mergeData || null,
            campaign_name: payload.campaignName || null,
            sent_by: payload.sentBy || 'system',
            sent_at: new Date().toISOString(),
          })
          .select('id')
          .single()

        if (insertError) {
          console.error('Error logging SMS:', insertError)
          // Don't fail the request - SMS was sent
        }

        // Log media attachments
        if (smsRecord && payload.mediaUrls && payload.mediaUrls.length > 0) {
          const mediaRecords = payload.mediaUrls.map(url => ({
            sms_message_id: smsRecord.id,
            public_url: url,
            storage_path: url, // For external URLs, path = url
          }))
          await supabase.from('sms_media').insert(mediaRecords)
        }

        results.push({
          familyId: recipient.familyId || undefined,
          phone: recipient.phone,
          success: true,
          twilioSid: twilioData.sid,
        })

      } catch (err) {
        console.error('Error sending to', recipient.phone, err)
        results.push({
          familyId: recipient.familyId || undefined,
          phone: recipient.phone,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    // Summary
    const sent = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    console.log(`SMS send complete: ${sent} sent, ${failed} failed, ${optedOutCount} skipped (opted out)`)

    return new Response(
      JSON.stringify({
        success: sent > 0,
        sent,
        failed,
        skipped: optedOutCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Send SMS error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
