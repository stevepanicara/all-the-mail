export async function fetchWithRetry(url, options = {}, { maxRetries = 3, baseDelay = 1000 } = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok || response.status < 500) return response;
      if (attempt === maxRetries) return response;
    } catch (err) {
      if (attempt === maxRetries) throw err;
    }
    await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, attempt)));
  }
}
