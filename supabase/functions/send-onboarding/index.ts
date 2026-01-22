// Send Onboarding Forms/Documents API
// Creates enrollment_onboarding records and sends emails via N8N Send Onboarding Email workflow
//
// Expected payload:
// {
//   enrollment_id: string,
//   item_keys: string[],     // e.g., ['lp_tos', 'lp_enrollment']
//   merge_data?: object      // e.g., { hourly_rate: 45, hours_per_week: 3 }
// }
//
// Required env vars:
// - N8N_SEND_EMAIL_WEBHOOK_URL: e.g., https://eatonacademic.app.n8n.cloud/webhook/send-onboarding-email
// - N8N_CREATE_DOCUMENT_WEBHOOK_URL: e.g., https://eatonacademic.app.n8n.cloud/webhook/create-document
// - N8N_NUDGE_WEBHOOK_URL: e.g., https://eatonacademic.app.n8n.cloud/webhook/start-nudge

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Service onboarding configuration - mirrors the frontend config
interface OnboardingItemConfig {
  key: string
  name: string
  formId?: string
  templateId?: string
}

interface ServiceOnboardingConfig {
  forms: OnboardingItemConfig[]
  documents: OnboardingItemConfig[]
  mergeFields: string[]
}

// Service codes must match the 'code' column in the services table
const SERVICE_ONBOARDING_CONFIG: Record<string, ServiceOnboardingConfig> = {
  learning_pod: {
    forms: [
      { key: 'lp_tos', name: 'Learning Pod Terms of Service Agreement', formId: '1Ayv9FEbeRsTI_gsMf8UWfQz13vFP5ZdoYeKSwZ4lv48' },
      { key: 'lp_enrollment', name: 'Learning Pod Enrollment Form', formId: '1IMbBq8aCNVnm6vdgiX-BQepAJG2iR5BPjJHWbuLlU8' },
      { key: 'lp_allergy', name: 'Learning Pod Allergy Notification Form', formId: '1vbfQKgbpWLV1MgLL5myzHWM62DfkQrMJyPfq1LX3sTI' },
      { key: 'lp_photo', name: 'Learning Pod Student Photo/Video Release', formId: '1Xe-LSy_fK8NepAXFjyPT0t4yYZmSAi53KeIKFG_BfMg' },
    ],
    documents: [],
    mergeFields: [],
  },
  consulting: {
    forms: [
      { key: 'hc_questionnaire', name: 'Homeschool Consulting Questionnaire', formId: '19m98i8Ax86VwRXg3ydgqTaUe751Or69Nfrabx3fv0J0' },
    ],
    documents: [
      { key: 'hc_agreement', name: 'Homeschool Consultation Agreement', templateId: '1rf816Hln05S55_zXonHmiMy13K_xkuJl3DUsB6ucIqI' },
    ],
    mergeFields: ['annual_fee', 'monthly_fee'],
  },
  academic_coaching: {
    forms: [],
    documents: [
      { key: 'ac_agreement', name: 'Academic Coach Hours Agreement', templateId: '1AAiZqXYOBcBcE7izmOdpKaBYXfO1WzgfAiio91LwgNo' },
    ],
    mergeFields: ['hourly_rate', 'hours_per_week'],
  },
  eaton_online: {
    forms: [],
    documents: [
      { key: 'eo_tos', name: 'Eaton Online Terms of Service', templateId: '1i_izsqCuNITYF5of4kHqQmaPr7g7MNiMhdTNPc4vu3o' },
    ],
    mergeFields: ['eo_program', 'eo_weekly_rate'],
  },
}

// Google Forms base URL (using edit ID format, not published ID)
const GOOGLE_FORMS_BASE_URL = 'https://docs.google.com/forms/d'

// Compliance folder ID for document storage
const COMPLIANCE_FOLDER_ID = '1Zz5Olq4sRM6QyU6xMMr3zHr8jVHh-gII'

interface SendOnboardingPayload {
  enrollment_id: string
  item_keys: string[]
  merge_data?: Record<string, unknown>
}

// Extract first name from full name (handles "Last, First" format)
function getFirstName(fullName: string | null): string {
  if (!fullName) return 'there'
  const trimmed = fullName.trim()

  // Handle "Last, First" format
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',')
    const firstName = parts[1]?.trim().split(' ')[0]
    return firstName || 'there'
  }

  // Handle "First Last" format
  return trimmed.split(' ')[0] || 'there'
}

// Format date as MM/DD/YYYY
function formatDate(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${mm}/${dd}/${yyyy}`
}

interface DocumentCreationResult {
  success: boolean
  document_id?: string
  document_url?: string
  document_name?: string
  error?: string
}

// Create a document via N8N webhook
async function createDocument(
  webhookUrl: string,
  templateId: string,
  documentName: string,
  mergeData: Record<string, string>
): Promise<DocumentCreationResult> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: templateId,
        document_name: documentName,
        parent_folder_id: COMPLIANCE_FOLDER_ID,
        merge_data: mergeData,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Document creation webhook failed:', errorText)
      return { success: false, error: `Webhook returned ${response.status}: ${errorText}` }
    }

    const result = await response.json()
    return {
      success: result.success === true,
      document_id: result.document_id,
      document_url: result.document_url,
      document_name: result.document_name,
      error: result.error,
    }
  } catch (error) {
    console.error('Document creation error:', error)
    return { success: false, error: String(error) }
  }
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
    const sendEmailWebhookUrl = Deno.env.get('N8N_SEND_EMAIL_WEBHOOK_URL')
    const createDocumentWebhookUrl = Deno.env.get('N8N_CREATE_DOCUMENT_WEBHOOK_URL')
    const nudgeWebhookUrl = Deno.env.get('N8N_NUDGE_WEBHOOK_URL')

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
    const payload: SendOnboardingPayload = await req.json()

    // Validate required fields
    if (!payload.enrollment_id) {
      return new Response(
        JSON.stringify({ error: 'enrollment_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!payload.item_keys || payload.item_keys.length === 0) {
      return new Response(
        JSON.stringify({ error: 'item_keys is required and must not be empty' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch enrollment with related data
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select(`
        id,
        family_id,
        student_id,
        service_id,
        hourly_rate_customer,
        hours_per_week,
        service:services(id, code, name),
        student:students(id, full_name),
        family:families(id, display_name, primary_email, primary_contact_name)
      `)
      .eq('id', payload.enrollment_id)
      .single()

    if (enrollmentError || !enrollment) {
      console.error('Error fetching enrollment:', enrollmentError)
      return new Response(
        JSON.stringify({ error: 'Enrollment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const serviceCode = enrollment.service?.code
    if (!serviceCode || !SERVICE_ONBOARDING_CONFIG[serviceCode]) {
      return new Response(
        JSON.stringify({ error: `No onboarding configuration for service: ${serviceCode}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const config = SERVICE_ONBOARDING_CONFIG[serviceCode]
    const allItems = [...config.forms.map(f => ({ ...f, type: 'form' as const })), ...config.documents.map(d => ({ ...d, type: 'document' as const }))]

    // Get family email
    const familyEmail = enrollment.family?.primary_email
    if (!familyEmail) {
      return new Response(
        JSON.stringify({ error: 'Family does not have an email address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract names
    const parentFullName = enrollment.family?.primary_contact_name || enrollment.family?.display_name || ''
    const _parentFirstName = getFirstName(parentFullName) // N8N workflow extracts first name from customer_name
    const studentFullName = enrollment.student?.full_name || ''
    const studentFirstName = getFirstName(studentFullName)
    const familyId = enrollment.family_id || ''
    const clientKey = familyId.substring(0, 8)

    // Build merge data for document placeholders
    const today = formatDate(new Date())
    const baseMergeData: Record<string, string> = {
      CLIENT_KEY: clientKey,
      STUDENT_NAME: studentFirstName,
      CUSTOMER_NAME: parentFullName,
      DATE_TODAY: today,
    }

    // Add service-specific merge data from payload
    if (payload.merge_data) {
      if (payload.merge_data.hourly_rate !== undefined) {
        baseMergeData.HOURLY_RATE = `$${payload.merge_data.hourly_rate}/hr`
      }
      if (payload.merge_data.hours_per_week !== undefined) {
        baseMergeData.HOURS_PER_WEEK = String(payload.merge_data.hours_per_week)
      }
      if (payload.merge_data.annual_fee !== undefined) {
        baseMergeData.ANNUAL_FEE = `$${payload.merge_data.annual_fee}`
      }
      if (payload.merge_data.monthly_fee !== undefined) {
        baseMergeData.MONTHLY_FEE = `$${payload.merge_data.monthly_fee}`
      }
      if (payload.merge_data.eo_program !== undefined) {
        baseMergeData.EO_PROGRAM = String(payload.merge_data.eo_program)
      }
      if (payload.merge_data.eo_weekly_rate !== undefined) {
        baseMergeData.EO_WEEKLY_RATE = `$${payload.merge_data.eo_weekly_rate}/week`
      }
    }

    // Fall back to enrollment data if not in payload
    if (!baseMergeData.HOURLY_RATE && enrollment.hourly_rate_customer) {
      baseMergeData.HOURLY_RATE = `$${enrollment.hourly_rate_customer}/hr`
    }
    if (!baseMergeData.HOURS_PER_WEEK && enrollment.hours_per_week) {
      baseMergeData.HOURS_PER_WEEK = String(enrollment.hours_per_week)
    }

    // Check for existing onboarding items to prevent duplicates
    const { data: existingItems } = await supabase
      .from('enrollment_onboarding')
      .select('item_key, status')
      .eq('enrollment_id', payload.enrollment_id)

    const existingKeys = new Set((existingItems || []).map(item => item.item_key))
    const skippedKeys: string[] = []

    // Build onboarding records
    const now = new Date().toISOString()
    const createdItems: Array<{
      enrollment_id: string
      item_type: 'form' | 'document'
      item_key: string
      item_name: string
      form_url: string | null
      form_id: string | null
      document_url: string | null
      document_id: string | null
      merge_data: Record<string, unknown> | null
      status: string
      sent_at: string
      sent_to: string
    }> = []

    const warnings: string[] = []

    for (const key of payload.item_keys) {
      // Skip if item already exists for this enrollment
      if (existingKeys.has(key)) {
        skippedKeys.push(key)
        continue
      }
      const itemConfig = allItems.find(i => i.key === key)
      if (!itemConfig) {
        console.warn(`Unknown item key: ${key}`)
        continue
      }

      const isForm = itemConfig.type === 'form'

      if (isForm && itemConfig.formId) {
        // Forms - just create the record with form URL
        createdItems.push({
          enrollment_id: payload.enrollment_id,
          item_type: 'form',
          item_key: key,
          item_name: itemConfig.name,
          form_url: `${GOOGLE_FORMS_BASE_URL}/${itemConfig.formId}/viewform`,
          form_id: itemConfig.formId,
          document_url: null,
          document_id: null,
          merge_data: null,
          status: 'sent',
          sent_at: now,
          sent_to: familyEmail,
        })
      } else if (!isForm && itemConfig.templateId) {
        // Documents - create via N8N webhook
        const documentName = `${itemConfig.name} — ${parentFullName} — ${studentFirstName} — ${clientKey}`

        let documentUrl: string | null = null
        let documentId: string | null = null

        if (createDocumentWebhookUrl) {
          console.log(`Creating document: ${documentName}`)
          const result = await createDocument(
            createDocumentWebhookUrl,
            itemConfig.templateId,
            documentName,
            baseMergeData
          )

          if (result.success && result.document_url) {
            documentUrl = result.document_url
            documentId = result.document_id || null
            console.log(`Document created: ${documentUrl}`)
          } else {
            console.error(`Failed to create document ${documentName}:`, result.error)
            warnings.push(`Failed to create ${itemConfig.name}: ${result.error}`)
          }
        } else {
          console.warn('N8N_CREATE_DOCUMENT_WEBHOOK_URL not configured - documents cannot be created')
          warnings.push('Document creation not configured - documents were not created')
        }

        createdItems.push({
          enrollment_id: payload.enrollment_id,
          item_type: 'document',
          item_key: key,
          item_name: itemConfig.name,
          form_url: null,
          form_id: null,
          document_url: documentUrl,
          document_id: documentId,
          merge_data: payload.merge_data || null,
          status: documentUrl ? 'sent' : 'pending',
          sent_at: now,
          sent_to: familyEmail,
        })
      }
    }

    // Add warning for skipped duplicates
    if (skippedKeys.length > 0) {
      console.log(`Skipped ${skippedKeys.length} items that were already sent: ${skippedKeys.join(', ')}`)
      warnings.push(`${skippedKeys.length} item(s) already sent and skipped`)
    }

    if (createdItems.length === 0) {
      // If all items were skipped (duplicates), return success with a message
      if (skippedKeys.length > 0) {
        return new Response(
          JSON.stringify({
            success: true,
            items: [],
            message: 'All requested items have already been sent',
            skipped: skippedKeys,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      return new Response(
        JSON.stringify({ error: 'No valid items to send' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Insert onboarding records
    const { data: insertedItems, error: insertError } = await supabase
      .from('enrollment_onboarding')
      .insert(createdItems)
      .select()

    if (insertError) {
      console.error('Error inserting onboarding records:', insertError)
      throw insertError
    }

    console.log(`Created ${insertedItems?.length || 0} onboarding records for enrollment ${payload.enrollment_id}`)

    // Build email content with correct branding
    const serviceDisplayNames: Record<string, string> = {
      learning_pod: 'Eaton Academic Learning Pod',
      consulting: 'Eaton Academic Homeschool Consulting',
      academic_coaching: 'Eaton Academic Coaching',
      eaton_online: 'Eaton Online',
    }
    const serviceName = serviceDisplayNames[serviceCode] || 'Eaton Academic'

    // Build items array for email
    const forms = insertedItems?.filter(item => item.item_type === 'form') || []
    const documents = insertedItems?.filter(item => item.item_type === 'document') || []

    const emailItems: Array<{ name: string; url: string; type: 'form' | 'document' }> = []

    for (const form of forms) {
      if (form.form_url) {
        emailItems.push({ name: form.item_name, url: form.form_url, type: 'form' })
      }
    }

    for (const doc of documents) {
      if (doc.document_url) {
        emailItems.push({ name: doc.item_name, url: doc.document_url, type: 'document' })
      }
    }

    // Send email via N8N Send Onboarding Email workflow
    if (sendEmailWebhookUrl) {
      try {
        const emailPayload = {
          to: familyEmail,
          email_type: 'initial',
          customer_name: parentFullName,
          student_name: studentFirstName,
          service_name: serviceName,
          items: emailItems,
        }

        console.log('Sending onboarding email via N8N workflow')
        const emailResponse = await fetch(sendEmailWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(emailPayload),
        })

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text()
          console.error('Send email webhook failed:', errorText)
          warnings.push('Failed to send email - forms recorded but emails may not have been sent')
        } else {
          const result = await emailResponse.json()
          console.log('Email sent successfully, messageId:', result.messageId)
        }
      } catch (emailError) {
        console.error('Send email webhook error:', emailError)
        warnings.push('Failed to send email - forms recorded but emails may not have been sent')
      }
    } else {
      console.log('Send email webhook URL not configured - skipping email')
      warnings.push('Email not configured - forms recorded but no emails sent')
    }

    // Trigger Onboarding Nudge workflow for form reminders (only if forms were sent)
    if (nudgeWebhookUrl && forms.length > 0) {
      try {
        const formLinks = forms.map(form => ({
          name: form.item_name,
          url: form.form_url,
        }))

        const nudgePayload = {
          enrollment_id: payload.enrollment_id,
          base: {
            customer_email: familyEmail,
            customer_name: parentFullName,
            student_name: studentFirstName,
          },
          formLinks,
        }

        console.log(`Triggering Onboarding Nudge for ${forms.length} forms`)
        const nudgeResponse = await fetch(nudgeWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nudgePayload),
        })

        if (!nudgeResponse.ok) {
          const errorText = await nudgeResponse.text()
          console.error('Nudge webhook failed:', errorText)
          warnings.push('Failed to schedule follow-up reminders')
        } else {
          console.log('Onboarding Nudge workflow triggered successfully')
        }
      } catch (nudgeError) {
        console.error('Nudge webhook error:', nudgeError)
        warnings.push('Failed to schedule follow-up reminders')
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        items: insertedItems,
        warnings: warnings.length > 0 ? warnings : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Send onboarding error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
