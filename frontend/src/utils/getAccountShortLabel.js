/**
 * Generate short, readable labels for account badges
 * 
 * @param {string} accountName - Full account display name
 * @returns {string} Short label (2-6 chars, uppercase)
 * 
 * Examples:
 * - "Ranger & Fox" → "RF"
 * - "Acme Design Studio" → "ADS"
 * - "Notion" → "NOTI"
 * - "john.doe@gmail.com" → "JOHN"
 * - "demo-account" → "DA"
 */
export function getAccountShortLabel(accountName = "") {
  if (!accountName) return "";

  // Step 1: Normalize
  // Remove email domain
  let name = accountName.split("@")[0];

  // Replace separators with spaces (hyphens, underscores, dots, etc.)
  name = name.replace(/[^a-zA-Z0-9\s]/g, " ").trim();

  // Split into words
  const words = name.split(/\s+/).filter(Boolean);

  // Step 2: Choose label strategy
  
  // Strategy 1: Multi-word names → initials
  if (words.length > 1) {
    const initials = words
      .slice(0, 4)                    // Max 4 words
      .map(word => word[0])           // First letter of each
      .join("")
      .toUpperCase();
    
    return initials.slice(0, 6);      // Clamp to 6 chars
  }

  // Strategy 2: Single word → first 4 characters
  if (words.length === 1) {
    return words[0].slice(0, 4).toUpperCase();
  }

  // Strategy 3: Fallback → first 4 chars of full name
  return name.slice(0, 4).toUpperCase();
}

/**
 * Test cases (for development)
 */
export function testAccountShortLabel() {
  const tests = [
    { input: "Ranger & Fox", expected: "RF" },
    { input: "Acme Design Studio", expected: "ADS" },
    { input: "Notion", expected: "NOTI" },
    { input: "john.doe@gmail.com", expected: "JOHN" },
    { input: "demo-account", expected: "DA" },
    { input: "Personal Email", expected: "PE" },
    { input: "Work", expected: "WORK" },
    { input: "my_side_project", expected: "MSP" },
    { input: "ACME Corp Ventures LLC", expected: "ACVL" },
    { input: "a", expected: "A" },
    { input: "", expected: "" },
    { input: "Stephen's Personal", expected: "SP" },
    { input: "R&F Design Co.", expected: "RFDC" },
  ];

  console.log("Testing getAccountShortLabel:");
  tests.forEach(({ input, expected }) => {
    const result = getAccountShortLabel(input);
    const pass = result === expected;
    console.log(`${pass ? '✓' : '✗'} "${input}" → "${result}" ${!pass ? `(expected: ${expected})` : ''}`);
  });
}
