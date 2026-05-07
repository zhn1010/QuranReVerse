/**
 * Generate a browser/device fingerprint for anonymous user tracking.
 * Combines multiple browser characteristics to create a unique identifier.
 */

export async function getBrowserFingerprint(): Promise<string> {
  const components: string[] = [];

  // User agent (browser, OS info)
  components.push(navigator.userAgent);

  // Language preferences
  components.push(navigator.language);
  components.push(navigator.languages?.join(',') ?? '');

  // Screen characteristics
  components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
  components.push(`${screen.availWidth}x${screen.availHeight}`);
  components.push(`dpr:${window.devicePixelRatio}`);

  // Timezone
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Canvas fingerprint
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      canvas.width = 200;
      canvas.height = 50;
      
      // Draw text with specific styling
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#f60';
      ctx.fillRect(0, 0, 200, 50);
      ctx.fillStyle = '#069';
      ctx.font = '14px Arial';
      ctx.fillText('Sakinah.now fingerprint', 10, 30);
      
      // Add some complexity
      ctx.strokeStyle = '#069';
      ctx.beginPath();
      ctx.arc(150, 25, 10, 0, Math.PI * 2);
      ctx.stroke();
      
      components.push(canvas.toDataURL());
    }
  } catch {
    components.push('canvas-unavailable');
  }

  // WebGL info
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const vendor = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        components.push(`webgl:${vendor}:${renderer}`);
      } else {
        const vendor = (gl as WebGLRenderingContext).getParameter((gl as WebGLRenderingContext).VENDOR);
        const renderer = (gl as WebGLRenderingContext).getParameter((gl as WebGLRenderingContext).RENDERER);
        components.push(`webgl:${vendor}:${renderer}`);
      }
    }
  } catch {
    components.push('webgl-unavailable');
  }

  // Fonts check (basic)
  try {
    const testString = 'mmllMMWW';
    const testFonts = ['Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana'];
    const baseWidth = measureText(testString, 'monospace');
    const fontResults: string[] = [];
    
    for (const font of testFonts) {
      const width = measureText(testString, font);
      fontResults.push(width === baseWidth ? '0' : '1');
    }
    components.push(`fonts:${fontResults.join('')}`);
  } catch {
    components.push('fonts-unavailable');
  }

  // Touch support
  components.push(`touch:${'ontouchstart' in window ? 1 : 0}`);

  // Hardware concurrency (CPU cores)
 components.push(`cores:${navigator.hardwareConcurrency ?? 'unknown'}`);

  // Memory (approximate)
  if ('deviceMemory' in navigator) {
    components.push(`memory:${(navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 'unknown'}`);
  }

  // Platform
  components.push(`platform:${navigator.platform}`);

  // Cookie enabled
  components.push(`cookies:${navigator.cookieEnabled ? 1 : 0}`);

  // Online status (for additional entropy)
  components.push(`online:${navigator.onLine ? 1 : 0}`);

  // Combine and hash
  const fingerprintString = components.join('||');
  return await hashString(fingerprintString);
}

function measureText(text: string, font: string): number {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;
  
  ctx.font = `16px ${font}, monospace`;
  return ctx.measureText(text).width;
}

async function hashString(str: string): Promise<string> {
  // Use SubtleCrypto for hashing if available
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  // Fallback simple hash for older browsers
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}
