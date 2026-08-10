// Ask Vorta is an interactive operational assistant. The limiter protects against
// accidental request loops and abuse; it is not intended to act as a practical
// daily usage cap for legitimate site users.
export const ASK_VORTA_RATE_LIMIT_WINDOW_MINUTES = 5;
export const ASK_VORTA_RATE_LIMIT_REQUESTS = 60;
