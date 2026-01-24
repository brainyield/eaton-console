import { useState, useMemo, useEffect } from 'react';
import { Send, AlertCircle, FileText, ClipboardList, Check } from 'lucide-react';
import { AccessibleModal } from './ui/AccessibleModal';
import { ModalFooter } from './ui/ModalFooter';
import {
  useOnboardingMutations,
  SERVICE_ONBOARDING_CONFIG,
  type EnrollmentOnboarding,
} from '../lib/hooks';
import { useToast } from '../lib/toast';

// Minimal enrollment type - only fields actually used by this modal
interface EnrollmentForModal {
  id: string;
  hourly_rate_customer?: number | null;
  hours_per_week?: number | null;
  annual_fee?: number | null;
  monthly_rate?: number | null;
  program_type?: string | null;
  weekly_tuition?: number | null;
  service?: { code: string; name?: string } | null;
  student?: { full_name: string } | null;
  family?: { display_name: string; primary_email: string | null };
}

interface SendFormsModalProps {
  isOpen: boolean;
  enrollment: EnrollmentForModal | null;
  existingItems?: EnrollmentOnboarding[];
  onClose: () => void;
  onSuccess?: () => void;
}

type MergeData = Record<string, string | number | undefined>;

export function SendFormsModal({
  isOpen,
  enrollment,
  existingItems = [],
  onClose,
  onSuccess,
}: SendFormsModalProps) {
  const { showToast } = useToast();
  const { sendOnboarding } = useOnboardingMutations();

  // Get service configuration
  const serviceCode = enrollment?.service?.code || '';
  const config = SERVICE_ONBOARDING_CONFIG[serviceCode];

  // Track which items are already sent
  const alreadySentKeys = useMemo(
    () => new Set(existingItems.map((item) => item.item_key)),
    [existingItems]
  );

  // All available items for this service
  const availableItems = useMemo(() => {
    if (!config) return [];
    return [
      ...config.forms.map((f) => ({ ...f, type: 'form' as const })),
      ...config.documents.map((d) => ({ ...d, type: 'document' as const })),
    ];
  }, [config]);

  // Items that haven't been sent yet
  const unssentItems = useMemo(
    () => availableItems.filter((item) => !alreadySentKeys.has(item.key)),
    [availableItems, alreadySentKeys]
  );

  // Selected items to send
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Merge data for documents
  const [mergeData, setMergeData] = useState<MergeData>({});

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Initialize selected items and merge data when modal opens
  useEffect(() => {
    if (isOpen && enrollment) {
      // Select all unsent items by default
      setSelectedKeys(new Set(unssentItems.map((item) => item.key)));

      // Pre-fill merge data from enrollment
      setMergeData({
        hourly_rate: enrollment.hourly_rate_customer || undefined,
        hours_per_week: enrollment.hours_per_week || undefined,
        annual_fee: enrollment.annual_fee || undefined,
        monthly_fee: enrollment.monthly_rate || undefined,
        eo_program: enrollment.program_type || undefined,
        eo_weekly_rate: enrollment.weekly_tuition || undefined,
      });

      setError(null);
    }
  }, [isOpen, enrollment, unssentItems]);

  // Check if any selected items are documents (need merge data)
  const hasSelectedDocuments = useMemo(() => {
    return availableItems.some(
      (item) => item.type === 'document' && selectedKeys.has(item.key)
    );
  }, [availableItems, selectedKeys]);

  // Get required merge fields for selected documents
  const requiredMergeFields = useMemo(() => {
    if (!config) return [];
    const hasDocument = availableItems.some(
      (item) => item.type === 'document' && selectedKeys.has(item.key)
    );
    return hasDocument ? config.mergeFields : [];
  }, [config, availableItems, selectedKeys]);

  function handleToggleItem(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function handleSelectAll() {
    setSelectedKeys(new Set(unssentItems.map((item) => item.key)));
  }

  function handleSelectNone() {
    setSelectedKeys(new Set());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!enrollment) return;
    if (selectedKeys.size === 0) {
      setError('Please select at least one form or document to send.');
      return;
    }

    // Validate merge data for documents
    if (hasSelectedDocuments) {
      for (const field of requiredMergeFields) {
        const value = mergeData[field as keyof MergeData];
        if (value === undefined || value === null || value === '') {
          setError(`Please fill in ${formatFieldName(field)} - it's required for the agreement document.`);
          return;
        }
      }
    }

    setError(null);

    try {
      const result = await sendOnboarding.mutateAsync({
        enrollmentId: enrollment.id,
        itemKeys: Array.from(selectedKeys),
        mergeData: hasSelectedDocuments ? mergeData : undefined,
      });

      if (result.warnings && result.warnings.length > 0) {
        showToast(`Forms sent with warnings: ${result.warnings.join(', ')}`, 'warning');
      } else {
        showToast('Forms sent successfully!', 'success');
      }

      onSuccess?.();
      handleClose();
    } catch (err) {
      console.error('Error sending forms:', err);
      setError(err instanceof Error ? err.message : 'Failed to send forms. Please try again.');
    }
  }

  function handleClose() {
    setSelectedKeys(new Set());
    setMergeData({});
    setError(null);
    sendOnboarding.reset();
    onClose();
  }

  function formatFieldName(field: string): string {
    const names: Record<string, string> = {
      hourly_rate: 'Hourly Rate',
      hours_per_week: 'Hours per Week',
      annual_fee: 'Annual Fee',
      monthly_fee: 'Monthly Fee',
      eo_program: 'Program',
      eo_weekly_rate: 'Weekly Rate',
    };
    return names[field] || field;
  }

  if (!enrollment || !config) return null;

  const customerEmail = enrollment.family?.primary_email;
  const studentName = enrollment.student?.full_name || 'Unknown Student';

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Send Onboarding Forms"
      subtitle={`${studentName} • ${enrollment.service?.name || 'Unknown Service'}`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Email recipient info */}
        <div className="p-3 bg-gray-800 rounded-lg">
          <p className="text-sm text-gray-400">
            Forms will be sent to:{' '}
            <span className="text-white font-medium">
              {customerEmail || 'No email on file'}
            </span>
          </p>
        </div>

        {/* No items available */}
        {availableItems.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No onboarding forms configured for this service.</p>
          </div>
        )}

        {/* All items already sent */}
        {availableItems.length > 0 && unssentItems.length === 0 && (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-500/20 rounded-full mb-3">
              <Check className="w-6 h-6 text-green-400" />
            </div>
            <p className="text-gray-300">All forms have already been sent!</p>
            <p className="text-sm text-gray-500 mt-1">
              Check the Forms tab to see their status.
            </p>
          </div>
        )}

        {/* Selectable items */}
        {unssentItems.length > 0 && (
          <>
            {/* Selection controls */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                Select Forms to Send
              </h3>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-blue-400 hover:text-blue-300"
                >
                  Select All
                </button>
                <span className="text-gray-600">|</span>
                <button
                  type="button"
                  onClick={handleSelectNone}
                  className="text-gray-400 hover:text-gray-300"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Items list */}
            <div className="space-y-2">
              {unssentItems.map((item) => (
                <label
                  key={item.key}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedKeys.has(item.key)
                      ? 'bg-blue-500/10 border-blue-500/30'
                      : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedKeys.has(item.key)}
                    onChange={() => handleToggleItem(item.key)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {item.type === 'form' ? (
                        <ClipboardList className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      )}
                      <span className="text-sm text-white font-medium">{item.name}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 ml-6">
                      {item.type === 'form' ? 'Google Form' : 'Agreement Document'}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            {/* Already sent items (shown as disabled) */}
            {alreadySentKeys.size > 0 && (
              <div className="pt-4 border-t border-gray-800">
                <p className="text-xs text-gray-500 mb-2">Already sent:</p>
                <div className="flex flex-wrap gap-2">
                  {availableItems
                    .filter((item) => alreadySentKeys.has(item.key))
                    .map((item) => (
                      <span
                        key={item.key}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gray-800 rounded text-xs text-gray-400"
                      >
                        <Check className="w-3 h-3 text-green-400" />
                        {item.name}
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* Merge data fields for documents */}
            {hasSelectedDocuments && requiredMergeFields.length > 0 && (
              <div className="pt-4 border-t border-gray-800">
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
                  Agreement Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {requiredMergeFields.includes('hourly_rate') && (
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        Hourly Rate ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={mergeData.hourly_rate || ''}
                        onChange={(e) =>
                          setMergeData((prev) => ({
                            ...prev,
                            hourly_rate: e.target.value ? parseFloat(e.target.value) : undefined,
                          }))
                        }
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., 45.00"
                      />
                    </div>
                  )}

                  {requiredMergeFields.includes('hours_per_week') && (
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        Hours per Week
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        value={mergeData.hours_per_week || ''}
                        onChange={(e) =>
                          setMergeData((prev) => ({
                            ...prev,
                            hours_per_week: e.target.value ? parseFloat(e.target.value) : undefined,
                          }))
                        }
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., 3"
                      />
                    </div>
                  )}

                  {requiredMergeFields.includes('annual_fee') && (
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        Annual Registration Fee ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={mergeData.annual_fee || ''}
                        onChange={(e) =>
                          setMergeData((prev) => ({
                            ...prev,
                            annual_fee: e.target.value ? parseFloat(e.target.value) : undefined,
                          }))
                        }
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., 250.00"
                      />
                    </div>
                  )}

                  {requiredMergeFields.includes('monthly_fee') && (
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        Monthly Fee ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={mergeData.monthly_fee || ''}
                        onChange={(e) =>
                          setMergeData((prev) => ({
                            ...prev,
                            monthly_fee: e.target.value ? parseFloat(e.target.value) : undefined,
                          }))
                        }
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., 150.00"
                      />
                    </div>
                  )}

                  {requiredMergeFields.includes('eo_program') && (
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        Program
                      </label>
                      <select
                        value={mergeData.eo_program || ''}
                        onChange={(e) =>
                          setMergeData((prev) => ({
                            ...prev,
                            eo_program: e.target.value || undefined,
                            eo_weekly_rate: e.target.value === '4 days/week' ? 260 : e.target.value === '3 days/week' ? 200 : prev.eo_weekly_rate,
                          }))
                        }
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select program...</option>
                        <option value="3 days/week">3 days/week ($200/week)</option>
                        <option value="4 days/week">4 days/week ($260/week)</option>
                      </select>
                    </div>
                  )}

                  {requiredMergeFields.includes('eo_weekly_rate') && (
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">
                        Weekly Rate ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={mergeData.eo_weekly_rate || ''}
                        onChange={(e) =>
                          setMergeData((prev) => ({
                            ...prev,
                            eo_weekly_rate: e.target.value ? parseFloat(e.target.value) : undefined,
                          }))
                        }
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., 200.00"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Error message */}
        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg"
          >
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Actions */}
        <ModalFooter
          onCancel={handleClose}
          isSubmitting={sendOnboarding.isPending}
          submitDisabled={selectedKeys.size === 0 || !customerEmail || unssentItems.length === 0}
          submitText={`Send ${selectedKeys.size} ${selectedKeys.size === 1 ? 'Form' : 'Forms'}`}
          loadingText="Sending..."
          showSpinner
          submitIcon={<Send className="w-4 h-4" />}
        />
      </form>
    </AccessibleModal>
  );
}
