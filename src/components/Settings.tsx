import { useState, useEffect } from 'react'
import {
  Settings as SettingsIcon,
  Building2,
  FileText,
  CreditCard,
  DollarSign,
  Save,
  Plus,
  X,
  Check,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { supabase } from '../lib/supabase'

// Types for settings
interface BusinessInfo {
  name: string
  email: string
  phone: string
  address: string
}

interface InvoiceDefaults {
  due_days: number
  number_prefix: string
  next_number: number
}

interface MonthlyRates {
  learning_pod: { [month: string]: number }
  elective_classes: { default: number }
}

// Type for app_settings row from Supabase
interface AppSettingRow {
  key: string
  value: unknown
  description?: string
  updated_at?: string
}

type TabId = 'business' | 'invoicing' | 'payments' | 'rates'

// Toast component
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${
      type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
    }`}>
      {type === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-80">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<TabId>('business')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Settings state
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>({
    name: '',
    email: '',
    phone: '',
    address: ''
  })
  const [invoiceDefaults, setInvoiceDefaults] = useState<InvoiceDefaults>({
    due_days: 15,
    number_prefix: 'INV-',
    next_number: 1
  })
  const [paymentMethods, setPaymentMethods] = useState<string[]>([])
  const [newPaymentMethod, setNewPaymentMethod] = useState('')
  const [monthlyRates, setMonthlyRates] = useState<MonthlyRates>({
    learning_pod: {},
    elective_classes: { default: 250 }
  })
  const [hubDailyRate, setHubDailyRate] = useState('100.00')

  const tabs = [
    { id: 'business' as TabId, label: 'Business Info', icon: Building2 },
    { id: 'invoicing' as TabId, label: 'Invoicing', icon: FileText },
    { id: 'payments' as TabId, label: 'Payment Methods', icon: CreditCard },
    { id: 'rates' as TabId, label: 'Rates', icon: DollarSign }
  ]

  // Fetch all settings on mount
  useEffect(() => {
    async function fetchSettings() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.from('app_settings') as any)
          .select('key, value')

        if (error) throw error

        if (data) {
          (data as AppSettingRow[]).forEach((setting: AppSettingRow) => {
            switch (setting.key) {
              case 'business_info':
                setBusinessInfo(setting.value as BusinessInfo)
                break
              case 'invoice_defaults':
                setInvoiceDefaults(setting.value as InvoiceDefaults)
                break
              case 'payment_methods':
                setPaymentMethods(setting.value as string[])
                break
              case 'monthly_rates':
                setMonthlyRates(setting.value as MonthlyRates)
                break
              case 'hub_daily_rate':
                setHubDailyRate(String(setting.value))
                break
            }
          })
        }
      } catch (error) {
        console.error('Error fetching settings:', error)
        setToast({ message: 'Failed to load settings', type: 'error' })
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  // Save a setting
  async function saveSetting(key: string, value: unknown) {
    setSaving(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('app_settings') as any)
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key)

      if (error) throw error

      setToast({ message: 'Settings saved successfully', type: 'success' })
    } catch (error) {
      console.error('Error saving setting:', error)
      setToast({ message: 'Failed to save settings', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  // Add payment method
  function addPaymentMethod() {
    if (newPaymentMethod.trim() && !paymentMethods.includes(newPaymentMethod.trim())) {
      const updated = [...paymentMethods, newPaymentMethod.trim()]
      setPaymentMethods(updated)
      setNewPaymentMethod('')
    }
  }

  // Remove payment method
  function removePaymentMethod(method: string) {
    setPaymentMethods(paymentMethods.filter((m) => m !== method))
  }

  // Update monthly rate
  function updateMonthlyRate(service: 'learning_pod' | 'elective_classes', month: string, value: number) {
    setMonthlyRates((prev) => ({
      ...prev,
      [service]: {
        ...prev[service],
        [month]: value
      }
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  const monthLabels: { [key: string]: string } = {
    sep: 'September',
    oct: 'October',
    nov: 'November',
    dec: 'December',
    jan: 'January',
    feb: 'February',
    mar: 'March',
    apr: 'April',
    may: 'May'
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <SettingsIcon className="h-8 w-8 text-blue-500" />
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-gray-400 text-sm">Manage application configuration</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-800 p-1 rounded-lg">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        {/* Business Info Tab */}
        {activeTab === 'business' && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Business Information</h2>
            <p className="text-gray-400 text-sm mb-6">
              This information appears on invoices and customer communications.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Business Name
                </label>
                <input
                  type="text"
                  value={businessInfo.name}
                  onChange={(e) => setBusinessInfo({ ...businessInfo, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Eaton Academic"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={businessInfo.email}
                  onChange={(e) => setBusinessInfo({ ...businessInfo, email: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="ivan@eatonacademic.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={businessInfo.phone}
                  onChange={(e) => setBusinessInfo({ ...businessInfo, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="(305) 555-0100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={businessInfo.address}
                  onChange={(e) => setBusinessInfo({ ...businessInfo, address: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Miami, FL"
                />
              </div>
              <div className="pt-4">
                <button
                  onClick={() => saveSetting('business_info', businessInfo)}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Invoicing Tab */}
        {activeTab === 'invoicing' && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Invoice Settings</h2>
            <p className="text-gray-400 text-sm mb-6">
              Configure default settings for invoice generation.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Default Due Days
                </label>
                <p className="text-gray-500 text-xs mb-2">
                  Number of days after invoice date until payment is due
                </p>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={invoiceDefaults.due_days}
                  onChange={(e) =>
                    setInvoiceDefaults({ ...invoiceDefaults, due_days: parseInt(e.target.value) || 15 })
                  }
                  className="w-32 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Invoice Number Prefix
                </label>
                <p className="text-gray-500 text-xs mb-2">
                  Prefix added to all invoice numbers (e.g., INV-0001)
                </p>
                <input
                  type="text"
                  value={invoiceDefaults.number_prefix}
                  onChange={(e) =>
                    setInvoiceDefaults({ ...invoiceDefaults, number_prefix: e.target.value })
                  }
                  className="w-32 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="INV-"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Next Invoice Number
                </label>
                <p className="text-gray-500 text-xs mb-2">
                  The next invoice will use this number (auto-increments)
                </p>
                <input
                  type="number"
                  min="1"
                  value={invoiceDefaults.next_number}
                  onChange={(e) =>
                    setInvoiceDefaults({ ...invoiceDefaults, next_number: parseInt(e.target.value) || 1 })
                  }
                  className="w-32 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="pt-4 flex items-center gap-4">
                <button
                  onClick={() => saveSetting('invoice_defaults', invoiceDefaults)}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Changes
                </button>
                <span className="text-gray-500 text-sm">
                  Preview: {invoiceDefaults.number_prefix}
                  {String(invoiceDefaults.next_number).padStart(4, '0')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Payment Methods Tab */}
        {activeTab === 'payments' && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Payment Methods</h2>
            <p className="text-gray-400 text-sm mb-6">
              Manage accepted payment methods shown in dropdowns throughout the app.
            </p>
            <div className="space-y-4">
              {/* Add new method */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPaymentMethod}
                  onChange={(e) => setNewPaymentMethod(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addPaymentMethod()}
                  placeholder="Add new payment method..."
                  className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={addPaymentMethod}
                  disabled={!newPaymentMethod.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>

              {/* List of methods */}
              <div className="space-y-2">
                {paymentMethods.map((method) => (
                  <div
                    key={method}
                    className="flex items-center justify-between px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg"
                  >
                    <span className="text-white">{method}</span>
                    <button
                      onClick={() => removePaymentMethod(method)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {paymentMethods.length === 0 && (
                  <p className="text-gray-500 text-sm py-4 text-center">
                    No payment methods configured
                  </p>
                )}
              </div>

              <div className="pt-4">
                <button
                  onClick={() => saveSetting('payment_methods', paymentMethods)}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rates Tab */}
        {activeTab === 'rates' && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Tuition Rates</h2>
            <p className="text-gray-400 text-sm mb-6">
              Configure default rates for different service types.
            </p>

            {/* Hub Daily Rate */}
            <div className="mb-8">
              <h3 className="text-md font-medium text-white mb-3 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                Eaton Hub Daily Rate
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-gray-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={hubDailyRate}
                  onChange={(e) => setHubDailyRate(e.target.value)}
                  className="w-32 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="text-gray-400">per day</span>
                <button
                  onClick={() => saveSetting('hub_daily_rate', hubDailyRate)}
                  disabled={saving}
                  className="ml-4 flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </button>
              </div>
            </div>

            {/* Elective Classes Default */}
            <div className="mb-8">
              <h3 className="text-md font-medium text-white mb-3">Elective Classes (Default)</h3>
              <div className="flex items-center gap-3">
                <span className="text-gray-400">$</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={monthlyRates.elective_classes?.default || 250}
                  onChange={(e) =>
                    updateMonthlyRate('elective_classes', 'default', parseInt(e.target.value) || 0)
                  }
                  className="w-32 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="text-gray-400">per month</span>
              </div>
            </div>

            {/* Learning Pod Monthly Rates */}
            <div className="mb-8">
              <h3 className="text-md font-medium text-white mb-3">Learning Pod Monthly Rates</h3>
              <p className="text-gray-500 text-xs mb-4">
                Different rates by month (December is reduced for holiday break)
              </p>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(monthLabels).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm w-20">{label}</span>
                    <span className="text-gray-400">$</span>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={monthlyRates.learning_pod?.[key] || 0}
                      onChange={(e) =>
                        updateMonthlyRate('learning_pod', key, parseInt(e.target.value) || 0)
                      }
                      className="w-24 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-700">
              <button
                onClick={() => saveSetting('monthly_rates', monthlyRates)}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save All Rate Changes
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}