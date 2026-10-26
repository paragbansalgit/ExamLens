import dns from "node:dns/promises";
import net from "node:net";

function isPrivateIPv4(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  return a === 10 || a === 127 || a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224;
}

function isPrivateIPv6(ip) {
  const s = ip.toLowerCase();
  return s === "::1" || s === "::" || s.startsWith("fc") || s.startsWith("fd") ||
    /^fe[89ab]/.test(s) || s.startsWith("::ffff:127.") || s.startsWith("::ffff:10.") ||
    s.startsWith("::ffff:192.168.");
}

export async function validatePublicUrl(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch {
    throw Object.assign(new Error("Invalid URL."), { statusCode: 400, publicMessage: "Enter a complete URL beginning with https://." });
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw Object.assign(new Error("Unsupported protocol"), { statusCode: 400, publicMessage: "Only HTTP and HTTPS URLs are supported." });
  }
  if (url.username || url.password) {
    throw Object.assign(new Error("Credentials in URL rejected"), { statusCode: 400, publicMessage: "Do not include credentials in the URL." });
  }
  if (url.port && !["80", "443"].includes(url.port)) {
    throw Object.assign(new Error("Non-standard port rejected"), { statusCode: 400, publicMessage: "URLs using non-standard ports are blocked." });
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw Object.assign(new Error("Local hostname blocked"), { statusCode: 400, publicMessage: "Local and private network addresses are not allowed." });
  }
  if (net.isIP(hostname) === 4 && isPrivateIPv4(hostname)) {
    throw Object.assign(new Error("Private IPv4 blocked"), { statusCode: 400, publicMessage: "Local and private network addresses are not allowed." });
  }
  if (net.isIP(hostname) === 6 && isPrivateIPv6(hostname)) {
    throw Object.assign(new Error("Private IPv6 blocked"), { statusCode: 400, publicMessage: "Local and private network addresses are not allowed." });
  }

  const allowlist = (process.env.ALLOWED_HOSTS || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
  if (allowlist.length && !allowlist.some(host => hostname === host || hostname.endsWith(`.${host}`))) {
    throw Object.assign(new Error("Host not allowlisted"), { statusCode: 400, publicMessage: "This hostname is not in the configured official-host allowlist." });
  }

  // Resolve hostnames and reject private/reserved answers. Re-check redirects in the fetch loop.
  if (!net.isIP(hostname)) {
    let records;
    try { records = await dns.lookup(hostname, { all: true, verbatim: true }); } catch {
      throw Object.assign(new Error("DNS lookup failed"), { statusCode: 400, publicMessage: "The hostname could not be resolved." });
    }
    if (!records.length || records.some(r => (net.isIP(r.address) === 4 && isPrivateIPv4(r.address)) ||
      (net.isIP(r.address) === 6 && isPrivateIPv6(r.address)))) {
      throw Object.assign(new Error("Private DNS result blocked"), { statusCode: 400, publicMessage: "The hostname resolves to a private or reserved address." });
    }
  }
  return url;
}
