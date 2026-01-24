import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Check,
  AlertCircle,
  Lightbulb,
  GraduationCap,
  Monitor,
  ClipboardCheck,
  BookOpen,
  Calculator,
  FlaskConical,
  Globe,
  Loader2,
  X,
} from 'lucide-react'
import {
  useTeacherByToken,
  useTeacherStudents,
  useCheckinPeriod,
  useCheckinInvites,
  type TeacherStudent,
} from '../lib/hooks'
import { useCheckinFormSubmit } from '../lib/hooks'

// =============================================================================
// TYPES
// =============================================================================

interface NeedsAssessment {
  needsResources: boolean
  resourceRequests: string
  needsTraining: boolean
  trainingRequests: string
  doingBomProject: boolean | null
}

interface StudentResources {
  studentId: string
  studentName: string
  gradeLevel: string | null
  elaResources: string
  mathResources: string
  scienceResources: string
  socialResources: string
  elearningStatus: string
}

interface FormData {
  needsAssessment: NeedsAssessment
  studentResources: StudentResources[]
}

type Step = 1 | 2 | 3 | 4

// =============================================================================
// CONSTANTS
// =============================================================================

const STORAGE_KEY_PREFIX = 'checkin_form_'

const DEFAULT_NEEDS_ASSESSMENT: NeedsAssessment = {
  needsResources: false,
  resourceRequests: '',
  needsTraining: false,
  trainingRequests: '',
  doingBomProject: null,
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getStorageKey(inviteId: string): string {
  return `${STORAGE_KEY_PREFIX}${inviteId}`
}

function loadFromStorage(inviteId: string): FormData | null {
  try {
    const stored = localStorage.getItem(getStorageKey(inviteId))
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // Silently fail - localStorage may be unavailable or data corrupted
  }
  return null
}

function saveToStorage(inviteId: string, data: FormData): void {
  try {
    localStorage.setItem(getStorageKey(inviteId), JSON.stringify(data))
  } catch {
    // Silently fail - localStorage may be unavailable or quota exceeded
  }
}

function clearStorage(inviteId: string): void {
  try {
    localStorage.removeItem(getStorageKey(inviteId))
  } catch {
    // Silently fail - localStorage may be unavailable
  }
}

function initializeStudentResources(students: TeacherStudent[]): StudentResources[] {
  return students.map(s => ({
    studentId: s.student_id,
    studentName: s.student_name,
    gradeLevel: s.grade_level,
    elaResources: '',
    mathResources: '',
    scienceResources: '',
    socialResources: '',
    elearningStatus: '',
  }))
}

// =============================================================================
// LOADING VIEW
// =============================================================================

function LoadingView() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="flex items-center gap-3 text-zinc-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading check-in form...
      </div>
    </div>
  )
}

// =============================================================================
// ERROR VIEW
// =============================================================================

function ErrorView({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 bg-red-900/50 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">{title}</h1>
        <p className="text-zinc-400">{message}</p>
      </div>
    </div>
  )
}

// =============================================================================
// ALREADY SUBMITTED VIEW
// =============================================================================

function AlreadySubmittedView({ token, periodName, submittedAt }: { token: string; periodName: string; submittedAt: string }) {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check className="w-8 h-8 text-green-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Already Completed</h1>
        <p className="text-zinc-400 mb-2">
          You've already submitted your check-in for <strong className="text-zinc-200">{periodName}</strong>.
        </p>
        <p className="text-zinc-500 text-sm mb-6">
          Submitted on {new Date(submittedAt).toLocaleDateString()}
        </p>
        <button
          onClick={() => navigate(`/desk/${token}`)}
          className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
        >
          Back to Desk
        </button>
      </div>
    </div>
  )
}

// =============================================================================
// STEP INDICATOR
// =============================================================================

function StepIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  const steps = [
    { num: 1, label: 'Needs' },
    { num: 2, label: 'Resources' },
    { num: 3, label: 'E-Learning' },
    { num: 4, label: 'Review' },
  ]

  return (
    <div className="flex items-center justify-center gap-2">
      {steps.slice(0, totalSteps).map((step, idx) => (
        <div key={step.num} className="flex items-center">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
            currentStep === step.num
              ? 'bg-blue-600 text-white'
              : currentStep > step.num
              ? 'bg-green-900/50 text-green-400'
              : 'bg-zinc-800 text-zinc-500'
          }`}>
            {currentStep > step.num ? (
              <Check className="w-4 h-4" />
            ) : (
              <span className="w-4 text-center">{step.num}</span>
            )}
            <span className="hidden sm:inline">{step.label}</span>
          </div>
          {idx < totalSteps - 1 && (
            <div className={`w-8 h-0.5 mx-1 ${
              currentStep > step.num ? 'bg-green-600' : 'bg-zinc-700'
            }`} />
          )}
        </div>
      ))}
    </div>
  )
}

// =============================================================================
// STEP 1: NEEDS ASSESSMENT
// =============================================================================

interface Step1Props {
  data: NeedsAssessment
  onChange: (data: NeedsAssessment) => void
}

function Step1NeedsAssessment({ data, onChange }: Step1Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-amber-900/50 rounded-lg flex items-center justify-center">
          <Lightbulb className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Needs Assessment</h2>
          <p className="text-sm text-zinc-400">Let us know if you need any support</p>
        </div>
      </div>

      {/* Resources Needed */}
      <div className="space-y-3">
        <label className="flex items-center justify-between p-4 bg-zinc-800 border border-zinc-700 rounded-lg cursor-pointer hover:border-zinc-600 transition-colors">
          <span className="text-zinc-200">Do you need any resources?</span>
          <ToggleSwitch
            checked={data.needsResources}
            onChange={(checked) => onChange({ ...data, needsResources: checked })}
          />
        </label>

        {data.needsResources && (
          <div className="pl-4 border-l-2 border-zinc-700">
            <label className="block text-sm text-zinc-400 mb-2">
              What resources do you need?
            </label>
            <textarea
              value={data.resourceRequests}
              onChange={(e) => onChange({ ...data, resourceRequests: e.target.value })}
              placeholder="Describe the resources you need..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 min-h-[100px] resize-y"
            />
          </div>
        )}
      </div>

      {/* Training Needed */}
      <div className="space-y-3">
        <label className="flex items-center justify-between p-4 bg-zinc-800 border border-zinc-700 rounded-lg cursor-pointer hover:border-zinc-600 transition-colors">
          <span className="text-zinc-200">Do you need training?</span>
          <ToggleSwitch
            checked={data.needsTraining}
            onChange={(checked) => onChange({ ...data, needsTraining: checked })}
          />
        </label>

        {data.needsTraining && (
          <div className="pl-4 border-l-2 border-amber-700/50">
            <label className="block text-sm text-amber-400 mb-2">
              What training do you need?
            </label>
            <textarea
              value={data.trainingRequests}
              onChange={(e) => onChange({ ...data, trainingRequests: e.target.value })}
              placeholder="Describe the training you need..."
              className="w-full bg-zinc-800 border border-amber-700/50 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 min-h-[100px] resize-y"
            />
          </div>
        )}
      </div>

      {/* Book of the Month */}
      <div className="space-y-3">
        <label className="block text-zinc-200 mb-2">
          Is your homeschool doing the Book of the Month project?
        </label>
        <div className="flex gap-3">
          {[
            { value: true, label: 'Yes' },
            { value: false, label: 'No' },
            { value: null, label: 'Not Sure' },
          ].map((option) => (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => onChange({ ...data, doingBomProject: option.value })}
              className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                data.doingBomProject === option.value
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// STEP 2: STUDENT RESOURCES
// =============================================================================

interface Step2Props {
  students: StudentResources[]
  onChange: (students: StudentResources[]) => void
}

function Step2StudentResources({ students, onChange }: Step2Props) {
  const updateStudent = (index: number, field: keyof StudentResources, value: string) => {
    const updated = [...students]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-900/50 rounded-lg flex items-center justify-center">
          <GraduationCap className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Student Resources</h2>
          <p className="text-sm text-zinc-400">List the resources you're using for each student</p>
        </div>
      </div>

      <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-3 text-sm text-blue-300">
        <strong>Tip:</strong> Be specific - "Khan Academy Algebra 1" not just "Khan"
      </div>

      <div className="space-y-6">
        {students.map((student, index) => (
          <div key={student.studentId} className="bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden">
            <div className="bg-zinc-700/50 px-4 py-3 flex items-center justify-between">
              <h3 className="font-medium text-zinc-100">{student.studentName}</h3>
              {student.gradeLevel && (
                <span className="text-xs text-zinc-400 bg-zinc-600 px-2 py-0.5 rounded">
                  {student.gradeLevel}
                </span>
              )}
            </div>
            <div className="p-4 space-y-4">
              <ResourceField
                icon={BookOpen}
                label="ELA Resources"
                value={student.elaResources}
                onChange={(v) => updateStudent(index, 'elaResources', v)}
                placeholder="e.g., Quill, Wordlywise, 180 Days Comprehension"
              />
              <ResourceField
                icon={Calculator}
                label="Math Resources"
                value={student.mathResources}
                onChange={(v) => updateStudent(index, 'mathResources', v)}
                placeholder="e.g., Khan Academy Grade 5, Singapore Math"
              />
              <ResourceField
                icon={FlaskConical}
                label="Science Resources"
                value={student.scienceResources}
                onChange={(v) => updateStudent(index, 'scienceResources', v)}
                placeholder="e.g., Mystery Science, National Geographic Kids"
              />
              <ResourceField
                icon={Globe}
                label="Social Studies Resources"
                value={student.socialResources}
                onChange={(v) => updateStudent(index, 'socialResources', v)}
                placeholder="e.g., Core Knowledge History, BrainPOP"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// STEP 3: E-LEARNING STATUS
// =============================================================================

interface Step3Props {
  students: StudentResources[]
  onChange: (students: StudentResources[]) => void
}

function Step3ElearningStatus({ students, onChange }: Step3Props) {
  const updateStudent = (index: number, value: string) => {
    const updated = [...students]
    updated[index] = { ...updated[index], elearningStatus: value }
    onChange(updated)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-purple-900/50 rounded-lg flex items-center justify-center">
          <Monitor className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">E-Learning Status</h2>
          <p className="text-sm text-zinc-400">How are your students performing in their e-learning programs?</p>
        </div>
      </div>

      <div className="bg-purple-900/20 border border-purple-800/50 rounded-lg p-3 text-sm text-purple-300">
        <strong>Tip:</strong> Include platform + course name + performance notes
      </div>

      <div className="space-y-4">
        {students.map((student, index) => (
          <div key={student.studentId} className="bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden">
            <div className="bg-zinc-700/50 px-4 py-3 flex items-center justify-between">
              <h3 className="font-medium text-zinc-100">{student.studentName}</h3>
              {student.gradeLevel && (
                <span className="text-xs text-zinc-400 bg-zinc-600 px-2 py-0.5 rounded">
                  {student.gradeLevel}
                </span>
              )}
            </div>
            <div className="p-4">
              <textarea
                value={student.elearningStatus}
                onChange={(e) => updateStudent(index, e.target.value)}
                placeholder="e.g., Khan Academy Math - 85% mastery, on track. IXL ELA - completing 30 min daily, improving in grammar"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 min-h-[80px] resize-y text-sm"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// STEP 4: REVIEW
// =============================================================================

interface Step4Props {
  needsAssessment: NeedsAssessment
  students: StudentResources[]
}

function Step4Review({ needsAssessment, students }: Step4Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-green-900/50 rounded-lg flex items-center justify-center">
          <ClipboardCheck className="w-5 h-5 text-green-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Review Your Check-in</h2>
          <p className="text-sm text-zinc-400">Please review before submitting</p>
        </div>
      </div>

      {/* Needs Assessment Summary */}
      <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
        <h3 className="font-medium text-zinc-200 mb-3">Needs Assessment</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span className={needsAssessment.needsResources ? 'text-amber-400' : 'text-zinc-500'}>
              {needsAssessment.needsResources ? '!' : '-'}
            </span>
            <span className="text-zinc-300">
              Resources needed: {needsAssessment.needsResources ? 'Yes' : 'No'}
              {needsAssessment.needsResources && needsAssessment.resourceRequests && (
                <span className="block text-zinc-400 mt-1">"{needsAssessment.resourceRequests}"</span>
              )}
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className={needsAssessment.needsTraining ? 'text-amber-400' : 'text-zinc-500'}>
              {needsAssessment.needsTraining ? '!' : '-'}
            </span>
            <span className="text-zinc-300">
              Training needed: {needsAssessment.needsTraining ? 'Yes' : 'No'}
              {needsAssessment.needsTraining && needsAssessment.trainingRequests && (
                <span className="block text-zinc-400 mt-1">"{needsAssessment.trainingRequests}"</span>
              )}
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-zinc-500">-</span>
            <span className="text-zinc-300">
              Book of the Month: {needsAssessment.doingBomProject === true ? 'Yes' : needsAssessment.doingBomProject === false ? 'No' : 'Not Sure'}
            </span>
          </div>
        </div>
      </div>

      {/* Student Resources Summary */}
      <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
        <h3 className="font-medium text-zinc-200 mb-3">Student Resources</h3>
        <div className="space-y-3">
          {students.map(student => {
            const resourceCount = [
              student.elaResources,
              student.mathResources,
              student.scienceResources,
              student.socialResources,
            ].filter(r => r.trim()).length

            return (
              <div key={student.studentId} className="text-sm">
                <span className="text-zinc-200">{student.studentName}</span>
                <span className="text-zinc-500 ml-2">
                  ({resourceCount}/4 subjects filled)
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* E-Learning Summary */}
      <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
        <h3 className="font-medium text-zinc-200 mb-3">E-Learning Status</h3>
        <div className="space-y-3">
          {students.map(student => (
            <div key={student.studentId} className="text-sm">
              <span className="text-zinc-200">{student.studentName}:</span>
              <span className="text-zinc-400 ml-2">
                {student.elearningStatus.trim() || '(no status provided)'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {needsAssessment.needsTraining && (
        <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4 text-sm text-amber-300">
          <strong>Note:</strong> Since you requested training, you'll receive an email with a link to schedule a session.
        </div>
      )}
    </div>
  )
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-blue-600' : 'bg-zinc-600'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

interface ResourceFieldProps {
  icon: typeof BookOpen
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}

function ResourceField({ icon: Icon, label, value, onChange, placeholder }: ResourceFieldProps) {
  return (
    <div>
      <label className="flex items-center gap-2 text-sm text-zinc-400 mb-1.5">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 text-sm"
      />
    </div>
  )
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface CheckinFormProps {
  token: string
  periodId: string
}

export default function CheckinForm({ token, periodId }: CheckinFormProps) {
  const navigate = useNavigate()

  // Fetch data
  const { data: teacher, isLoading: teacherLoading, error: teacherError } = useTeacherByToken(token)
  const { data: period, isLoading: periodLoading, error: periodError } = useCheckinPeriod(periodId)
  const { data: invites, isLoading: invitesLoading } = useCheckinInvites(periodId)
  const { data: students, isLoading: studentsLoading } = useTeacherStudents(teacher?.id)

  // Find the invite for this teacher
  const invite = useMemo(() => {
    if (!invites || !teacher) return null
    return invites.find(i => i.teacher_id === teacher.id) || null
  }, [invites, teacher])

  // Form state
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [needsAssessment, setNeedsAssessment] = useState<NeedsAssessment>(DEFAULT_NEEDS_ASSESSMENT)
  const [studentResources, setStudentResources] = useState<StudentResources[]>([])
  const [isInitialized, setIsInitialized] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Submit mutation
  const submitMutation = useCheckinFormSubmit()

  // Validation: ensure each student has at least one resource filled in
  const validateStudentResources = useCallback(() => {
    if (studentResources.length === 0) return true // No students to validate

    const studentsWithoutResources = studentResources.filter(sr => {
      const hasEla = sr.elaResources.trim().length > 0
      const hasMath = sr.mathResources.trim().length > 0
      const hasScience = sr.scienceResources.trim().length > 0
      const hasSocial = sr.socialResources.trim().length > 0
      return !hasEla && !hasMath && !hasScience && !hasSocial
    })

    if (studentsWithoutResources.length > 0) {
      const names = studentsWithoutResources.map(s => s.studentName).join(', ')
      setValidationError(`Please add at least one resource for: ${names}`)
      return false
    }

    setValidationError(null)
    return true
  }, [studentResources])

  // Initialize form data from localStorage or students
  useEffect(() => {
    if (!invite || !students || isInitialized) return

    const stored = loadFromStorage(invite.id)
    if (stored) {
      setNeedsAssessment(stored.needsAssessment)
      // Merge stored resources with current students (in case students changed)
      const mergedResources = students.map(s => {
        const existing = stored.studentResources.find(sr => sr.studentId === s.student_id)
        if (existing) {
          return { ...existing, studentName: s.student_name, gradeLevel: s.grade_level }
        }
        return {
          studentId: s.student_id,
          studentName: s.student_name,
          gradeLevel: s.grade_level,
          elaResources: '',
          mathResources: '',
          scienceResources: '',
          socialResources: '',
          elearningStatus: '',
        }
      })
      setStudentResources(mergedResources)
    } else {
      setStudentResources(initializeStudentResources(students))
    }
    setIsInitialized(true)
  }, [invite, students, isInitialized])

  // Auto-save to localStorage on changes
  useEffect(() => {
    if (!invite || !isInitialized) return
    saveToStorage(invite.id, { needsAssessment, studentResources })
  }, [invite, needsAssessment, studentResources, isInitialized])

  // Navigation handlers
  const goToStep = useCallback((step: Step) => {
    setCurrentStep(step)
    window.scrollTo(0, 0)
  }, [])

  const handleNext = useCallback(() => {
    // Validate before moving to review step
    if (currentStep === 3) {
      if (!validateStudentResources()) {
        return // Don't proceed if validation fails
      }
    }
    if (currentStep < 4) {
      setValidationError(null)
      goToStep((currentStep + 1) as Step)
    }
  }, [currentStep, goToStep, validateStudentResources])

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      goToStep((currentStep - 1) as Step)
    }
  }, [currentStep, goToStep])

  // Submit handler
  const handleSubmit = useCallback(async () => {
    if (!invite || !teacher) return

    try {
      await submitMutation.mutateAsync({
        inviteId: invite.id,
        periodId: periodId,
        teacherId: teacher.id,
        teacherName: teacher.display_name,
        teacherEmail: teacher.email,
        needsAssessment: {
          needs_resources: needsAssessment.needsResources,
          resource_requests: needsAssessment.resourceRequests || null,
          needs_training: needsAssessment.needsTraining,
          training_requests: needsAssessment.trainingRequests || null,
          doing_bom_project: needsAssessment.doingBomProject,
        },
        studentResources: studentResources.map(sr => ({
          student_id: sr.studentId,
          student_name: sr.studentName,
          grade_level: sr.gradeLevel,
          ela_resources: sr.elaResources || null,
          math_resources: sr.mathResources || null,
          science_resources: sr.scienceResources || null,
          social_resources: sr.socialResources || null,
          elearning_status: sr.elearningStatus || null,
        })),
      })

      // Clear localStorage on success
      clearStorage(invite.id)

      // Navigate back to desk with success message
      navigate(`/desk/${token}?submitted=true`, { replace: true })
    } catch {
      // Error is already displayed via submitMutation.isError state
    }
  }, [invite, teacher, periodId, needsAssessment, studentResources, submitMutation, token, navigate])

  // Loading state
  const isLoading = teacherLoading || periodLoading || invitesLoading || studentsLoading

  if (isLoading) {
    return <LoadingView />
  }

  // Error states
  if (teacherError || !teacher) {
    return <ErrorView title="Invalid Link" message="This check-in link is not valid. Please use the link from your email." />
  }

  if (periodError || !period) {
    return <ErrorView title="Period Not Found" message="This check-in period doesn't exist or has been removed." />
  }

  if (period.status !== 'open') {
    return <ErrorView title="Check-in Closed" message="This check-in period is no longer accepting responses." />
  }

  if (!invite) {
    return <ErrorView title="Not Invited" message="You haven't been invited to this check-in period." />
  }

  if (invite.status === 'submitted' && invite.submitted_at) {
    return <AlreadySubmittedView token={token} periodName={period.display_name} submittedAt={invite.submitted_at} />
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-bold text-white">Monthly Check-in</h1>
              <p className="text-sm text-zinc-400">{period.display_name}</p>
            </div>
            <button
              onClick={() => navigate(`/desk/${token}`)}
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Save & Exit
            </button>
          </div>
          <StepIndicator currentStep={currentStep} totalSteps={4} />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-6 py-8">
        {currentStep === 1 && (
          <Step1NeedsAssessment data={needsAssessment} onChange={setNeedsAssessment} />
        )}
        {currentStep === 2 && (
          <Step2StudentResources students={studentResources} onChange={setStudentResources} />
        )}
        {currentStep === 3 && (
          <Step3ElearningStatus students={studentResources} onChange={setStudentResources} />
        )}
        {currentStep === 4 && (
          <Step4Review needsAssessment={needsAssessment} students={studentResources} />
        )}
      </main>

      {/* Footer Navigation */}
      <footer className="sticky bottom-0 bg-zinc-900 border-t border-zinc-800">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              currentStep === 1
                ? 'text-zinc-600 cursor-not-allowed'
                : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          {currentStep < 4 ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  Submit Check-in
                  <Check className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </footer>

      {/* Error Toast */}
      {(validationError || submitMutation.isError) && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 max-w-md mx-4">
          <div className="flex items-start gap-3 bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded-lg shadow-lg">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                {validationError || 'Failed to submit. Please try again.'}
              </p>
            </div>
            <button
              onClick={() => {
                setValidationError(null)
                submitMutation.reset()
              }}
              className="text-red-400 hover:text-red-300 transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
