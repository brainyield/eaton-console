// Form Submitted Webhook
// Receives notifications from Google Forms via Apps Script when a form is submitted
// Marks the corresponding enrollment_onboarding record as completed
//
// Expected payload (from Google Apps Script):
// {
//   form_id: string,           // Google Form ID
//   respondent_email?: string, // Email if form requires sign-in
//   response_id: string,       // Unique response ID
//   submitted_at: string,      // Timestamp
//   answers?: object           // Optional: form field answers (may contain email)
// }
//
// Note: verify_jwt must be disabled for this function since Google Apps Script
// cannot send JWT auth headers. Add to supabase/config.toml:
// [functions.form-submitted]
// verify_jwt = false

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FormSubmittedPayload {
  form_id: string
  respondent_email?: string
  response_id: string
  submitted_at: string
  answers?: Record<string, string>
}

// Normalize email for comparison
function normalizeEmail(email: string | null | undefined): string {
  if (!email) return ''
  return email.toLowerCase().trim()
}

// Extract email from form answers (look for common email field patterns)
function extractEmailFromAnswers(answers: Record<string, string> | undefined): string | null {
  if (!answers) return null

  for (const [key, value] of Object.entries(answers)) {
    const lowerKey = key.toLowerCase()
    const lowerValue = (value || '').toLowerCase().trim()

    // Check if the key looks like an email field
    if (lowerKey.includes('email') || lowerKey.includes('e-mail')) {
      if (lowerValue.includes('@')) {
        return lowerValue
      }
    }

    // Check if any value looks like an email
    if (lowerValue.includes('@') && lowerValue.includes('.')) {
      // Basic email pattern check
      const emailMatch = lowerValue.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)
      if (emailMatch) {
        return emailMatch[0].toLowerCase()
      }
    }
  }

  return null
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

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase configuration missing')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const payload: FormSubmittedPayload = await req.json()

    console.log('Form submission received:', JSON.stringify(payload, null, 2))

    // Validate required fields
    if (!payload.form_id) {
      return new Response(
        JSON.stringify({ error: 'form_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Try to find the email - from respondent_email or from answers
    const respondentEmail = normalizeEmail(payload.respondent_email)
    const answersEmail = extractEmailFromAnswers(payload.answers)
    const email = respondentEmail || answersEmail

    console.log(`Looking for form_id=${payload.form_id}, email=${email || 'unknown'}`)

    // Find pending onboarding items with this form_id
    let query = supabase
      .from('enrollment_onboarding')
      .select('*')
      .eq('form_id', payload.form_id)
      .eq('status', 'sent')

    // If we have an email, match by sent_to email as well
    if (email) {
      query = query.ilike('sent_to', email)
    }

    const { data: pendingItems, error: fetchError } = await query

    if (fetchError) {
      console.error('Error fetching onboarding items:', fetchError)
      throw fetchError
    }

    if (!pendingItems || pendingItems.length === 0) {
      console.log('No matching pending onboarding items found')

      // Still return success - the form was submitted, we just couldn't match it
      return new Response(
        JSON.stringify({
          success: true,
          matched: false,
          message: 'Form submission received but no matching pending items found',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${pendingItems.length} matching pending item(s)`)

    // Update all matching items to completed
    const now = new Date().toISOString()
    const itemIds = pendingItems.map(item => item.id)

    const { error: updateError } = await supabase
      .from('enrollment_onboarding')
      .update({
        status: 'completed',
        completed_at: now,
      })
      .in('id', itemIds)

    if (updateError) {
      console.error('Error updating onboarding records:', updateError)
      throw updateError
    }

    console.log(`Marked ${itemIds.length} onboarding item(s) as completed`)

    return new Response(
      JSON.stringify({
        success: true,
        matched: true,
        updated: itemIds.length,
        items: itemIds,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Form submitted webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
