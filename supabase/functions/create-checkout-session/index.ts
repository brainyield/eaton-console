// Stripe Checkout Session Creator
// Creates a Stripe Checkout Session for invoice payment
// Called from the public invoice page when customer clicks "Pay with Card"

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CheckoutRequest {
  invoice_public_id: string
}

interface InvoiceWithFamily {
  id: string
  public_id: string
  invoice_number: string | null
  total_amount: number | null
  amount_paid: number
  balance_due: number | null
  status: string
  family: {
    id: string
    display_name: string
    primary_email: string | null
  } | null
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')

    if (!stripeSecretKey) {
      console.error('STRIPE_SECRET_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'Payment system not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Parse request body
    const { invoice_public_id }: CheckoutRequest = await req.json()

    if (!invoice_public_id) {
      return new Response(
        JSON.stringify({ error: 'invoice_public_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Creating checkout session for invoice: ${invoice_public_id}`)

    // Fetch invoice with family info
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        id,
        public_id,
        invoice_number,
        total_amount,
        amount_paid,
        balance_due,
        status,
        family:families(
          id,
          display_name,
          primary_email
        )
      `)
      .eq('public_id', invoice_public_id)
      .single()

    if (invoiceError || !invoice) {
      console.error('Invoice not found:', invoiceError)
      return new Response(
        JSON.stringify({ error: 'Invoice not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const typedInvoice = invoice as unknown as InvoiceWithFamily

    // Validate invoice can be paid
    if (typedInvoice.status === 'paid') {
      return new Response(
        JSON.stringify({ error: 'This invoice has already been paid' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (typedInvoice.status === 'void') {
      return new Response(
        JSON.stringify({ error: 'This invoice has been voided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const balanceDue = typedInvoice.balance_due || 0
    if (balanceDue <= 0) {
      return new Response(
        JSON.stringify({ error: 'No balance due on this invoice' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Stripe Checkout Session
    const invoiceLabel = typedInvoice.invoice_number || `INV-${typedInvoice.public_id}`

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: typedInvoice.family?.primary_email || undefined,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Invoice ${invoiceLabel}`,
              description: 'Payment for Eaton Academic services',
            },
            unit_amount: Math.round(balanceDue * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        invoice_id: typedInvoice.id,
        invoice_public_id: typedInvoice.public_id,
        invoice_number: typedInvoice.invoice_number || '',
        family_id: typedInvoice.family?.id || '',
      },
      success_url: `https://eaton-console.vercel.app/invoice/${typedInvoice.public_id}?payment=success`,
      cancel_url: `https://eaton-console.vercel.app/invoice/${typedInvoice.public_id}?payment=cancelled`,
    })

    console.log(`Checkout session created: ${session.id}`)

    return new Response(
      JSON.stringify({
        checkout_url: session.url,
        session_id: session.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Checkout session error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
