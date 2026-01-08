import { useEffect, useRef } from 'react'
import { FocusTrap } from 'focus-trap-react'
import {
  X,
  Check,
  AlertCircle,
  BookOpen,
  GraduationCap,
  Lightbulb,
  Calculator,
  FlaskConical,
  Globe,
  Monitor,
} from 'lucide-react'
import { useCheckinResponse, type CheckinStudentResource } from '../lib/hooks'
import { formatDateLocal } from '../lib/dateUtils'

interface CheckinResponsePanelProps {
  inviteId: string
  onClose: () => void
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function SectionHeader({ icon: Icon, title }: { icon: typeof BookOpen; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-zinc-400" />
      <h4 className="text-sm font-medium text-zinc-300">{title}</h4>
    </div>
  )
}

function BooleanIndicator({ value, label }: { value: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
      value ? 'bg-green-500/10 text-green-400' : 'bg-zinc-700/50 text-zinc-400'
    }`}>
      {value ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
      <span className="text-sm">{label}</span>
    </div>
  )
}

function ResourceField({ icon: Icon, label, value }: { icon: typeof BookOpen; label: string; value: string | null }) {
  if (!value || value.trim() === '') return null

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <p className="text-sm text-zinc-300 whitespace-pre-wrap">{value}</p>
    </div>
  )
}

function StudentResourceCard({ resource }: { resource: CheckinStudentResource }) {
  const hasResources = resource.ela_resources || resource.math_resources ||
    resource.science_resources || resource.social_resources
  const hasElearning = resource.elearning_status

  if (!hasResources && !hasElearning) {
    return (
      <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h5 className="font-medium text-zinc-100">{resource.student_name}</h5>
          {resource.grade_level && (
            <span className="text-xs text-zinc-500 bg-zinc-700 px-2 py-0.5 rounded">
              {resource.grade_level}
            </span>
          )}
        </div>
        <p className="text-sm text-zinc-500 italic">No resources recorded</p>
      </div>
    )
  }

  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h5 className="font-medium text-zinc-100">{resource.student_name}</h5>
        {resource.grade_level && (
          <span className="text-xs text-zinc-500 bg-zinc-700 px-2 py-0.5 rounded">
            {resource.grade_level}
          </span>
        )}
      </div>

      <div className="space-y-3">
        <ResourceField icon={BookOpen} label="ELA" value={resource.ela_resources} />
        <ResourceField icon={Calculator} label="Math" value={resource.math_resources} />
        <ResourceField icon={FlaskConical} label="Science" value={resource.science_resources} />
        <ResourceField icon={Globe} label="Social Studies" value={resource.social_resources} />
        <ResourceField icon={Monitor} label="E-Learning Status" value={resource.elearning_status} />
      </div>
    </div>
  )
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function CheckinResponsePanel({ inviteId, onClose }: CheckinResponsePanelProps) {
  const { data: response, isLoading, error } = useCheckinResponse(inviteId)
  const panelRef = useRef<HTMLDivElement>(null)

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Prevent body scroll when panel is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <FocusTrap
        focusTrapOptions={{
          initialFocus: false,
          allowOutsideClick: true,
          escapeDeactivates: false,
          returnFocusOnDeactivate: true,
        }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="response-panel-title"
          className="absolute right-0 top-0 h-full w-full max-w-xl bg-zinc-900 border-l border-zinc-700 shadow-xl overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-zinc-900 border-b border-zinc-700 px-6 py-4 flex items-center justify-between">
            <h3 id="response-panel-title" className="text-lg font-semibold text-zinc-100">
              Check-in Response
            </h3>
            <button
              onClick={onClose}
              className="p-1 hover:bg-zinc-800 rounded transition-colors text-zinc-400 hover:text-white"
              aria-label="Close panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {isLoading && (
              <div className="space-y-4 animate-pulse">
                <div className="h-6 bg-zinc-800 rounded w-48" />
                <div className="h-24 bg-zinc-800 rounded" />
                <div className="h-6 bg-zinc-800 rounded w-32" />
                <div className="h-32 bg-zinc-800 rounded" />
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>Failed to load response: {error.message}</span>
              </div>
            )}

            {!isLoading && !error && !response && (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <p className="text-zinc-400">No response found for this invite</p>
              </div>
            )}

            {response && (
              <>
                {/* Submission Info */}
                <div className="text-sm text-zinc-500">
                  Submitted on {formatDateLocal(new Date(response.submitted_at))}
                </div>

                {/* Needs Assessment */}
                <section>
                  <SectionHeader icon={Lightbulb} title="Needs Assessment" />
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <BooleanIndicator value={response.needs_resources} label="Needs Resources" />
                    <BooleanIndicator value={response.needs_training} label="Needs Training" />
                  </div>

                  {response.needs_resources && response.resource_requests && (
                    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 mb-3">
                      <div className="text-xs text-zinc-500 mb-1">Resource Requests</div>
                      <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                        {response.resource_requests}
                      </p>
                    </div>
                  )}

                  {response.needs_training && response.training_requests && (
                    <div className="bg-amber-500/10 border border-amber-600/50 rounded-lg p-3 mb-3">
                      <div className="text-xs text-amber-500 mb-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Training Requested
                      </div>
                      <p className="text-sm text-amber-200 whitespace-pre-wrap">
                        {response.training_requests}
                      </p>
                    </div>
                  )}

                  {response.doing_bom_project !== null && (
                    <BooleanIndicator
                      value={response.doing_bom_project}
                      label="Doing Book of the Month Project"
                    />
                  )}
                </section>

                {/* Student Resources */}
                {response.student_resources && response.student_resources.length > 0 && (
                  <section>
                    <SectionHeader icon={GraduationCap} title={`Student Resources (${response.student_resources.length})`} />
                    <div className="space-y-3">
                      {response.student_resources.map(resource => (
                        <StudentResourceCard key={resource.id} resource={resource} />
                      ))}
                    </div>
                  </section>
                )}

                {/* General Notes */}
                {response.general_notes && (
                  <section>
                    <SectionHeader icon={BookOpen} title="General Notes" />
                    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-3">
                      <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                        {response.general_notes}
                      </p>
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      </FocusTrap>
    </div>
  )
}
