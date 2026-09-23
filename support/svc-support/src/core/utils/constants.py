"""Shared constants for the Support module.

Vendored from svc-tickets (ticket/message/status/sender vocab kept byte-identical
so items stay compatible with the merchant view) and extended with the
support-console-only assignment, team, and staff-session claim constants.
"""

# Ticket types
TICKET_TYPE_TECHNICAL = "TECHNICAL"
TICKET_TYPE_BILLING = "BILLING"
TICKET_TYPE_ACCOUNT = "ACCOUNT"
TICKET_TYPE_FEATURE = "FEATURE"
TICKET_TYPE_GENERAL = "GENERAL"
TICKET_TYPE_OTHER = "OTHER"

VALID_TICKET_TYPES = [
    TICKET_TYPE_TECHNICAL,
    TICKET_TYPE_BILLING,
    TICKET_TYPE_ACCOUNT,
    TICKET_TYPE_FEATURE,
    TICKET_TYPE_GENERAL,
    TICKET_TYPE_OTHER,
]

# Ticket statuses — implemented 7-state enum (R-5), identical to svc-tickets
TICKET_STATUS_OPEN = "OPEN"
TICKET_STATUS_IN_PROGRESS = "IN_PROGRESS"
TICKET_STATUS_PENDING_USER = "PENDING_USER"
TICKET_STATUS_PENDING_MERCHANT = "PENDING_MERCHANT"
TICKET_STATUS_RESOLVED = "RESOLVED"
TICKET_STATUS_CLOSED = "CLOSED"
TICKET_STATUS_CANCELLED = "CANCELLED"

VALID_TICKET_STATUSES = [
    TICKET_STATUS_OPEN,
    TICKET_STATUS_IN_PROGRESS,
    TICKET_STATUS_PENDING_USER,
    TICKET_STATUS_PENDING_MERCHANT,
    TICKET_STATUS_RESOLVED,
    TICKET_STATUS_CLOSED,
    TICKET_STATUS_CANCELLED,
]

# Status transition state machine (reused verbatim from svc-tickets)
STATUS_TRANSITIONS = {
    TICKET_STATUS_OPEN: [
        TICKET_STATUS_IN_PROGRESS,
        TICKET_STATUS_CANCELLED,
    ],
    TICKET_STATUS_IN_PROGRESS: [
        TICKET_STATUS_PENDING_USER,
        TICKET_STATUS_PENDING_MERCHANT,
        TICKET_STATUS_RESOLVED,
        TICKET_STATUS_CANCELLED,
    ],
    TICKET_STATUS_PENDING_USER: [
        TICKET_STATUS_IN_PROGRESS,
        TICKET_STATUS_RESOLVED,
        TICKET_STATUS_CANCELLED,
    ],
    TICKET_STATUS_PENDING_MERCHANT: [
        TICKET_STATUS_IN_PROGRESS,
        TICKET_STATUS_RESOLVED,
        TICKET_STATUS_CANCELLED,
    ],
    TICKET_STATUS_RESOLVED: [
        TICKET_STATUS_CLOSED,
        TICKET_STATUS_IN_PROGRESS,  # Reopen
    ],
    TICKET_STATUS_CLOSED: [],  # Terminal state
    TICKET_STATUS_CANCELLED: [],  # Terminal state
}

# Ticket priorities
PRIORITY_LOW = "LOW"
PRIORITY_MEDIUM = "MEDIUM"
PRIORITY_HIGH = "HIGH"
PRIORITY_URGENT = "URGENT"

VALID_PRIORITIES = [
    PRIORITY_LOW,
    PRIORITY_MEDIUM,
    PRIORITY_HIGH,
    PRIORITY_URGENT,
]

# Sender types
SENDER_TYPE_USER = "USER"
SENDER_TYPE_SUPPORT = "SUPPORT"
SENDER_TYPE_SYSTEM = "SYSTEM"

VALID_SENDER_TYPES = [
    SENDER_TYPE_USER,
    SENDER_TYPE_SUPPORT,
    SENDER_TYPE_SYSTEM,
]

# Allowed file types for attachments
ALLOWED_FILE_TYPES = [
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/zip",
    "application/x-rar-compressed",
]

# GSI names
GSI1_NAME = "GSI1"
GSI2_NAME = "GSI2"

# Entity types
ENTITY_TICKET = "TICKET"
ENTITY_MESSAGE = "MESSAGE"

# PK/SK prefixes (platform table)
PK_TICKET = "TICKET#"
PK_MESSAGE = "MESSAGE#"
PK_MERCHANT = "MERCHANT#"

# GSI1 key prefixes (platform table - token/session lookup)
GSI1_TOKEN = "TOKEN#"

# GSI2 key prefix (entity-type listing → cross-merchant ticket queue)
GSI2_ENTITY = "ENTITY#"

# System attributes to strip from DynamoDB items
SYSTEM_ATTRS = {'PK', 'SK', 'entityType', 'GSI1PK', 'GSI1SK', 'GSI2PK', 'GSI2SK'}

# ── Support-console extensions (NEW — not present in svc-tickets) ──────────────

# Staff-session claim discriminator (see backend-to-lead-support-staff-auth-design §1).
# A session minted for a support agent carries sessionType == "STAFF"; legacy /
# merchant sessions have sessionType == "MERCHANT" (or the field is absent, which
# is treated as MERCHANT). svc-support authorizes only STAFF sessions.
SESSION_TYPE_STAFF = "STAFF"
SESSION_TYPE_MERCHANT = "MERCHANT"

# Staff teams (single team per agent for MVP — D4). Drives the default assignee
# team on assignTicket and "my team" scoping.
STAFF_TEAM_SUPPORT = "SUPPORT"
STAFF_TEAM_SALES = "SALES"
STAFF_TEAM_FINANCE = "FINANCE"

VALID_STAFF_TEAMS = [
    STAFF_TEAM_SUPPORT,
    STAFF_TEAM_SALES,
    STAFF_TEAM_FINANCE,
]

# Permission resource an agent's session must carry to use the console (coarse
# RBAC — D1: reuse existing VIEW/ADD/EDIT/APPROVE action vocab on this resource).
PERMISSION_RESOURCE_SUPPORT_TICKETS = "SUPPORT_TICKETS"

# Sparse assignment attributes written onto a ticket row via the dynamic
# update() (nullable columns in Postgres — no migration for a new assign).
ATTR_ASSIGNEE_ID = "assigneeId"
ATTR_ASSIGNEE_NAME = "assigneeName"
ATTR_ASSIGNED_TEAM = "assignedTeam"
ATTR_ASSIGNED_AT = "assignedAt"

# ── Auth reuse (Option B — DynamoDB→Postgres re-platform) ──────────────────────
# svc-support authorizes staff by the mz-ai-assistant JWT `role` claim (roles
# defined in the mz-ai server's config/roles.yaml). These are the support-console
# roles; an admin (`*` permission) is also allowed. Replaces the old
# sessionType==STAFF + SUPPORT_TICKETS opaque-token gate.
SUPPORT_ROLE_AGENT = "support_agent"
SUPPORT_ROLE_MANAGER = "support_manager"
SUPPORT_CONSOLE_ROLES = {SUPPORT_ROLE_AGENT, SUPPORT_ROLE_MANAGER}
