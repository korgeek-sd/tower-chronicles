import {createHash} from 'node:crypto';

// Production only: the Vite development server needs its own HMR connection.
export function browserPolicy(supabaseUrl, inlineScripts = []) {
 const connections = ["'self'"];
 if (supabaseUrl) {
  const url = new URL(supabaseUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
   throw new Error('Production Supabase URL must be an HTTPS origin');
  }
  connections.push(url.origin, url.origin.replace(/^https:/, 'wss:'));
 }
 const hashes = inlineScripts.map(script => "'sha256-" + createHash('sha256').update(script).digest('base64') + "'");
 return [
  "default-src 'none'", "script-src 'self'" + (hashes.length ? ' ' + hashes.join(' ') : ''),
  "script-src-attr 'none'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:",
  "font-src 'self' data:", "media-src 'self' blob:", 'connect-src ' + connections.join(' '),
  "manifest-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'self'",
 ].join('; ');
}

export function securityMeta(supabaseUrl) {
 return {
  name: 'production-browser-policy', apply: 'build',
  transformIndexHtml: {order: 'post', handler: () => [
   {tag: 'meta', attrs: {'http-equiv': 'Content-Security-Policy', content: browserPolicy(supabaseUrl)}, injectTo: 'head-prepend'},
   {tag: 'meta', attrs: {name: 'referrer', content: 'no-referrer'}, injectTo: 'head-prepend'},
  ]},
 };
}

export function authorizeStandaloneScripts(html) {
 const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]).filter(Boolean);
 const hashes = scripts.map(script => "'sha256-" + createHash('sha256').update(script).digest('base64') + "'");
 return html.replace(/script-src (?:'|&#39;)self(?:'|&#39;)(?=;)/, "script-src 'self' " + hashes.join(' '));
}
