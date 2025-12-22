/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Operations terminal dark theme
        background: 'hsl(224, 71%, 4%)',
        foreground: 'hsl(213, 31%, 91%)',
        card: 'hsl(224, 71%, 4%)',
        'card-foreground': 'hsl(213, 31%, 91%)',
        popover: 'hsl(224, 71%, 4%)',
        'popover-foreground': 'hsl(213, 31%, 91%)',
        primary: 'hsl(210, 40%, 98%)',
        'primary-foreground': 'hsl(222.2, 47.4%, 1.2%)',
        secondary: 'hsl(222.2, 47.4%, 11.2%)',
        'secondary-foreground': 'hsl(210, 40%, 98%)',
        muted: 'hsl(223, 47%, 11%)',
        'muted-foreground': 'hsl(215.4, 16.3%, 56.9%)',
        accent: 'hsl(216, 34%, 17%)',
        'accent-foreground': 'hsl(210, 40%, 98%)',
        destructive: 'hsl(0, 63%, 31%)',
        'destructive-foreground': 'hsl(210, 40%, 98%)',
        border: 'hsl(216, 34%, 17%)',
        input: 'hsl(216, 34%, 17%)',
        ring: 'hsl(216, 34%, 17%)',
        // Status colors from UI spec
        'status-active': '#22c55e',
        'status-trial': '#3b82f6',
        'status-paused': '#f59e0b',
        'status-churned': '#ef4444',
        'status-lead': '#6b7280',
        'invoice-draft': '#6b7280',
        'invoice-sent': '#3b82f6',
        'invoice-paid': '#22c55e',
        'invoice-partial': '#f59e0b',
        'invoice-overdue': '#ef4444',
      },
    },
  },
  plugins: [],
}
