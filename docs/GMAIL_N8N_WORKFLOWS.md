# Gmail n8n Workflow Specifications

This document describes the three n8n workflows required for the Gmail integration feature.

---

## 1. gmail-search Workflow

**Endpoint:** `POST /webhook/gmail-search`

### Purpose
Search Gmail for emails to/from a specific email address, with pagination and search support.

### Input Payload
```json
{
  "email": "customer@example.com",
  "query": "",
  "maxResults": 20,
  "pageToken": null
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Email address to search for (to: OR from:) |
| `query` | string | No | Additional Gmail search terms (e.g., "subject:invoice") |
| `maxResults` | number | No | Max results per page (default: 20) |
| `pageToken` | string | No | Token for fetching next page of results |

### Workflow Nodes

#### Node 1: Webhook
- **Type:** Webhook
- **HTTP Method:** POST
- **Path:** `gmail-search`
- **Response Mode:** "Respond to Webhook" node

#### Node 2: Gmail - Get Many Messages
- **Type:** Gmail
- **Operation:** Get Many
- **Resource:** Message
- **Query:** Build from input:
  ```
  (to:{{$json.email}} OR from:{{$json.email}}) {{$json.query}}
  ```
- **Limit:** `{{$json.maxResults || 20}}`
- **Options:**
  - Include Spam/Trash: No
  - Page Token: `{{$json.pageToken || ''}}`

**Important:** Enable "Return All" = No, and capture the `nextPageToken` from the response.

#### Node 3: Code - Transform Messages
- **Type:** Code (JavaScript)
- **Code:**
```javascript
const messages = $input.all();
const webhookData = $('Webhook').first().json;

// Get nextPageToken from Gmail response metadata
// This may be in different places depending on Gmail node version
const nextPageToken = $('Gmail').first().json?.nextPageToken || null;

const transformedMessages = messages.map(item => {
  const msg = item.json;

  // Extract headers
  const headers = msg.payload?.headers || [];
  const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  const from = getHeader('From');
  const to = getHeader('To');
  const cc = getHeader('Cc');
  const bcc = getHeader('Bcc');
  const subject = getHeader('Subject');
  const date = getHeader('Date');

  // Count recipients
  const countAddresses = (str) => {
    if (!str) return 0;
    return str.split(',').filter(s => s.includes('@')).length;
  };
  const recipientCount = countAddresses(to) + countAddresses(cc) + countAddresses(bcc);

  // Determine if outbound (sent by us)
  const ourDomains = ['eatonacademic.com', 'eaton'];
  const isOutbound = ourDomains.some(domain => from.toLowerCase().includes(domain));

  // Use internalDate (milliseconds since epoch) for accurate timestamp
  const internalDate = parseInt(msg.internalDate) || Date.now();

  return {
    id: msg.id,
    threadId: msg.threadId,
    snippet: msg.snippet || '',
    subject: subject || '(no subject)',
    from: from,
    to: to,
    cc: cc,
    bcc: bcc,
    date: new Date(internalDate).toISOString(),
    internalDate: internalDate,
    isOutbound: isOutbound,
    labelIds: msg.labelIds || [],
    recipientCount: Math.max(recipientCount, 1)
  };
});

return [{
  json: {
    success: true,
    messages: transformedMessages,
    nextPageToken: nextPageToken,
    resultSizeEstimate: transformedMessages.length
  }
}];
```

#### Node 4: Respond to Webhook
- **Type:** Respond to Webhook
- **Response Body:** `{{ $json }}`
- **Response Content-Type:** `application/json`

### Expected Response
```json
{
  "success": true,
  "messages": [
    {
      "id": "18d1234567890abc",
      "threadId": "18d1234567890abc",
      "snippet": "Thank you for your email...",
      "subject": "Re: Invoice Question",
      "from": "John Smith <john@example.com>",
      "to": "ivan@eatonacademic.com",
      "cc": "",
      "bcc": "",
      "date": "2024-12-28T15:30:00.000Z",
      "internalDate": 1735398600000,
      "isOutbound": false,
      "labelIds": ["INBOX", "IMPORTANT"],
      "recipientCount": 1
    }
  ],
  "nextPageToken": "abc123xyz...",
  "resultSizeEstimate": 20
}
```

### Error Response
```json
{
  "success": false,
  "messages": [],
  "error": "Error message here"
}
```

---

## 2. gmail-thread Workflow

**Endpoint:** `POST /webhook/gmail-thread`

### Purpose
Fetch full email thread with complete message bodies for the thread viewer.

### Input Payload
```json
{
  "threadId": "18d1234567890abc"
}
```

### Workflow Nodes

#### Node 1: Webhook
- **Type:** Webhook
- **HTTP Method:** POST
- **Path:** `gmail-thread`

#### Node 2: Gmail - Get Thread
- **Type:** Gmail (or HTTP Request to Gmail API)
- **Operation:** Get Thread
- **Thread ID:** `{{$json.threadId}}`
- **Format:** Full (to get message bodies)

#### Node 3: Code - Transform Thread
- **Type:** Code (JavaScript)
- **Code:**
```javascript
const thread = $input.first().json;

// Extract messages from thread
const messages = thread.messages || [];

const transformedMessages = messages.map(msg => {
  const headers = msg.payload?.headers || [];
  const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  // Extract body - check for multipart
  let bodyText = '';
  let bodyHtml = '';

  const extractBody = (payload) => {
    if (payload.body?.data) {
      const decoded = Buffer.from(payload.body.data, 'base64').toString('utf-8');
      if (payload.mimeType === 'text/html') {
        bodyHtml = decoded;
      } else if (payload.mimeType === 'text/plain') {
        bodyText = decoded;
      }
    }
    if (payload.parts) {
      payload.parts.forEach(part => extractBody(part));
    }
  };

  extractBody(msg.payload);

  // If no text body, strip HTML tags from HTML body
  if (!bodyText && bodyHtml) {
    bodyText = bodyHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const internalDate = parseInt(msg.internalDate) || Date.now();

  return {
    id: msg.id,
    from: getHeader('From'),
    to: getHeader('To'),
    subject: getHeader('Subject'),
    date: new Date(internalDate).toISOString(),
    bodyHtml: bodyHtml,
    bodyText: bodyText || '(no content)',
    messageId: getHeader('Message-ID')
  };
});

// Sort by date ascending (oldest first for thread view)
transformedMessages.sort((a, b) => new Date(a.date) - new Date(b.date));

return [{
  json: {
    success: true,
    thread: {
      id: thread.id,
      messages: transformedMessages
    }
  }
}];
```

#### Node 4: Respond to Webhook
- **Type:** Respond to Webhook
- **Response Body:** `{{ $json }}`

### Expected Response
```json
{
  "success": true,
  "thread": {
    "id": "18d1234567890abc",
    "messages": [
      {
        "id": "18d1234567890abc",
        "from": "ivan@eatonacademic.com",
        "to": "john@example.com",
        "subject": "Invoice for December",
        "date": "2024-12-20T10:00:00.000Z",
        "bodyHtml": "<p>Hello John,</p><p>Please find attached...</p>",
        "bodyText": "Hello John, Please find attached...",
        "messageId": "<abc123@mail.gmail.com>"
      },
      {
        "id": "18d1234567890def",
        "from": "john@example.com",
        "to": "ivan@eatonacademic.com",
        "subject": "Re: Invoice for December",
        "date": "2024-12-21T14:30:00.000Z",
        "bodyHtml": "",
        "bodyText": "Thanks for sending this. I have a question...",
        "messageId": "<def456@mail.gmail.com>"
      }
    ]
  }
}
```

---

## 3. gmail-send Workflow

**Endpoint:** `POST /webhook/gmail-send`

### Purpose
Send a new email or reply to an existing thread.

### Input Payload
```json
{
  "to": "customer@example.com",
  "subject": "Re: Your Question",
  "body": "Thank you for reaching out...",
  "threadId": "18d1234567890abc",
  "inReplyTo": "<abc123@mail.gmail.com>"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `to` | string | Yes | Recipient email address |
| `subject` | string | Yes | Email subject |
| `body` | string | Yes | Plain text email body |
| `threadId` | string | No | Gmail thread ID (for replies) |
| `inReplyTo` | string | No | Message-ID header of email being replied to |

### Workflow Nodes

#### Node 1: Webhook
- **Type:** Webhook
- **HTTP Method:** POST
- **Path:** `gmail-send`

#### Node 2: Gmail - Send Email
- **Type:** Gmail
- **Operation:** Send
- **Resource:** Message
- **To:** `{{$json.to}}`
- **Subject:** `{{$json.subject}}`
- **Message:** `{{$json.body}}`
- **Options:**
  - Thread ID: `{{$json.threadId || ''}}` (for threading)
  - If `inReplyTo` is provided, add headers:
    - `In-Reply-To`: `{{$json.inReplyTo}}`
    - `References`: `{{$json.inReplyTo}}`

**Note:** The Gmail node may not support all threading headers directly. You may need to use the HTTP Request node with Gmail API directly for full threading support.

#### Alternative Node 2: HTTP Request (for full control)
- **Type:** HTTP Request
- **Method:** POST
- **URL:** `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`
- **Authentication:** OAuth2 (Gmail)
- **Body:**
```javascript
// In a Code node before this:
const to = $json.to;
const subject = $json.subject;
const body = $json.body;
const threadId = $json.threadId;
const inReplyTo = $json.inReplyTo;

let headers = `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n`;

if (inReplyTo) {
  headers += `In-Reply-To: ${inReplyTo}\r\nReferences: ${inReplyTo}\r\n`;
}

const email = headers + `\r\n${body}`;
const encodedEmail = Buffer.from(email).toString('base64url');

return {
  raw: encodedEmail,
  threadId: threadId || undefined
};
```

#### Node 3: Respond to Webhook
- **Type:** Respond to Webhook
- **Response Body:**
```json
{
  "success": true,
  "messageId": "{{$json.id}}"
}
```

### Expected Response
```json
{
  "success": true,
  "messageId": "18d1234567890xyz"
}
```

### Error Response
```json
{
  "success": false,
  "messageId": "",
  "error": "Failed to send email: reason"
}
```

---

## Gmail API Scopes Required

Ensure your Gmail OAuth credentials have these scopes:
- `https://www.googleapis.com/auth/gmail.readonly` - For search and thread reading
- `https://www.googleapis.com/auth/gmail.send` - For sending emails
- `https://www.googleapis.com/auth/gmail.modify` - If you need to modify labels

---

## Testing

### Test gmail-search
```bash
curl -X POST https://eatonacademic.app.n8n.cloud/webhook/gmail-search \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "maxResults": 5}'
```

### Test pagination
```bash
# First request
curl -X POST https://eatonacademic.app.n8n.cloud/webhook/gmail-search \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "maxResults": 5}'

# Use nextPageToken from response for next page
curl -X POST https://eatonacademic.app.n8n.cloud/webhook/gmail-search \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "maxResults": 5, "pageToken": "TOKEN_FROM_PREVIOUS"}'
```

### Test gmail-thread
```bash
curl -X POST https://eatonacademic.app.n8n.cloud/webhook/gmail-thread \
  -H "Content-Type: application/json" \
  -d '{"threadId": "18d1234567890abc"}'
```

### Test gmail-send
```bash
curl -X POST https://eatonacademic.app.n8n.cloud/webhook/gmail-send \
  -H "Content-Type: application/json" \
  -d '{"to": "test@example.com", "subject": "Test", "body": "Hello from Console"}'
```

---

## Checklist

### gmail-search
- [ ] Returns `internalDate` (milliseconds) for each message
- [ ] Returns `recipientCount` for each message
- [ ] Returns `nextPageToken` when more results available
- [ ] Accepts `pageToken` parameter for pagination
- [ ] Accepts `query` parameter for search filtering
- [ ] `isOutbound` correctly identifies sent emails

### gmail-thread
- [ ] Returns full message bodies (text and/or HTML)
- [ ] Returns `messageId` header for reply threading
- [ ] Messages sorted by date ascending

### gmail-send
- [ ] Successfully sends new emails
- [ ] Supports `threadId` for replies
- [ ] Supports `inReplyTo` header for proper threading
- [ ] Returns the new message ID on success
