// Get Pending Onboarding Items API
// Called by N8N Nudge workflow to check which onboarding items are still pending
//
// Expected payload:
// {
//   enrollment_id: string
// }
//
// Returns:
// {
//   success: boolean,
//   items: Array<{ name: string, url: string, type: 'form' | 'document' }>,
//   customer_email: string,
//   customer_name: string,
//   student_name: string
// }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GetPendingPayload {
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

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase configuration missing')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const payload: GetPendingPayload = await req.json()

    // Validate required fields
    if (!payload.enrollment_id) {
      return new Response(
        JSON.stringify({ error: 'enrollment_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch pending onboarding items (status != 'completed')
    const { data: pendingItems, error: fetchError } = await supabase
      .from('enrollment_onboarding')
      .select('item_name, form_url, document_url, item_type, sent_to')
      .eq('enrollment_id', payload.enrollment_id)
      .neq('status', 'completed')

    if (fetchError) {
      console.error('Error fetching onboarding items:', fetchError)
      throw fetchError
    }

    // Fetch enrollment details for customer/student info
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select(`
        family:families(display_name, primary_email, primary_contact_name),
        student:students(full_name)
      `)
      .eq('id', payload.enrollment_id)
      .maybeSingle()

    if (enrollmentError) {
      console.error('Error fetching enrollment:', enrollmentError)
    }

    // Build response
    const items = (pendingItems || [])
      .filter(item => item.form_url || item.document_url)
      .map(item => ({
        name: item.item_name,
        url: item.form_url || item.document_url,
        type: item.item_type,
      }))

    // Extract first name from full name (handles "Last, First" format)
    function getFirstName(fullName: string | null): string {
      if (!fullName) return ''
      const trimmed = fullName.trim()
      if (trimmed.includes(',')) {
        const parts = trimmed.split(',')
        return parts[1]?.trim().split(' ')[0] || ''
      }
      return trimmed.split(' ')[0] || ''
    }

    const customerName = enrollment?.family?.primary_contact_name || enrollment?.family?.display_name || ''
    const studentName = getFirstName(enrollment?.student?.full_name || '')
    const customerEmail = pendingItems?.[0]?.sent_to || enrollment?.family?.primary_email || ''

    return new Response(
      JSON.stringify({
        success: true,
        hasPending: items.length > 0,
        pendingCount: items.length,
        items,
        customer_email: customerEmail,
        customer_name: customerName,
        student_name: studentName,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Get pending onboarding error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
