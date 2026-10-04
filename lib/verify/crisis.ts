// Deterministic safety net: crisis words in the user's own transcript open the help flow
// even if the model fails to call request_help. Deliberately conservative (explicit phrases only).
const PHRASES = [
  "don't want to live", 'do not want to live', 'want to die', 'kill myself', 'end my life', 'no reason to live', 'suicide',
  'jeene ka mann nahi', 'jeena nahi chahti', 'jeena nahi chahta', 'mar jana chahti', 'mar jaana chahti', 'marna chahti', 'khudkushi', 'aatmahatya',
  'जीने का मन नहीं', 'जीना नहीं चाहती', 'जीना नहीं चाहता', 'मर जाना चाहती', 'मरना चाहती', 'आत्महत्या', 'ख़ुदकुशी', 'खुदकुशी',
  'help me i fell', 'i fell down', 'i have fallen', "i've fallen", 'main gir gayi', 'mai gir gayi', 'main gir gai', 'मैं गिर गई', 'मैं गिर गयी',
  // first person only ("hoon"), so "dawai gir gayi" (the medicine fell) never matches
  'gir gayi hoon', 'gir gai hoon', 'gir gaya hoon', 'gir padi hoon', 'gir pada hoon', 'गिर गई हूँ', 'गिर गयी हूँ', 'गिर गया हूँ', 'गिर पड़ी हूँ', 'chest pain', 'seene mein dard', 'सीने में दर्द', "can't breathe", 'saans nahi', 'सांस नहीं',
];

export function crisisMatch(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = text.toLowerCase();
  return PHRASES.find((p) => t.includes(p)) ?? null;
}
