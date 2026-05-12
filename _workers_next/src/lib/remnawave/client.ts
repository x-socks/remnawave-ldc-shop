/**
 * Web Remnawave identity scheme
 * --------------------------------
 * The Telegram bot provisions usernames as `<sanitized_tg_username>_<telegram_id>`.
 * Web users do not have `telegram_id`; linux.do OIDC gives an immutable numeric
 * `sub` and a mutable username. For the web surface:
 *
 * - Remnawave `username`: `linuxdo_<sub>_<sanitized_username>`
 * - Remnawave `externalId`: `linuxdo_<sub>`
 *
 * `externalId` is the canonical immutable lookup key. The username keeps the
 * immutable id first and the human-readable username second so a future v2
 * unification can reconcile web users without trusting mutable display names.
 */

const REQUEST_TIMEOUT_MS = 30_000;
const USERS_PAGE_SIZE = 250;
const BYTES_PER_GIB = 1_073_741_824;
const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type RemnawaveTier = "LV0" | "LV1" | "LV2";

export type CreateOrUpdateUserArgs = {
    linuxdoSub: string;
    linuxdoUsername: string;
    trafficLimitBytes: number;
    daysToAdd: number;
    isTrial: false;
    tier: RemnawaveTier;
};

export type RemnawaveUser = {
    uuid: string;
    username: string;
    subscriptionUrl: string;
    expireAt: string;
    status?: string;
    trafficLimitBytes?: number;
    externalId?: string;
};

type ApiResponse<T> = {
    response: T;
};

type GetAllUsersResponse = {
    users: RemnawaveUser[];
    total: number;
};

type ClientOptions = {
    baseUrl: string;
    token: string;
    externalSquadUuid?: string;
};

type ApiErrorResponse = {
    message?: string;
    errorCode?: string;
};

export class RemnawaveApiError extends Error {
    readonly status: number;
    readonly method: string;
    readonly path: string;
    readonly errorCode?: string;
    readonly responseBody: string;

    constructor(args: {
        status: number;
        method: string;
        path: string;
        message: string;
        errorCode?: string;
        responseBody: string;
    }) {
        super(args.message);
        this.name = "RemnawaveApiError";
        this.status = args.status;
        this.method = args.method;
        this.path = args.path;
        this.errorCode = args.errorCode;
        this.responseBody = args.responseBody;
    }
}

export class RemnawaveConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "RemnawaveConfigError";
    }
}

export class RemnawaveClient {
    private readonly baseUrl: string;
    private readonly token: string;
    private readonly externalSquadUuid?: string;

    constructor({ baseUrl, token, externalSquadUuid }: ClientOptions) {
        this.baseUrl = baseUrl.replace(/\/+$/, "");
        this.token = token;
        this.externalSquadUuid = optionalUuid(externalSquadUuid ?? process.env.EXTERNAL_SQUAD_UUID, "EXTERNAL_SQUAD_UUID");
    }

    async createOrUpdateUser(args: CreateOrUpdateUserArgs): Promise<RemnawaveUser> {
        if (args.isTrial !== false) {
            throw new RemnawaveConfigError("web Remnawave client does not support trial users");
        }

        const externalId = externalIdForLinuxdoSub(args.linuxdoSub);
        const existingUser = await this.getUserByExternalId(externalId);

        if (!existingUser) {
            return this.createUser(args, externalId);
        }

        return this.updateUser(existingUser, args, externalId);
    }

    private async getUserByExternalId(externalId: string): Promise<RemnawaveUser | null> {
        for (let start = 0; ; start += USERS_PAGE_SIZE) {
            const path = `/api/users?size=${USERS_PAGE_SIZE}&start=${start}`;
            const page = await this.doJSON<ApiResponse<GetAllUsersResponse>>("GET", path);
            const users = page.response.users;
            const found = users.find((user) => user.externalId === externalId || usernameMatchesExternalId(user.username, externalId));
            if (found) return found;
            if (users.length < USERS_PAGE_SIZE) return null;
        }
    }

    private async createUser(args: CreateOrUpdateUserArgs, externalId: string): Promise<RemnawaveUser> {
        const expireAt = addDays(new Date(), args.daysToAdd).toISOString();
        const body = compactObject({
            username: usernameForLinuxdo(args.linuxdoSub, args.linuxdoUsername),
            externalId,
            activeInternalSquads: nonEmptyArray(tierSquadUuids(args.tier)),
            status: "ACTIVE",
            expireAt,
            trafficLimitStrategy: normalizeStrategy(process.env.TRAFFIC_LIMIT_RESET_STRATEGY),
            trafficLimitBytes: args.trafficLimitBytes,
            externalSquadUuid: this.externalSquadUuid,
            tag: nonEmptyString(process.env.REMNAWAVE_TAG),
            description: nonEmptyString(args.linuxdoUsername),
        });

        const resp = await this.doJSON<ApiResponse<RemnawaveUser>>("POST", "/api/users", body);
        return resp.response;
    }

    private async updateUser(existingUser: RemnawaveUser, args: CreateOrUpdateUserArgs, externalId: string): Promise<RemnawaveUser> {
        const newExpire = getNewExpire(args.daysToAdd, existingUser.expireAt).toISOString();
        const body = compactObject({
            uuid: existingUser.uuid,
            externalId,
            expireAt: newExpire,
            status: "ACTIVE",
            trafficLimitBytes: args.trafficLimitBytes,
            activeInternalSquads: nonEmptyArray(tierSquadUuids(args.tier)),
            trafficLimitStrategy: normalizeStrategy(process.env.TRAFFIC_LIMIT_RESET_STRATEGY),
            externalSquadUuid: this.externalSquadUuid,
            tag: nonEmptyString(process.env.REMNAWAVE_TAG),
            description: nonEmptyString(args.linuxdoUsername),
        });

        const resp = await this.doJSON<ApiResponse<RemnawaveUser>>("PATCH", "/api/users", body);
        return resp.response;
    }

    private async doJSON<T>(method: string, path: string, body?: Record<string, unknown>): Promise<T> {
        const resp = await this.doRequest(method, path, body);
        try {
            return JSON.parse(resp) as T;
        } catch (error) {
            throw new Error(`decode response: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async doRequest(method: string, path: string, body?: Record<string, unknown>): Promise<string> {
        const headers: Record<string, string> = {
            ...remnawaveHeadersFromEnv(),
            Authorization: `Bearer ${this.token}`,
        };

        if (shouldForceForwardedHeaders(this.baseUrl)) {
            headers["x-forwarded-for"] = "127.0.0.1";
            headers["x-forwarded-proto"] = "https";
        }

        const init: RequestInit = {
            method,
            headers,
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        };

        if (body !== undefined) {
            headers["Content-Type"] = "application/json";
            init.body = JSON.stringify(body);
        }

        const response = await fetch(`${this.baseUrl}${path}`, init);
        const responseBody = await response.text();

        if (response.status === 404) {
            throw new RemnawaveApiError({
                status: response.status,
                method,
                path,
                message: "not found",
                responseBody,
            });
        }

        if (response.status >= 400) {
            const apiError = parseApiError(responseBody);
            throw new RemnawaveApiError({
                status: response.status,
                method,
                path,
                message: apiError.message
                    ? `API error ${response.status}: ${apiError.message}${apiError.errorCode ? ` (code: ${apiError.errorCode})` : ""}`
                    : `API error ${response.status}: ${responseBody}`,
                errorCode: apiError.errorCode,
                responseBody,
            });
        }

        return responseBody;
    }
}

export function sanitizeLinuxdoUsername(username: string): string {
    let input = username.startsWith("@") ? username.slice(1) : username;
    input = input.toLowerCase();

    let output = "";
    for (const char of input) {
        output += /^[a-z0-9_]$/.test(char) ? char : "_";
    }

    if (output.length > 32) {
        output = output.slice(0, 32);
    }

    return output.replace(/_+$/, "");
}

export function usernameForLinuxdo(linuxdoSub: string, linuxdoUsername: string): string {
    const sanitized = sanitizeLinuxdoUsername(linuxdoUsername);
    return sanitized ? `linuxdo_${linuxdoSub}_${sanitized}` : `linuxdo_${linuxdoSub}`;
}

export function externalIdForLinuxdoSub(linuxdoSub: string): string {
    return `linuxdo_${linuxdoSub}`;
}

function getNewExpire(daysToAdd: number, currentExpire: string): Date {
    const now = new Date();
    const parsed = new Date(currentExpire);
    const current = Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;

    if (daysToAdd <= 0) {
        const adjusted = addDays(current, daysToAdd);
        if (adjusted < now) {
            return addDays(new Date(), 1);
        }
        return adjusted;
    }

    if (current < now || current.getTime() === 0) {
        return addDays(new Date(), daysToAdd);
    }

    return addDays(current, daysToAdd);
}

function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
}

function normalizeStrategy(strategy: string | undefined): string {
    const upper = (strategy ?? "MONTH").toUpperCase();
    return upper === "DAY" || upper === "WEEK" || upper === "NO_RESET" || upper === "MONTH" ? upper : "MONTH";
}

function tierSquadUuids(tier: RemnawaveTier): string[] {
    return parseUuidList(process.env[`${tier}_SQUAD_UUIDS`] ?? "", `${tier}_SQUAD_UUIDS`);
}

function parseUuidList(value: string, key: string): string[] {
    if (!value) return [];
    return value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((uuid) => requireUuid(uuid, key));
}

function optionalUuid(value: string | undefined, key: string): string | undefined {
    const trimmed = value?.trim();
    if (!trimmed || trimmed === NIL_UUID) return undefined;
    return requireUuid(trimmed, key);
}

function requireUuid(value: string, key: string): string {
    if (!UUID_RE.test(value)) {
        throw new RemnawaveConfigError(`invalid UUID in ${key}: ${value}`);
    }
    return value;
}

function nonEmptyArray<T>(value: T[]): T[] | undefined {
    return value.length > 0 ? value : undefined;
}

function nonEmptyString(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}

function compactObject(value: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function parseApiError(body: string): ApiErrorResponse {
    try {
        const parsed = JSON.parse(body) as ApiErrorResponse;
        return {
            message: parsed.message,
            errorCode: parsed.errorCode,
        };
    } catch {
        return {};
    }
}

function shouldForceForwardedHeaders(baseUrl: string): boolean {
    try {
        const host = new URL(baseUrl).hostname;
        return host.startsWith("remnawave") || host === "127.0.0.1" || host === "localhost";
    } catch {
        return false;
    }
}

function remnawaveHeadersFromEnv(): Record<string, string> {
    const raw = process.env.REMNAWAVE_HEADERS;
    if (!raw) return {};

    const headers: Record<string, string> = {};
    for (const pair of raw.split(";")) {
        const [key, ...rest] = pair.trim().split(":");
        const value = rest.join(":").trim();
        if (key.trim() && value) {
            headers[key.trim()] = value;
        }
    }
    return headers;
}

function usernameMatchesExternalId(username: string, externalId: string): boolean {
    return username === externalId || username.startsWith(`${externalId}_`);
}

export const REMNAWAVE_GIB = BYTES_PER_GIB;
