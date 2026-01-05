// Stripe Webhook Handler
// Handles Stripe webhook events for invoice payments
// Primary event: checkout.session.completed

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

  if (!stripeSecretKey || !webhookSecret) {
    console.error('Stripe configuration missing')
    return new Response(
      JSON.stringify({ error: 'Stripe not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  })

  try {
    // Get raw body and signature for verification
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      console.error('No stripe-signature header')
      return new Response(
        JSON.stringify({ error: 'No signature' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify webhook signature
    let event: Stripe.Event
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message)
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing Stripe event: ${event.type} (${event.id})`)

    // Check for duplicate processing (idempotency)
    const { data: existingEvent } = await supabase
      .from('stripe_invoice_webhooks')
      .select('id, processing_status')
      .eq('stripe_event_id', event.id)
      .single()

    if (existingEvent) {
      // Only skip if already successfully processed
      // Allow retries for failed or stuck 'processing' events
      if (existingEvent.processing_status === 'processed') {
        console.log(`Event ${event.id} already processed successfully, skipping`)
        return new Response(
          JSON.stringify({ received: true, status: 'already_processed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // For failed or stuck events, delete the old record to allow retry
      console.log(`Event ${event.id} has status '${existingEvent.processing_status}', allowing retry`)
      await supabase
        .from('stripe_invoice_webhooks')
        .delete()
        .eq('stripe_event_id', event.id)
    }

    // Handle checkout.session.completed
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session

      const invoiceId = session.metadata?.invoice_id
      const invoicePublicId = session.metadata?.invoice_public_id

      if (!invoiceId) {
        console.error('No invoice_id in session metadata')
        // Log the event as failed
        await supabase.from('stripe_invoice_webhooks').insert({
          stripe_event_id: event.id,
          event_type: event.type,
          processing_status: 'failed',
          error_message: 'No invoice_id in metadata',
          raw_payload: event,
          processed_at: new Date().toISOString(),
        })
        return new Response(
          JSON.stringify({ error: 'No invoice_id in metadata' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Log the event as processing
      await supabase.from('stripe_invoice_webhooks').insert({
        stripe_event_id: event.id,
        event_type: event.type,
        invoice_id: invoiceId,
        processing_status: 'processing',
        raw_payload: event,
      })

      try {
        // Get the payment amount (in cents, convert to dollars)
        const amountPaid = (session.amount_total || 0) / 100

        console.log(`Processing payment of $${amountPaid} for invoice ${invoiceId}`)

        // Fetch current invoice state
        const { data: invoice, error: fetchError } = await supabase
          .from('invoices')
          .select('id, total_amount, amount_paid, balance_due, status')
          .eq('id', invoiceId)
          .single()

        if (fetchError || !invoice) {
          throw new Error(`Invoice not found: ${invoiceId}`)
        }

        // Create payment record
        const { error: paymentError } = await supabase
          .from('payments')
          .insert({
            invoice_id: invoiceId,
            amount: amountPaid,
            payment_date: new Date().toISOString().split('T')[0],
            payment_method: 'stripe',
            reference: session.payment_intent as string,
            notes: `Stripe checkout session ${session.id}`,
          })

        if (paymentError) {
          throw new Error(`Error creating payment: ${paymentError.message}`)
        }

        // Calculate new amounts
        const newAmountPaid = (invoice.amount_paid || 0) + amountPaid
        const newBalanceDue = (invoice.total_amount || 0) - newAmountPaid
        const newStatus = newBalanceDue <= 0 ? 'paid' : 'partial'

        // Update invoice
        const { error: updateError } = await supabase
          .from('invoices')
          .update({
            status: newStatus,
            amount_paid: newAmountPaid,
          })
          .eq('id', invoiceId)

        if (updateError) {
          throw new Error(`Error updating invoice: ${updateError.message}`)
        }

        // If fully paid, update any linked event_orders
        if (newStatus === 'paid') {
          await supabase
            .from('event_orders')
            .update({
              payment_status: 'paid',
              paid_at: new Date().toISOString(),
            })
            .eq('invoice_id', invoiceId)
        }

        // Mark webhook as processed
        await supabase
          .from('stripe_invoice_webhooks')
          .update({
            processing_status: 'processed',
            amount_paid: amountPaid,
            processed_at: new Date().toISOString(),
          })
          .eq('stripe_event_id', event.id)

        console.log(`Invoice ${invoiceId} updated: $${amountPaid} paid, new status: ${newStatus}`)

      } catch (processingError) {
        console.error('Payment processing error:', processingError)

        // Mark webhook as failed
        await supabase
          .from('stripe_invoice_webhooks')
          .update({
            processing_status: 'failed',
            error_message: processingError.message,
            processed_at: new Date().toISOString(),
          })
          .eq('stripe_event_id', event.id)

        throw processingError
      }
    } else {
      // Log other event types for reference
      console.log(`Ignoring event type: ${event.type}`)
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
