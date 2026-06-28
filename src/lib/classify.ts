// src/lib/classify.ts
//
// Pure, deterministic, rule-based commit classification.
// No LLM calls — never. An honest "unclassified" is better than a hallucinated tag.
//
// DEPARTMENT: folder-prefix rules (per file)
// MODULE: 4-tier fallback per file —
//   1. folder path pattern  (strongest)
//   2. extracted route paths
//   3. keyword scan in file content / diff
//   4. commit message keywords  (weakest)
//   5. unclassified            (no guess, no LLM)

// ── Public types ──────────────────────────────────────────────────────────────

export type Department  = 'frontend' | 'backend' | 'data' | 'unclassified';
export type ModuleMethod = 'folder' | 'route' | 'keyword' | 'commit_message' | 'unclassified';

export interface ChangedFileInput {
  filename:        string;
  content_after?:  string;
  patch?:          string;
  extractedRoutes?: string[]; // optional pre-extracted API route paths
}

export interface FileClassification {
  filename:      string;
  department:    Department;
  module:        string;        // e.g. "payment", "auth", "unclassified"
  module_method: ModuleMethod;
}

export interface CommitClassification {
  department:                   Department[];    // unique, ordered set
  module:                       string[];        // unique, ordered set
  module_classification_method: ModuleMethod[];  // parallel to module[]
  file_classifications:         FileClassification[];
}

// ── STEP 1: Department rules (folder prefix → department) ─────────────────────

const DEPT_RULES: Array<{ re: RegExp; dept: Department }> = [
  { re: /^(backend|api|server|services?|routes?|controllers?|handlers?|middleware)\//i, dept: 'backend'  },
  { re: /^(frontend|src|components?|pages?|app|lib|hooks?|styles?|views?|ui)\//i,       dept: 'frontend' },
  { re: /^(data|pipeline|ml|models?|etl|migrations?|seeds?|fixtures?|analytics)\//i,   dept: 'data'     },
];

function classifyDepartment(filename: string): Department {
  for (const { re, dept } of DEPT_RULES) {
    if (re.test(filename)) return dept;
  }
  return 'unclassified';
}

// ── STEP 2a: Module — folder path pattern ─────────────────────────────────────

const MODULE_FOLDER_RULES: Array<{ re: RegExp; module: string }> = [
  { re: /\/(payment|payments|billing|checkout|stripe|invoice|invoices|subscription|subscriptions)(\/|$)/i, module: 'payment'      },
  { re: /\/(auth|authentication|login|logout|signup|register|oauth|sso|mfa|otp)(\/|$)/i,                  module: 'auth'         },
  { re: /\/(user|users|profile|profiles|account|accounts|member|members)(\/|$)/i,                          module: 'user'         },
  { re: /\/(dashboard|analytics|metric|metrics|report|reports|chart|charts|kpi)(\/|$)/i,                   module: 'dashboard'    },
  { re: /\/(notification|notifications|email|mailer|sms|push|alert|alerts)(\/|$)/i,                        module: 'notification' },
  { re: /\/(search|query|queries|elasticsearch|algolia|index|indexes|indices)(\/|$)/i,                      module: 'search'       },
  { re: /\/(upload|uploads|media|storage|file|files|asset|assets|attachment|attachments)(\/|$)/i,           module: 'media'        },
  { re: /\/(admin|administration|backoffice|back-office)(\/|$)/i,                                           module: 'admin'        },
  { re: /\/(setting|settings|config|configuration|preference|preferences)(\/|$)/i,                         module: 'settings'     },
  { re: /\/(cart|order|orders|basket|fulfillment|shipping|delivery)(\/|$)/i,                               module: 'orders'       },
  { re: /\/(webhook|webhooks)(\/|$)/i,                                                                     module: 'webhook'      },
  { re: /\/(repository|repositories|repo|repos)(\/|$)/i,                                                   module: 'repository'   },
  { re: /\/(commit|commits|diff|diffs)(\/|$)/i,                                                            module: 'commits'      },
  { re: /\/(team|teams|organisation|organization|org|workspace)(\/|$)/i,                                   module: 'team'         },
  { re: /\/(role|roles|permission|permissions|acl|rbac)(\/|$)/i,                                           module: 'permissions'  },
  { re: /\/(integration|integrations|plugin|plugins)(\/|$)/i,                                              module: 'integrations' },
  { re: /\/(product|products|catalog|catalogue|sku|inventory)(\/|$)/i,                                     module: 'product'      },
  { re: /\/(comment|comments|review|reviews|rating|ratings)(\/|$)/i,                                       module: 'reviews'      },
];

function classifyModuleByFolder(filename: string): string | null {
  for (const { re, module } of MODULE_FOLDER_RULES) {
    if (re.test(filename)) return module;
  }
  return null;
}

// ── STEP 2b: Module — extracted route path matching ───────────────────────────

function classifyModuleByRoutes(routes: string[]): string | null {
  for (const route of routes) {
    // Try folder rules against the route path (appending '/' to help boundary match)
    const m = classifyModuleByFolder(route + '/');
    if (m) return m;
    // Also do a simple keyword pass over the route string
    const lower = route.toLowerCase();
    for (const { re, module } of MODULE_FOLDER_RULES) {
      if (re.test(lower)) return module;
    }
  }
  return null;
}

// ── STEP 2c: Module — keyword scan in file content / diff ─────────────────────
//
// We use COMPOUND identifiers (camelCase / snake_case combos) as primary signals
// so we don't false-positive on short common words like "user" appearing in unrelated code.
// Simple short words are listed but require a word-boundary match.

type KwEntry = { word: string; boundary: boolean };

const MODULE_CONTENT_KEYWORDS: Record<string, KwEntry[]> = {
  payment:      [
    { word: 'payment',        boundary: true  },
    { word: 'charge',         boundary: true  },
    { word: 'invoice',        boundary: true  },
    { word: 'transaction',    boundary: true  },
    { word: 'checkout',       boundary: true  },
    { word: 'billing',        boundary: true  },
    { word: 'stripe',         boundary: true  },
    { word: 'paypal',         boundary: true  },
    { word: 'refund',         boundary: true  },
    { word: 'subscription',   boundary: true  },
    { word: 'createCharge',   boundary: false },
    { word: 'processPayment', boundary: false },
  ],
  auth:         [
    { word: 'authenticate',   boundary: true  },
    { word: 'authorization',  boundary: true  },
    { word: 'jwtToken',       boundary: false },
    { word: 'accessToken',    boundary: false },
    { word: 'refreshToken',   boundary: false },
    { word: 'sessionToken',   boundary: false },
    { word: 'bearerToken',    boundary: false },
    { word: 'loginUser',      boundary: false },
    { word: 'logoutUser',     boundary: false },
    { word: 'signupUser',     boundary: false },
    { word: 'hashPassword',   boundary: false },
    { word: 'verifyPassword', boundary: false },
    { word: 'oauthCallback',  boundary: false },
  ],
  user:         [
    { word: 'userProfile',    boundary: false },
    { word: 'userAccount',    boundary: false },
    { word: 'createUser',     boundary: false },
    { word: 'updateUser',     boundary: false },
    { word: 'deleteUser',     boundary: false },
    { word: 'getUserById',    boundary: false },
    { word: 'currentUser',    boundary: false },
    { word: 'userAvatar',     boundary: false },
  ],
  dashboard:    [
    { word: 'dashboard',      boundary: true  },
    { word: 'analytics',      boundary: true  },
    { word: 'kpiWidget',      boundary: false },
    { word: 'metricCard',     boundary: false },
    { word: 'chartData',      boundary: false },
    { word: 'reportBuilder',  boundary: false },
  ],
  notification: [
    { word: 'sendEmail',      boundary: false },
    { word: 'sendNotification', boundary: false },
    { word: 'pushNotification', boundary: false },
    { word: 'emailTemplate',  boundary: false },
    { word: 'notifyUser',     boundary: false },
    { word: 'notification',   boundary: true  },
    { word: 'mailer',         boundary: true  },
  ],
  search:       [
    { word: 'elasticsearch',  boundary: false },
    { word: 'searchQuery',    boundary: false },
    { word: 'searchResult',   boundary: false },
    { word: 'fullTextSearch', boundary: false },
    { word: 'searchIndex',    boundary: false },
    { word: 'algoliaClient',  boundary: false },
  ],
  media:        [
    { word: 'fileUpload',     boundary: false },
    { word: 'imageUpload',    boundary: false },
    { word: 's3Bucket',       boundary: false },
    { word: 'blobStorage',    boundary: false },
    { word: 'assetUrl',       boundary: false },
    { word: 'mediaSource',    boundary: false },
    { word: 'uploadFile',     boundary: false },
  ],
  admin:        [
    { word: 'adminPanel',     boundary: false },
    { word: 'adminRoute',     boundary: false },
    { word: 'superAdmin',     boundary: false },
    { word: 'isAdmin',        boundary: false },
    { word: 'adminUser',      boundary: false },
  ],
  settings:     [
    { word: 'userSettings',   boundary: false },
    { word: 'appConfig',      boundary: false },
    { word: 'updatePreference', boundary: false },
    { word: 'systemConfig',   boundary: false },
    { word: 'configValue',    boundary: false },
  ],
  orders:       [
    { word: 'shoppingCart',   boundary: false },
    { word: 'orderItem',      boundary: false },
    { word: 'placeOrder',     boundary: false },
    { word: 'fulfillOrder',   boundary: false },
    { word: 'shipment',       boundary: true  },
    { word: 'orderStatus',    boundary: false },
  ],
  webhook:      [
    { word: 'webhookPayload', boundary: false },
    { word: 'webhookSecret',  boundary: false },
    { word: 'githubWebhook',  boundary: false },
    { word: 'verifyWebhook',  boundary: false },
  ],
  repository:   [
    { word: 'githubRepo',     boundary: false },
    { word: 'repoFullName',   boundary: false },
    { word: 'fetchCommits',   boundary: false },
    { word: 'connectedRepo',  boundary: false },
  ],
};

function classifyModuleByKeyword(content: string): string | null {
  if (!content) return null;
  // Normalise: lower for simple words, keep original for camelCase compound checks
  const lower = content.toLowerCase();
  const original = content;

  for (const [mod, entries] of Object.entries(MODULE_CONTENT_KEYWORDS)) {
    for (const { word, boundary } of entries) {
      if (boundary) {
        // word-boundary match on lowercased content
        const re = new RegExp(`\\b${word.toLowerCase()}\\b`);
        if (re.test(lower)) return mod;
      } else {
        // Case-insensitive substring on original content (camelCase identifiers)
        if (original.toLowerCase().includes(word.toLowerCase())) return mod;
      }
    }
  }
  return null;
}

// ── STEP 2d: Module — commit message keywords (weakest signal) ────────────────

const COMMIT_MSG_KEYWORDS: Record<string, string[]> = {
  payment:      ['payment', 'billing', 'checkout', 'invoice', 'stripe', 'refund', 'subscription'],
  auth:         ['auth', 'login', 'logout', 'token', 'session', 'signup', 'register', 'password', 'oauth', 'authentication'],
  user:         ['user profile', 'user account', 'user management'],
  dashboard:    ['dashboard', 'analytics', 'metric', 'report', 'chart'],
  notification: ['notification', 'email', 'sms', 'alert', 'mailer'],
  search:       ['search', 'elasticsearch', 'algolia'],
  media:        ['upload', 'media', 'storage', 'image', 'file upload'],
  admin:        ['admin', 'backoffice', 'administration'],
  settings:     ['settings', 'configuration', 'preferences'],
  orders:       ['cart', 'order', 'shipment', 'fulfillment'],
  webhook:      ['webhook'],
  repository:   ['repository', 'repo connection'],
};

function classifyModuleByMessage(message: string): string | null {
  if (!message) return null;
  const lower = message.toLowerCase();
  for (const [mod, keywords] of Object.entries(COMMIT_MSG_KEYWORDS)) {
    for (const kw of keywords) {
      const re = new RegExp(`\\b${kw.replace(' ', '\\s+')}\\b`, 'i');
      if (re.test(lower)) return mod;
    }
  }
  return null;
}

// ── Per-file classification ───────────────────────────────────────────────────

function classifyFile(
  file: ChangedFileInput,
  commitMessage: string,
): FileClassification {
  const department = classifyDepartment(file.filename);

  // Tier 1 — folder path
  const folderMod = classifyModuleByFolder(file.filename);
  if (folderMod) {
    return { filename: file.filename, department, module: folderMod, module_method: 'folder' };
  }

  // Tier 2 — extracted route paths
  if (file.extractedRoutes && file.extractedRoutes.length > 0) {
    const routeMod = classifyModuleByRoutes(file.extractedRoutes);
    if (routeMod) {
      return { filename: file.filename, department, module: routeMod, module_method: 'route' };
    }
  }

  // Tier 3 — keyword scan in file content + diff patch
  const contentToScan = (file.content_after ?? '') + '\n' + (file.patch ?? '');
  if (contentToScan.trim().length > 10) {
    const kwMod = classifyModuleByKeyword(contentToScan);
    if (kwMod) {
      return { filename: file.filename, department, module: kwMod, module_method: 'keyword' };
    }
  }

  // Tier 4 — commit message (weakest)
  const msgMod = classifyModuleByMessage(commitMessage);
  if (msgMod) {
    return { filename: file.filename, department, module: msgMod, module_method: 'commit_message' };
  }

  // No match — honest unclassified, never guess
  return { filename: file.filename, department, module: 'unclassified', module_method: 'unclassified' };
}

// ── Commit-level aggregation ──────────────────────────────────────────────────

export function classifyCommit(
  files: ChangedFileInput[],
  commitMessage: string,
): CommitClassification {
  const fileClassifications = files.map(f => classifyFile(f, commitMessage));

  // Unique departments (preserve insertion order)
  const deptSeen = new Set<Department>();
  const department: Department[] = [];
  for (const fc of fileClassifications) {
    if (!deptSeen.has(fc.department)) {
      deptSeen.add(fc.department);
      department.push(fc.department);
    }
  }
  if (department.length === 0) department.push('unclassified');

  // Unique modules with first-occurrence method
  const moduleSeen = new Map<string, ModuleMethod>();
  for (const fc of fileClassifications) {
    if (!moduleSeen.has(fc.module)) {
      moduleSeen.set(fc.module, fc.module_method);
    }
  }

  // If every file was unclassified, try one last commit-message pass at commit level
  const allUnclassified = Array.from(moduleSeen.keys()).every(m => m === 'unclassified');
  if (allUnclassified) {
    const msgMod = classifyModuleByMessage(commitMessage);
    if (msgMod) {
      moduleSeen.clear();
      moduleSeen.set(msgMod, 'commit_message');
    }
  }

  if (moduleSeen.size === 0) moduleSeen.set('unclassified', 'unclassified');

  const module = Array.from(moduleSeen.keys());
  const module_classification_method = Array.from(moduleSeen.values());

  return { department, module, module_classification_method, file_classifications: fileClassifications };
}
