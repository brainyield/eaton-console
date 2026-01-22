# Google Forms Webhook Setup

This document explains how to set up automatic form completion tracking for Google Forms used in the Eaton onboarding system.

## Overview

When a family submits a Google Form, an Apps Script trigger sends a notification to the Supabase `form-submitted` webhook, which marks the corresponding `enrollment_onboarding` record as completed.

## Setup Instructions

### For Each Google Form:

1. **Open the Google Form** in edit mode

2. **Open Apps Script**
   - Click the three-dot menu (⋮) in the top-right
   - Select "Script editor"

3. **Replace the default code** with the following:

```javascript
// Eaton Onboarding Form Submission Webhook
// This script notifies the Eaton system when the form is submitted

const WEBHOOK_URL = 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/form-submitted';

function onFormSubmit(e) {
  try {
    // Get form and response info
    const form = FormApp.getActiveForm();
    const formId = extractFormId(form.getEditUrl());
    const response = e.response;

    // Build payload
    const payload = {
      form_id: formId,
      respondent_email: response.getRespondentEmail() || null,
      response_id: response.getId(),
      submitted_at: response.getTimestamp().toISOString(),
      answers: extractAnswers(response)
    };

    // Send to webhook
    const options = {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const result = UrlFetchApp.fetch(WEBHOOK_URL, options);
    console.log('Webhook response:', result.getContentText());

  } catch (error) {
    console.error('Error in onFormSubmit:', error);
  }
}

function extractFormId(editUrl) {
  // Extract form ID from edit URL: https://docs.google.com/forms/d/FORM_ID/edit
  const match = editUrl.match(/\/forms\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

function extractAnswers(response) {
  const answers = {};
  const itemResponses = response.getItemResponses();

  for (const itemResponse of itemResponses) {
    const title = itemResponse.getItem().getTitle();
    const answer = itemResponse.getResponse();

    // Handle different answer types
    if (Array.isArray(answer)) {
      answers[title] = answer.join(', ');
    } else {
      answers[title] = String(answer || '');
    }
  }

  return answers;
}

// Function to manually set up the trigger (run once per form)
function createFormSubmitTrigger() {
  // Remove any existing triggers first
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'onFormSubmit') {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  // Create new trigger
  ScriptApp.newTrigger('onFormSubmit')
    .forForm(FormApp.getActiveForm())
    .onFormSubmit()
    .create();

  console.log('Form submit trigger created successfully');
}
```

4. **Update the WEBHOOK_URL**
   - Replace `YOUR_PROJECT_REF` with your actual Supabase project reference
   - The full URL should be: `https://[project-ref].supabase.co/functions/v1/form-submitted`

5. **Save the script** (Ctrl+S or Cmd+S)

6. **Run `createFormSubmitTrigger`**
   - In the script editor, select `createFormSubmitTrigger` from the function dropdown
   - Click "Run"
   - Grant the necessary permissions when prompted
   - This creates the trigger that fires when forms are submitted

7. **Verify the trigger was created**
   - In the script editor, click "Triggers" (clock icon) in the left sidebar
   - You should see a trigger for `onFormSubmit` on "Form submit"

## Forms to Configure

The following Google Forms need this webhook setup:

### Learning Pod Forms
| Form Name | Form ID |
|-----------|---------|
| Learning Pod Terms of Service Agreement | `1Ayv9FEbeRsTI_gsMf8UWfQz13vFP5ZdoYeKSwZ4lv48` |
| Learning Pod Enrollment Form | `1IMbBq8aCNVnm6vdgiX-BQepAJG2iR5BPjJHWbuLlU8` |
| Learning Pod Allergy Notification Form | `1vbfQKgbpWLV1MgLL5myzHWM62DfkQrMJyPfq1LX3sTI` |
| Learning Pod Student Photo/Video Release | `1Xe-LSy_fK8NepAXFjyPT0t4yYZmSAi53KeIKFG_BfMg` |

### Consulting Forms
| Form Name | Form ID |
|-----------|---------|
| Homeschool Consulting Questionnaire | `19m98i8Ax86VwRXg3ydgqTaUe751Or69Nfrabx3fv0J0` |

## Troubleshooting

### Form submissions not being tracked
1. Check the Apps Script execution logs (Executions in the script editor)
2. Verify the webhook URL is correct
3. Check Supabase Edge Function logs for errors

### Permission errors
- The script needs permission to access the form and make external requests
- Run `createFormSubmitTrigger` again and re-grant permissions

### Email matching not working
- The webhook matches by `form_id` and `sent_to` email (case-insensitive)
- Ensure forms are sent to the same email address used in the family record
- If forms don't require sign-in, the script extracts email from form answers

## How Matching Works

1. When a form is submitted, the Apps Script sends:
   - `form_id`: The Google Form's ID
   - `respondent_email`: Email if form requires Google sign-in
   - `answers`: All form field answers (may contain email)

2. The webhook looks for `enrollment_onboarding` records where:
   - `form_id` matches
   - `status` is 'sent'
   - `sent_to` email matches (if email is available)

3. All matching records are marked as `completed` with a timestamp
