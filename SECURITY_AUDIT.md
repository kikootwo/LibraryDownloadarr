# PlexDownloadarr Security Audit Report

**Date:** November 7, 2025
**Auditor:** Claude (AI Security Analyst)
**Application:** PlexDownloadarr v1.0.0
**Repository:** kikootwo/PlexDownloadarr
**Branch:** claude/plexrip-security-audit-011CUtpLoqDK9qRwyt3ZV8AJ

---

## Executive Summary

### Overall Security Posture: **MEDIUM-HIGH RISK**

PlexDownloadarr is a well-architected application with several security best practices implemented, but it contains **critical and high-severity vulnerabilities** that must be addressed before public deployment.

### Top 5 Most Critical Vulnerabilities

1. **CRITICAL**: Vulnerable npm dependencies with known CVEs (form-data, request, xml2js)
2. **HIGH**: Weak cryptographic randomness in session token generation
3. **HIGH**: Missing CSRF protection on state-changing operations
4. **HIGH**: Insufficient rate limiting (10,000 requests per 15 minutes)
5. **MEDIUM**: Container running as root user without security constraints

### Recommended Immediate Actions

1. **URGENT**: Update or replace the `plex-api` dependency (contains 7 vulnerable transitive dependencies)
2. **URGENT**: Implement cryptographically secure session token generation
3. **URGENT**: Add CSRF protection to all state-changing operations
4. **HIGH**: Reduce rate limits and add per-endpoint limits
5. **HIGH**: Configure container to run as non-root user

---

## Detailed Findings

### 1. CRITICAL: Vulnerable npm Dependencies

**Severity:** CRITICAL
**Category:** A06:2021 – Vulnerable and Outdated Components

**Backend Vulnerabilities:**
- `form-data < 2.5.4` - Unsafe random function (CRITICAL)
- `request` - Server-Side Request Forgery, CVSS 6.1
- `tough-cookie < 4.1.3` - Prototype Pollution, CVSS 6.5
- `xml2js` - Prototype Pollution

**Frontend Vulnerabilities:**
- `esbuild <= 0.24.2` - Development server vulnerability (MODERATE)

**Location:**
- backend/package.json:32
- frontend/package.json:31

**Remediation:**
```bash
# Backend: Replace plex-api with direct axios implementation
cd backend
npm uninstall plex-api
# Refactor plexService.ts to use axios directly

# Frontend: Update Vite
cd frontend
npm install vite@^6.0.0
```

---

### 2. HIGH: Weak Cryptographic Session Token Generation

**Severity:** HIGH
**Category:** A02:2021 – Cryptographic Failures

**Description:** Session tokens generated using `Math.random()` instead of cryptographically secure random.

**Location:** backend/src/models/database.ts:367-369

**Vulnerable Code:**
```typescript
private generateToken(): string {
  // ❌ Math.random() is NOT cryptographically secure
  return `${Math.random().toString(36).substr(2)}${Math.random().toString(36).substr(2)}${Date.now().toString(36)}`;
}
```

**Impact:**
- Attackers may predict session tokens
- Session hijacking risk increased
- Only ~2^50 possible tokens vs 2^256 with crypto.randomBytes()

**Remediation:**
```typescript
import crypto from 'crypto';

private generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

private generateId(): string {
  return crypto.randomBytes(16).toString('hex');
}
```

---

### 3. HIGH: Missing CSRF Protection

**Severity:** HIGH
**Category:** A04:2021 – Insecure Design

**Description:** No CSRF tokens on state-changing operations.

**Impact:**
- Attackers can craft malicious pages that trigger unwanted actions
- Could initiate downloads, change settings, modify passwords
- Particularly dangerous for admin functions

**Affected Endpoints:**
- POST `/api/auth/login`
- POST `/api/auth/logout`
- POST `/api/auth/change-password`
- PUT `/api/settings`
- All download endpoints

**Remediation:**
```bash
npm install csurf cookie-parser
```

```typescript
import csrf from 'csurf';
import cookieParser from 'cookie-parser';

app.use(cookieParser());

const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
});

app.use('/api/auth', csrfProtection);
app.use('/api/settings', csrfProtection);

app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});
```

---

### 4. HIGH: Insufficient Rate Limiting

**Severity:** HIGH
**Category:** A05:2021 – Security Misconfiguration

**Description:** Global rate limit of 10,000 requests per 15 minutes is far too permissive.

**Location:** backend/src/config/index.ts:23-26

**Current Configuration:**
```typescript
rateLimit: {
  windowMs: 15 * 60 * 1000,
  max: 10000, // ❌ Far too high
}
```

**Impact:**
- DoS attacks possible
- Brute force attacks not prevented
- No download throttling per user
- Data exfiltration not limited

**Remediation:**
```typescript
// Global rate limit
rateLimit: {
  windowMs: 15 * 60 * 1000,
  max: 100, // Much more reasonable
}

// Add download-specific limit
import rateLimit from 'express-rate-limit';

const downloadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10, // Max 10 downloads per minute
});

router.get('/:ratingKey/download', authMiddleware, downloadLimiter, async (req, res) => {
  // Download logic
});
```

---

### 5. MEDIUM: SSRF via Plex URL Configuration

**Severity:** MEDIUM
**Category:** A10:2021 – Server-Side Request Forgery

**Description:** Admin can set Plex URL to arbitrary internal services, enabling network scanning.

**Location:** backend/src/routes/settings.ts:35-81

**Impact:**
- Internal network scanning
- Access to cloud metadata endpoints (AWS, GCP, Azure)
- Potential credential exposure

**Remediation:**
```typescript
import { URL } from 'url';

const validatePlexUrl = (urlString: string): boolean => {
  try {
    const url = new URL(urlString);

    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }

    const hostname = url.hostname;
    const privateIPRanges = [
      /^127\./, // Loopback
      /^10\./, // Private class A
      /^172\.(1[6-9]|2[0-9]|3[01])\./, // Private class B
      /^192\.168\./, // Private class C
      /^169\.254\./, // Link-local
      /^::1$/, /^fe80:/i, /^fc00:/i, // IPv6 private
      /^localhost$/i,
    ];

    for (const pattern of privateIPRanges) {
      if (pattern.test(hostname)) return false;
    }

    return true;
  } catch {
    return false;
  }
};

router.put('/', authMiddleware, adminMiddleware, async (req, res) => {
  const { plexUrl } = req.body;

  if (plexUrl && !validatePlexUrl(plexUrl)) {
    return res.status(400).json({
      error: 'Invalid Plex URL. Only public HTTP/HTTPS URLs allowed.'
    });
  }
  // Continue...
});
```

---

### 6. MEDIUM: Plex Tokens Stored in Plaintext

**Severity:** MEDIUM
**Category:** A02:2021 – Cryptographic Failures

**Description:** Plex authentication tokens stored unencrypted in SQLite database.

**Location:** backend/src/models/database.ts:79, 199

**Impact:**
- Database compromise exposes all user tokens
- Tokens can access Plex servers
- No defense in depth

**Remediation:**
```typescript
import crypto from 'crypto';

class DatabaseService {
  private encryptionKey: Buffer;

  constructor(dbPath: string) {
    const secret = process.env.ENCRYPTION_SECRET;
    if (!secret) throw new Error('ENCRYPTION_SECRET required');
    this.encryptionKey = crypto.scryptSync(secret, 'salt', 32);
  }

  private encryptToken(token: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  private decryptToken(encrypted: string): string {
    const buffer = Buffer.from(encrypted, 'base64');
    const iv = buffer.slice(0, 16);
    const authTag = buffer.slice(16, 32);
    const encryptedData = buffer.slice(32);

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encryptedData) + decipher.final('utf8');
  }
}
```

---

### 7. MEDIUM: Container Running as Root

**Severity:** MEDIUM
**Category:** Security Misconfiguration

**Description:** Docker container runs as root user without security constraints.

**Location:** Dockerfile:32-62

**Impact:**
- Container compromise → root privileges
- Easier container escape
- Violates least privilege

**Remediation:**
```dockerfile
FROM node:20-alpine

RUN addgroup -g 1001 -S plexdownloadarr && \
    adduser -u 1001 -S plexdownloadarr -G plexdownloadarr

WORKDIR /app

# ... build steps ...

RUN mkdir -p /app/data /app/logs && \
    chown -R plexdownloadarr:plexdownloadarr /app

USER plexdownloadarr

CMD ["node", "dist/index.js"]
```

**docker-compose.yml:**
```yaml
services:
  plexdownloadarr:
    user: "1001:1001"
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    read_only: true
    tmpfs:
      - /tmp
```

---

### 8. MEDIUM: Weak Password Requirements

**Severity:** MEDIUM
**Category:** A07:2021 – Identification and Authentication Failures

**Description:** Minimum password length only 6 characters, no complexity requirements.

**Location:** backend/src/routes/auth.ts:242-244

**Remediation:**
```typescript
if (newPassword.length < 12) {
  return res.status(400).json({
    error: 'Password must be at least 12 characters'
  });
}

const hasUppercase = /[A-Z]/.test(newPassword);
const hasLowercase = /[a-z]/.test(newPassword);
const hasNumber = /[0-9]/.test(newPassword);
const hasSpecial = /[!@#$%^&*]/.test(newPassword);

if (!(hasUppercase && hasLowercase && hasNumber && hasSpecial)) {
  return res.status(400).json({
    error: 'Password must contain uppercase, lowercase, number, and special character'
  });
}
```

---

### 9. MEDIUM: Missing Brute Force Protection

**Severity:** MEDIUM
**Category:** A07:2021 – Identification and Authentication Failures

**Description:** No account lockout or rate limiting on failed login attempts.

**Location:** backend/src/routes/auth.ts:64-100

**Remediation:**
```typescript
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();

router.post('/login', async (req, res) => {
  const { username } = req.body;
  const attempts = loginAttempts.get(username);

  if (attempts && attempts.count >= 5) {
    const timeSince = Date.now() - attempts.lastAttempt;
    if (timeSince < 15 * 60 * 1000) {
      return res.status(429).json({
        error: 'Too many login attempts. Try again in 15 minutes.'
      });
    }
  }

  // ... existing login logic ...

  if (!isValid) {
    loginAttempts.set(username, {
      count: (attempts?.count || 0) + 1,
      lastAttempt: Date.now()
    });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  loginAttempts.delete(username);
  // ... success ...
});
```

---

### 10. LOW: Security Headers Misconfiguration

**Severity:** LOW-MEDIUM
**Category:** A05:2021 – Security Misconfiguration

**Description:** Content Security Policy disabled, CORS allows all origins.

**Location:**
- backend/src/index.ts:28 (CSP disabled)
- backend/src/config/index.ts:20 (CORS: '*')

**Remediation:**
```typescript
// config/index.ts
cors: {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
},

// index.ts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: "deny" },
  noSniff: true,
}));
```

---

## Additional Findings

### Positive Security Practices ✅

1. **SQL Injection Protection**: All queries use parameterized statements
2. **No XSS Vectors**: React escapes by default, no dangerouslySetInnerHTML usage
3. **Password Hashing**: bcrypt with 10 rounds
4. **Authentication Required**: All endpoints (except setup/health) require auth
5. **Admin Middleware**: Proper role-based access control
6. **Audit Logging**: Download activity logged
7. **Session Expiration**: 24-hour session timeout
8. **Path Traversal Protection**: Indirect via Plex API (no direct filesystem access)
9. **Multi-stage Docker Build**: Reduces attack surface
10. **Package Lock Files**: Committed for reproducible builds

---

## Risk Assessment by Attack Scenario

### Scenario 1: External Attacker (No Credentials)
**Risk:** ⚠️ MEDIUM (due to vulnerable dependencies)
- ✅ Cannot access content without authentication
- ✅ Setup only available if no admin exists
- ❌ Could exploit npm dependency CVEs

### Scenario 2: Authenticated User (Malicious)
**Risk:** ⚠️ MEDIUM
- ✅ Cannot access other users' downloads
- ✅ Cannot access admin functions
- ⚠️ Could enumerate media via brute force (weak rate limit)
- ⚠️ Could initiate mass downloads

### Scenario 3: Compromised User Account
**Risk:** ⚠️ HIGH
- ⚠️ Session valid 24 hours
- ⚠️ No session revocation mechanism
- ⚠️ Could exfiltrate accessible library

### Scenario 4: Compromised Admin Account
**Risk:** ⚠️ CRITICAL
- ❌ Can perform SSRF attacks via Plex URL
- ❌ Can view all users' activity
- ❌ Can access application logs
- ⚠️ Could scan internal network

### Scenario 5: Container Escape
**Risk:** ⚠️ MEDIUM
- ⚠️ Running as root increases escape risk
- ⚠️ Could access mounted volumes
- ✅ No Docker socket access
- ⚠️ Could access other containers on network

---

## OWASP Top 10 (2021) Compliance

- [⚠️] **A01: Broken Access Control** - Missing CSRF
- [❌] **A02: Cryptographic Failures** - Weak tokens, plaintext storage
- [✅] **A03: Injection** - Parameterized queries
- [⚠️] **A04: Insecure Design** - Missing CSRF, weak limits
- [⚠️] **A05: Security Misconfiguration** - CSP disabled, permissive CORS
- [❌] **A06: Vulnerable Components** - Multiple CVEs
- [⚠️] **A07: Authentication Failures** - Weak passwords, no brute force protection
- [✅] **A08: Software Integrity** - Lock files committed
- [⚠️] **A09: Logging & Monitoring** - Sensitive data in logs
- [⚠️] **A10: SSRF** - Unvalidated Plex URL

**Overall:** 2/10 Pass, 8/10 Needs Improvement

---

## Prioritized Remediation Roadmap

### Phase 1: Critical Fixes (MUST DO BEFORE RELEASE)

1. ✅ **Update vulnerable dependencies** (1-2 days)
   - Replace plex-api or update all transitive deps
   - Update vite to 6.x

2. ✅ **Fix cryptographic weaknesses** (4 hours)
   - Use crypto.randomBytes() for tokens
   - Implement token encryption at rest

3. ✅ **Add CSRF protection** (4 hours)
   - Install csurf middleware
   - Update frontend to include CSRF tokens

4. ✅ **Fix rate limiting** (2 hours)
   - Reduce global limit to 100
   - Add per-endpoint limits

5. ✅ **Implement SSRF protection** (2 hours)
   - Validate Plex URLs
   - Block private IP ranges

**Estimated Time:** 3-4 days

### Phase 2: High-Priority Enhancements (SHOULD DO)

6. **Container hardening** (2 hours)
   - Run as non-root user
   - Add security options

7. **Brute force protection** (2 hours)
   - Login attempt tracking
   - Account lockout

8. **Password requirements** (1 hour)
   - Increase minimum to 12 chars
   - Add complexity checks

9. **Security headers** (2 hours)
   - Configure CSP properly
   - Fix CORS settings

**Estimated Time:** 1-2 days

### Phase 3: Best Practices (RECOMMENDED)

10. **Per-user download limits** (4 hours)
11. **Log sanitization** (2 hours)
12. **OAuth state parameter** (2 hours)
13. **Session revocation** (3 hours)
14. **Security monitoring** (1 day)

**Estimated Time:** 2-3 days

---

## Testing Recommendations

### Security Test Suite

```bash
# 1. Dependency scanning
cd backend && npm audit --audit-level=moderate
cd frontend && npm audit --audit-level=moderate

# 2. Container security
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image plexdownloadarr:latest

# 3. Static analysis
npx eslint . --ext .ts,.tsx
npx semgrep --config=auto .

# 4. OWASP ZAP scan
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t http://localhost:5069
```

### Manual Security Tests

- [ ] CSRF attack simulation
- [ ] Session token entropy analysis
- [ ] SSRF via Plex URL setting
- [ ] Brute force login attempts
- [ ] Rate limit bypass attempts
- [ ] SQL injection in all parameters
- [ ] XSS in search queries
- [ ] Privilege escalation attempts
- [ ] Container escape testing
- [ ] Download flood DoS

---

## Conclusion

PlexDownloadarr demonstrates good architectural security practices but has **critical implementation gaps** that make it unsuitable for public internet deployment in its current state.

### Final Recommendation

**🚨 DO NOT DEPLOY TO PUBLIC INTERNET** until Phase 1 (Critical Fixes) are completed.

With all Phase 1 and Phase 2 fixes applied, the application would be suitable for:
- Personal use
- Small team deployment (5-20 users)
- Trusted network deployment

For larger scale or untrusted network deployment, additional hardening is required:
- Web Application Firewall (WAF)
- Intrusion Detection System (IDS)
- Professional penetration testing
- Security incident response plan

### Strengths

- Well-architected with security in mind
- Good separation of concerns
- Proper authentication/authorization framework
- No direct filesystem access (via Plex API)
- Parameterized SQL queries

### Weaknesses

- Vulnerable third-party dependencies
- Weak cryptographic practices
- Missing web application security basics (CSRF, rate limiting)
- Container security gaps
- Insufficient input validation

**Overall Assessment:** With remediation, this can be a secure application. The codebase shows security awareness, but execution needs improvement.

---

**Report prepared by:** Claude (AI Security Analyst)
**Date:** November 7, 2025
**Version:** 1.0

For questions or clarifications, please open a GitHub issue.
