module.exports = {
  content: [
    "./src/**/*.{html,js,ts,jsx,tsx}",
    "app/**/*.{ts,tsx}",
    "components/**/*.{ts,tsx}",
  ],
  corePlugins: { preflight: true },
  theme: {
    extend: {
      fontFamily: {
        "text-md-semibold": "var(--text-md-semibold-font-family)",
        "text-sm-medium": "var(--text-sm-medium-font-family)",
        "text-sm-regular": "var(--text-sm-regular-font-family)",
        "text-sm-semibold": "var(--text-sm-semibold-font-family)",
        "text-xl-semibold": "var(--text-xl-semibold-font-family)",
        "text-xs-medium": "var(--text-xs-medium-font-family)",
        "text-xs-regular": "var(--text-xs-regular-font-family)",
        "text-xs-semibold": "var(--text-xs-semibold-font-family)",
        sans: [
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          '"Segoe UI Symbol"',
          '"Noto Color Emoji"',
        ],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to:   { opacity: "1", transform: "translateY(0)"  },
        },
        "dropdown-in": {
          from: { opacity: "0", transform: "translateY(-6px) scaleY(0.96)" },
          to:   { opacity: "1", transform: "translateY(0) scaleY(1)"        },
        },
        "shrink-x": {
          from: { width: "100%" },
          to:   { width: "0%"   },
        },
        "dot-blink": {
          "0%, 80%, 100%": { opacity: "0.2", transform: "scale(0.8)" },
          "40%":           { opacity: "1",   transform: "scale(1)"   },
        },
        "ai-pulse": {
          "0%, 100%": { opacity: "0.5", boxShadow: "0 0 0 0 rgba(59,130,246,0)" },
          "50%":      { opacity: "1",   boxShadow: "0 0 0 3px rgba(59,130,246,0.15)" },
        },
        "ai-spin": {
          from: { transform: "rotate(0deg)" },
          to:   { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
        "fade-in":      "fade-in 0.18s ease-out both",
        "dropdown-in":  "dropdown-in 0.15s ease-out both",
        "ai-pulse":     "ai-pulse 2s ease-in-out infinite",
        "ai-spin":      "ai-spin 1.4s linear infinite",
      },
    },
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
  },
  plugins: [],
  darkMode: ["class"],
};
