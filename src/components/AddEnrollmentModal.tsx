import { useState, useEffect, useMemo } from 'react';
import { Loader2, Plus, AlertCircle, Search } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { AccessibleSlidePanel } from './ui/AccessibleSlidePanel';
import { ModalFooter } from './ui/ModalFooter';
import {
  useFamiliesWithStudents,
  useActiveServices,
  useActiveTeachers,
  useActiveLocations,
  useEnrollmentMutations,
  useTeacherAssignmentMutations,
  type EnrollmentStatus,
  type EnrollmentInsert,
  type BillingFrequency,
  type Family,
  type Student,
  type Location
} from '../lib/hooks';
import { queryKeys } from '../lib/queryClient';
import { getTodayString } from '../lib/dateUtils';
import { multiplyMoney } from '../lib/moneyUtils';
import { parsePositiveFloat, parsePositiveInt } from '../lib/validation';

// Extended family type with students
interface FamilyWithStudents extends Family {
  students: Student[];
}

// Local interface for services (matches what useActiveServices returns)
interface ServiceData {
  id: string;
  code: string;
  name: string;
  billing_frequency: BillingFrequency;
  default_customer_rate: number | null;
  default_teacher_rate: number | null;
  requires_teacher: boolean;
  description: string | null;
  is_active: boolean;
}

// Local interface for teachers (matches what useActiveTeachers returns)
interface TeacherData {
  id: string;
  display_name: string;
  default_hourly_rate: number | null;
}

interface AddEnrollmentModalProps {
  isOpen: boolean;
  preselectedFamilyId?: string;
  preselectedStudentId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

interface FormData {
  family_id: string;
  student_id: string;
  service_id: string;
  location_id: string;
  status: EnrollmentStatus;
  start_date: string;
  // Billing fields
  hourly_rate_customer: string;
  hours_per_week: string;
  monthly_rate: string;
  weekly_tuition: string;
  daily_rate: string;
  billing_frequency: BillingFrequency | '';
  // FIX #5: Add number_of_weeks for Eaton Online
  number_of_weeks: string;
  // Teacher assignment
  teacher_id: string;
  hourly_rate_teacher: string;
  // Other
  class_title: string;
  schedule_notes: string;
  notes: string;
}

const INITIAL_FORM: FormData = {
  family_id: '',
  student_id: '',
  service_id: '',
  location_id: '',
  status: 'active',
  start_date: getTodayString(),
  hourly_rate_customer: '',
  hours_per_week: '',
  monthly_rate: '',
  weekly_tuition: '',
  daily_rate: '',
  billing_frequency: '',
  number_of_weeks: '',
  teacher_id: '',
  hourly_rate_teacher: '',
  class_title: '',
  schedule_notes: '',
  notes: '',
};

// Services that require a physical location
const IN_PERSON_SERVICES = ['learning_pod', 'eaton_hub', 'elective_classes'];

const STATUS_OPTIONS: { value: EnrollmentStatus; label: string }[] = [
  { value: 'trial', label: 'Trial' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
];

export function AddEnrollmentModal({
  isOpen,
  preselectedFamilyId,
  preselectedStudentId,
  onClose,
  onSuccess
}: AddEnrollmentModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [familySearch, setFamilySearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // React Query hooks for data fetching
  const { data: familiesData = [], isLoading: loadingFamilies } = useFamiliesWithStudents();
  const { data: servicesData = [], isLoading: loadingServices } = useActiveServices();
  const { data: teachersData = [], isLoading: loadingTeachers } = useActiveTeachers();
  const { data: locationsData = [], isLoading: loadingLocations } = useActiveLocations();

  // Cast to local types for type safety
  const families = familiesData as FamilyWithStudents[];
  const services = servicesData as ServiceData[];
  const teachers = teachersData as TeacherData[];
  const locations = locationsData as Location[];

  // Mutations
  const { createEnrollment } = useEnrollmentMutations();
  const { createAssignment } = useTeacherAssignmentMutations();

  const loading = loadingFamilies || loadingServices || loadingTeachers || loadingLocations;
  const isSubmitting = createEnrollment.isPending;

  // Pre-select family/student when modal opens
  useEffect(() => {
    if (isOpen) {
      if (preselectedFamilyId) {
        setFormData(prev => ({ ...prev, family_id: preselectedFamilyId }));
      }
      if (preselectedStudentId) {
        setFormData(prev => ({ ...prev, student_id: preselectedStudentId }));
      }
    }
  }, [isOpen, preselectedFamilyId, preselectedStudentId]);

  // Memoized computed values
  const selectedFamily = useMemo(() =>
    families.find(f => f.id === formData.family_id),
    [families, formData.family_id]
  );

  const selectedService = useMemo(() =>
    services.find(s => s.id === formData.service_id),
    [services, formData.service_id]
  );

  const filteredFamilies = useMemo(() => {
    if (!familySearch) return families;
    const query = familySearch.toLowerCase();
    return families.filter(f =>
      f.display_name?.toLowerCase().includes(query) ||
      f.primary_email?.toLowerCase().includes(query)
    );
  }, [families, familySearch]);

  // FIX #5: Determine which billing fields to show based on service
  // Academic Coaching: hourly rate + hours/week
  const showAcademicCoachingFields = selectedService?.code === 'academic_coaching';

  // Eaton Online: weekly tuition + hours/week + number of weeks
  const showEatonOnlineFields = selectedService?.code === 'eaton_online';

  // Learning Pod: daily rate (per session)
  const showLearningPodFields = selectedService?.code === 'learning_pod';

  // Monthly services: monthly rate only
  const showMonthlyField = selectedService?.billing_frequency === 'monthly' &&
    !showLearningPodFields;

  // Eaton Hub: daily rate only
  const showDailyField = selectedService?.code === 'eaton_hub';

  // Show location picker for in-person services
  const requiresLocation = selectedService && IN_PERSON_SERVICES.includes(selectedService.code);

  // Calculate estimated billing display
  const estimatedBilling = useMemo(() => {
    if (!selectedService) return null;

    const code = selectedService.code;

    if (code === 'academic_coaching' && formData.hourly_rate_customer && formData.hours_per_week) {
      const weekly = multiplyMoney(parseFloat(formData.hourly_rate_customer), parseFloat(formData.hours_per_week));
      return `$${weekly.toFixed(2)}/week`;
    }

    if (code === 'eaton_online' && formData.weekly_tuition) {
      const weekly = parseFloat(formData.weekly_tuition);
      if (formData.number_of_weeks) {
        const total = multiplyMoney(weekly, parseInt(formData.number_of_weeks, 10) || 0);
        return `$${weekly.toFixed(2)}/week x ${formData.number_of_weeks} weeks = $${total.toFixed(2)} total`;
      }
      return `$${weekly.toFixed(2)}/week`;
    }

    if (code === 'learning_pod' && formData.daily_rate) {
      return `$${parseFloat(formData.daily_rate).toFixed(2)}/session`;
    }

    if ((code === 'consulting' || code === 'elective_classes') && formData.monthly_rate) {
      return `$${parseFloat(formData.monthly_rate).toFixed(2)}/month`;
    }

    if (code === 'eaton_hub' && formData.daily_rate) {
      return `$${parseFloat(formData.daily_rate).toFixed(2)}/session`;
    }

    return null;
  }, [selectedService, formData]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
  }

  function handleFamilyChange(familyId: string) {
    setFormData(prev => ({
      ...prev,
      family_id: familyId,
      student_id: '', // Reset student when family changes
    }));
    setError(null);
  }

  function handleServiceChange(serviceId: string) {
    const service = services.find(s => s.id === serviceId);

    // Reset billing fields and set defaults based on service
    const updates: Partial<FormData> = {
      service_id: serviceId,
      billing_frequency: service?.billing_frequency || '',
      // Reset location when service changes (only needed for in-person services)
      location_id: '',
      // Reset all billing fields
      hourly_rate_customer: '',
      hours_per_week: '',
      monthly_rate: '',
      weekly_tuition: '',
      daily_rate: '',
      number_of_weeks: '',
    };

    // Set defaults based on service type
    if (service) {
      switch (service.code) {
        case 'eaton_hub':
          updates.daily_rate = '100';
          break;
        case 'eaton_online':
          // FIX #5: Default values for Eaton Online
          updates.weekly_tuition = '260';
          updates.hours_per_week = '15';
          break;
        case 'learning_pod':
          // Default to $100/session (students over 5), can be changed to $75 for 5 and under
          updates.daily_rate = '100';
          break;
        case 'elective_classes':
          updates.monthly_rate = '250';
          break;
      }
    }

    setFormData(prev => ({ ...prev, ...updates }));
    setError(null);
  }

  function handleTeacherChange(teacherId: string) {
    const teacher = teachers.find(t => t.id === teacherId);
    setFormData(prev => ({
      ...prev,
      teacher_id: teacherId,
      hourly_rate_teacher: teacher?.default_hourly_rate?.toString() || '',
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validation
    if (!formData.family_id) {
      setError('Please select a family');
      return;
    }
    if (!formData.service_id) {
      setError('Please select a service');
      return;
    }

    // Validate location for in-person services
    const service = services.find(s => s.id === formData.service_id);
    if (service && IN_PERSON_SERVICES.includes(service.code) && !formData.location_id) {
      setError('Please select a location for in-person services');
      return;
    }

    // Validate numeric fields with proper bounds checking
    const hourlyRateCustomer = parsePositiveFloat(formData.hourly_rate_customer);
    if (formData.hourly_rate_customer && hourlyRateCustomer === null) {
      setError('Hourly rate must be a valid positive number');
      return;
    }

    const hoursPerWeek = parsePositiveFloat(formData.hours_per_week);
    if (formData.hours_per_week && hoursPerWeek === null) {
      setError('Hours per week must be a valid positive number');
      return;
    }
    if (hoursPerWeek !== null && hoursPerWeek > 168) {
      setError('Hours per week cannot exceed 168');
      return;
    }

    const monthlyRate = parsePositiveFloat(formData.monthly_rate);
    if (formData.monthly_rate && monthlyRate === null) {
      setError('Monthly rate must be a valid positive number');
      return;
    }

    const weeklyTuition = parsePositiveFloat(formData.weekly_tuition);
    if (formData.weekly_tuition && weeklyTuition === null) {
      setError('Weekly tuition must be a valid positive number');
      return;
    }

    const dailyRate = parsePositiveFloat(formData.daily_rate);
    if (formData.daily_rate && dailyRate === null) {
      setError('Daily rate must be a valid positive number');
      return;
    }

    const numberOfWeeks = parsePositiveInt(formData.number_of_weeks);
    if (formData.number_of_weeks && numberOfWeeks === null) {
      setError('Number of weeks must be a valid positive whole number');
      return;
    }
    if (numberOfWeeks !== null && numberOfWeeks > 52) {
      setError('Number of weeks cannot exceed 52');
      return;
    }

    const hourlyRateTeacher = parsePositiveFloat(formData.hourly_rate_teacher);
    if (formData.hourly_rate_teacher && hourlyRateTeacher === null) {
      setError('Teacher rate must be a valid positive number');
      return;
    }

    setError(null);

    // Build enrollment data with validated values
    const enrollmentData: EnrollmentInsert & { teacher_id?: string; hourly_rate_teacher?: number } = {
      family_id: formData.family_id,
      service_id: formData.service_id,
      status: formData.status,
    };

    // Optional fields
    if (formData.student_id) {
      enrollmentData.student_id = formData.student_id;
    }
    if (formData.location_id) {
      enrollmentData.location_id = formData.location_id;
    }
    if (formData.start_date) {
      enrollmentData.start_date = formData.start_date;
    }
    if (hourlyRateCustomer !== null) {
      enrollmentData.hourly_rate_customer = hourlyRateCustomer;
    }
    if (hoursPerWeek !== null) {
      enrollmentData.hours_per_week = hoursPerWeek;
    }
    if (monthlyRate !== null) {
      enrollmentData.monthly_rate = monthlyRate;
    }
    if (weeklyTuition !== null) {
      enrollmentData.weekly_tuition = weeklyTuition;
    }
    if (dailyRate !== null) {
      enrollmentData.daily_rate = dailyRate;
    }
    if (formData.billing_frequency) {
      enrollmentData.billing_frequency = formData.billing_frequency;
    }
    if (formData.class_title.trim()) {
      enrollmentData.class_title = formData.class_title.trim();
    }
    if (formData.schedule_notes.trim()) {
      enrollmentData.schedule_notes = formData.schedule_notes.trim();
    }

    // FIX #5: Include number of weeks in notes for Eaton Online
    let notes = formData.notes.trim();
    if (numberOfWeeks !== null && selectedService?.code === 'eaton_online') {
      const weeksNote = `${numberOfWeeks} weeks program`;
      notes = notes ? `${notes} | ${weeksNote}` : weeksNote;
    }
    if (notes) {
      enrollmentData.notes = notes;
    }

    createEnrollment.mutate(enrollmentData, {
      onSuccess: async (enrollment) => {
        let assignmentError = false;

        // Create teacher assignment if teacher selected
        if (formData.teacher_id && enrollment?.id) {
          const assignmentData: Record<string, unknown> = {
            enrollment_id: enrollment.id,
            teacher_id: formData.teacher_id,
            is_active: true,
            start_date: formData.start_date || getTodayString(),
          };

          if (hourlyRateTeacher !== null) {
            assignmentData.hourly_rate_teacher = hourlyRateTeacher;
          }
          if (hoursPerWeek !== null) {
            assignmentData.hours_per_week = hoursPerWeek;
          }

          try {
            await createAssignment.mutateAsync(assignmentData);
          } catch (err) {
            console.error('Error creating teacher assignment:', err);
            assignmentError = true;
          }
        }

        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.stats.dashboard() });
        queryClient.invalidateQueries({ queryKey: queryKeys.stats.roster() });

        // Report partial failure to user
        if (assignmentError) {
          setError('Enrollment created successfully, but teacher assignment failed. Please assign the teacher manually.');
          // Don't close - let user see the warning
        } else {
          onSuccess?.();
          handleClose();
        }
      },
      onError: (err) => {
        console.error('Error creating enrollment:', err);
        setError(err instanceof Error ? err.message : 'Failed to create enrollment. Please try again.');
      }
    });
  }

  function handleClose() {
    setFormData(INITIAL_FORM);
    setFamilySearch('');
    setError(null);
    createEnrollment.reset();
    onClose();
  }

  return (
    <AccessibleSlidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Enrollment"
      subtitle="Create a new service enrollment"
      icon={<Plus className="w-5 h-5 text-emerald-400" aria-hidden="true" />}
      width="2xl"
    >
      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" aria-hidden="true" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Family & Student Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
              Family & Student
            </h3>

            {/* Family Search/Select */}
            <div>
              <label htmlFor="family-search" className="block text-sm font-medium text-gray-300 mb-2">
                Family <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" aria-hidden="true" />
                <input
                  type="text"
                  id="family-search"
                  placeholder="Search families..."
                  value={familySearch}
                  onChange={(e) => setFamilySearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
                />
              </div>
              <select
                id="family-select"
                value={formData.family_id}
                onChange={(e) => handleFamilyChange(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select family...</option>
                {filteredFamilies.map(family => (
                  <option key={family.id} value={family.id}>
                    {family.display_name}
                    {family.primary_email && ` (${family.primary_email})`}
                  </option>
                ))}
              </select>
            </div>

            {/* Student Select (if family has students) */}
            {selectedFamily && selectedFamily.students && selectedFamily.students.length > 0 && (
              <div>
                <label htmlFor="student-select" className="block text-sm font-medium text-gray-300 mb-2">
                  Student
                </label>
                <select
                  id="student-select"
                  name="student_id"
                  value={formData.student_id}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Family-level enrollment (no specific student)</option>
                  {selectedFamily.students.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.full_name}
                      {student.grade_level && ` (${student.grade_level})`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Service Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
              Service
            </h3>

            <div>
              <label htmlFor="service-select" className="block text-sm font-medium text-gray-300 mb-2">
                Service Type <span className="text-red-400">*</span>
              </label>
              <select
                id="service-select"
                value={formData.service_id}
                onChange={(e) => handleServiceChange(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select service...</option>
                {services.map(service => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Class Title (for electives) */}
            {selectedService?.code === 'elective_classes' && (
              <div>
                <label htmlFor="class-title" className="block text-sm font-medium text-gray-300 mb-2">
                  Class Title
                </label>
                <input
                  type="text"
                  id="class-title"
                  name="class_title"
                  value={formData.class_title}
                  onChange={handleChange}
                  placeholder="e.g., Bitcoin 101, Adulting 101"
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="status-select" className="block text-sm font-medium text-gray-300 mb-2">
                  Status
                </label>
                <select
                  id="status-select"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="start-date" className="block text-sm font-medium text-gray-300 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  id="start-date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Location (for in-person services only) */}
            {requiresLocation && (
              <div>
                <label htmlFor="location-select" className="block text-sm font-medium text-gray-300 mb-2">
                  Location <span className="text-red-400">*</span>
                </label>
                <select
                  id="location-select"
                  name="location_id"
                  value={formData.location_id}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select location...</option>
                  {locations
                    .filter(loc => loc.code !== 'remote')
                    .map(loc => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          {/* Billing Section */}
          {selectedService && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                Billing (Customer)
              </h3>

              {/* Academic Coaching: hourly rate + hours/week */}
              {showAcademicCoachingFields && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="hourly-rate-customer" className="block text-sm font-medium text-gray-300 mb-2">
                      Hourly Rate ($)
                    </label>
                    <input
                      type="number"
                      id="hourly-rate-customer"
                      step="0.01"
                      min="0"
                      name="hourly_rate_customer"
                      value={formData.hourly_rate_customer}
                      onChange={handleChange}
                      placeholder="90.00"
                      className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label htmlFor="hours-per-week-ac" className="block text-sm font-medium text-gray-300 mb-2">
                      Hours/Week
                    </label>
                    <input
                      type="number"
                      id="hours-per-week-ac"
                      step="0.5"
                      min="0"
                      name="hours_per_week"
                      value={formData.hours_per_week}
                      onChange={handleChange}
                      placeholder="5"
                      className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              {/* FIX #5: Eaton Online: weekly tuition + hours/week + number of weeks */}
              {showEatonOnlineFields && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="weekly-tuition" className="block text-sm font-medium text-gray-300 mb-2">
                        Weekly Tuition ($)
                      </label>
                      <input
                        type="number"
                        id="weekly-tuition"
                        step="0.01"
                        min="0"
                        name="weekly_tuition"
                        value={formData.weekly_tuition}
                        onChange={handleChange}
                        placeholder="260.00"
                        className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label htmlFor="number-of-weeks" className="block text-sm font-medium text-gray-300 mb-2">
                        Number of Weeks
                      </label>
                      <input
                        type="number"
                        id="number-of-weeks"
                        step="1"
                        min="1"
                        name="number_of_weeks"
                        value={formData.number_of_weeks}
                        onChange={handleChange}
                        placeholder="36"
                        className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="hours-per-week-eo" className="block text-sm font-medium text-gray-300 mb-2">
                      Hours/Week
                    </label>
                    <input
                      type="number"
                      id="hours-per-week-eo"
                      step="0.5"
                      min="0"
                      name="hours_per_week"
                      value={formData.hours_per_week}
                      onChange={handleChange}
                      placeholder="15"
                      className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Used for teacher assignment and payroll calculations</p>
                  </div>
                </>
              )}

              {/* Learning Pod: per-session rate */}
              {showLearningPodFields && (
                <div>
                  <label htmlFor="daily-rate-pod" className="block text-sm font-medium text-gray-300 mb-2">
                    Rate per Session ($)
                  </label>
                  <input
                    type="number"
                    id="daily-rate-pod"
                    step="0.01"
                    min="0"
                    name="daily_rate"
                    value={formData.daily_rate}
                    onChange={handleChange}
                    placeholder="100.00"
                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">Age 5 & under: $75 | Age 6+: $100</p>
                </div>
              )}

              {/* Monthly services (Consulting, Electives): monthly rate only */}
              {showMonthlyField && (
                <div>
                  <label htmlFor="monthly-rate" className="block text-sm font-medium text-gray-300 mb-2">
                    Monthly Rate ($)
                  </label>
                  <input
                    type="number"
                    id="monthly-rate"
                    step="0.01"
                    min="0"
                    name="monthly_rate"
                    value={formData.monthly_rate}
                    onChange={handleChange}
                    placeholder="500.00"
                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              {/* Eaton Hub: daily rate only */}
              {showDailyField && (
                <div>
                  <label htmlFor="daily-rate-hub" className="block text-sm font-medium text-gray-300 mb-2">
                    Daily Rate ($)
                  </label>
                  <input
                    type="number"
                    id="daily-rate-hub"
                    step="0.01"
                    min="0"
                    name="daily_rate"
                    value={formData.daily_rate}
                    onChange={handleChange}
                    placeholder="100.00"
                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              {/* Estimated Billing Display */}
              {estimatedBilling && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-sm text-blue-400">
                    <span className="font-medium">Estimated billing:</span> {estimatedBilling}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Teacher Assignment Section */}
          {selectedService && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                Teacher Assignment
              </h3>

              <div>
                <label htmlFor="teacher-select" className="block text-sm font-medium text-gray-300 mb-2">
                  Assign Teacher
                </label>
                <select
                  id="teacher-select"
                  value={formData.teacher_id}
                  onChange={(e) => handleTeacherChange(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">No teacher assigned</option>
                  {teachers.map(teacher => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.display_name}
                      {teacher.default_hourly_rate && ` ($${teacher.default_hourly_rate}/hr)`}
                    </option>
                  ))}
                </select>
              </div>

              {formData.teacher_id && (
                <div>
                  <label htmlFor="hourly-rate-teacher" className="block text-sm font-medium text-gray-300 mb-2">
                    Teacher Rate ($/hr)
                  </label>
                  <input
                    type="number"
                    id="hourly-rate-teacher"
                    step="0.01"
                    min="0"
                    name="hourly_rate_teacher"
                    value={formData.hourly_rate_teacher}
                    onChange={handleChange}
                    placeholder="65.00"
                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}
            </div>
          )}

          {/* Notes Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
              Additional Info
            </h3>

            <div>
              <label htmlFor="schedule-notes" className="block text-sm font-medium text-gray-300 mb-2">
                Schedule Notes
              </label>
              <textarea
                id="schedule-notes"
                name="schedule_notes"
                value={formData.schedule_notes}
                onChange={handleChange}
                rows={2}
                placeholder="e.g., Mon/Wed 4pm, Fri 3pm"
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-300 mb-2">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={2}
                placeholder="Any additional notes..."
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div role="alert" className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" aria-hidden="true" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Actions */}
          <ModalFooter
            onCancel={handleClose}
            isSubmitting={isSubmitting}
            submitText="Create Enrollment"
            loadingText="Creating..."
            submitVariant="success"
            showSpinner
            submitIcon={<Plus className="w-4 h-4" aria-hidden="true" />}
          />
        </form>
      )}
    </AccessibleSlidePanel>
  );
}
