import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    RemnawaveApiError,
    RemnawaveClient,
    REMNAWAVE_GIB,
    sanitizeLinuxdoUsername,
    usernameForLinuxdo,
} from "./client";

const BASE_URL = "https://panel.example.com";
const TOKEN = "test-token";
const EXTERNAL_SQUAD_UUID = "11111111-1111-4111-8111-111111111111";
const LV0_SQUAD_UUID = "22222222-2222-4222-8222-222222222222";
const LV1_SQUAD_UUID = "33333333-3333-4333-8333-333333333333";
const LV2_SQUAD_UUID = "44444444-4444-4444-8444-444444444444";

type FetchCall = Parameters<typeof fetch>;

const userResponse = (user: Record<string, unknown>) => JSON.stringify({ response: user });
const usersResponse = (users: Record<string, unknown>[]) => JSON.stringify({ response: { users, total: users.length } });

function mockFetch(...responses: Response[]) {
    const fetchMock = vi.fn<typeof fetch>();
    for (const response of responses) {
        fetchMock.mockResolvedValueOnce(response);
    }
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

function jsonResponse(body: string, status = 200) {
    return new Response(body, { status });
}

function requestBody(call: FetchCall) {
    return JSON.parse(String(call[1]?.body)) as Record<string, unknown>;
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-12T00:00:00.000Z"));
    process.env.EXTERNAL_SQUAD_UUID = EXTERNAL_SQUAD_UUID;
    process.env.LV0_SQUAD_UUIDS = LV0_SQUAD_UUID;
    process.env.LV1_SQUAD_UUIDS = LV1_SQUAD_UUID;
    process.env.LV2_SQUAD_UUIDS = LV2_SQUAD_UUID;
    delete process.env.TRAFFIC_LIMIT_RESET_STRATEGY;
    delete process.env.REMNAWAVE_HEADERS;
    delete process.env.REMNAWAVE_TAG;
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete process.env.EXTERNAL_SQUAD_UUID;
    delete process.env.LV0_SQUAD_UUIDS;
    delete process.env.LV1_SQUAD_UUIDS;
    delete process.env.LV2_SQUAD_UUIDS;
    delete process.env.TRAFFIC_LIMIT_RESET_STRATEGY;
    delete process.env.REMNAWAVE_HEADERS;
    delete process.env.REMNAWAVE_TAG;
});

describe("RemnawaveClient", () => {
    it("creates a new user when no externalId match exists", async () => {
        const created = {
            uuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            username: "linuxdo_123_user_foo_bar",
            externalId: "linuxdo_123",
            subscriptionUrl: "https://sub.example/u",
            expireAt: "2026-06-11T00:00:00.000Z",
        };
        const fetchMock = mockFetch(
            jsonResponse(usersResponse([])),
            jsonResponse(userResponse(created)),
        );

        const client = new RemnawaveClient({ baseUrl: `${BASE_URL}/`, token: TOKEN });
        const result = await client.createOrUpdateUser({
            linuxdoSub: "123",
            linuxdoUsername: "@User-Foo.Bar",
            trafficLimitBytes: 100 * REMNAWAVE_GIB,
            daysToAdd: 30,
            isTrial: false,
            tier: "LV1",
        });

        expect(result).toEqual(created);
        expect(fetchMock).toHaveBeenNthCalledWith(1, `${BASE_URL}/api/users?size=250&start=0`, expect.objectContaining({
            method: "GET",
            headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
        }));
        expect(fetchMock).toHaveBeenNthCalledWith(2, `${BASE_URL}/api/users`, expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
                Authorization: `Bearer ${TOKEN}`,
                "Content-Type": "application/json",
            }),
        }));

        expect(requestBody(fetchMock.mock.calls[1])).toEqual({
            username: "linuxdo_123_user_foo_bar",
            externalId: "linuxdo_123",
            activeInternalSquads: [LV1_SQUAD_UUID],
            status: "ACTIVE",
            expireAt: "2026-06-11T00:00:00.000Z",
            trafficLimitStrategy: "MONTH",
            trafficLimitBytes: 100 * REMNAWAVE_GIB,
            externalSquadUuid: EXTERNAL_SQUAD_UUID,
            description: "@User-Foo.Bar",
        });
    });

    it("updates an existing user and adds days to current expiry", async () => {
        const existing = {
            uuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            username: "linuxdo_123_old",
            externalId: "linuxdo_123",
            subscriptionUrl: "https://sub.example/old",
            expireAt: "2026-05-20T00:00:00.000Z",
        };
        const updated = {
            ...existing,
            subscriptionUrl: "https://sub.example/new",
            expireAt: "2026-06-19T00:00:00.000Z",
        };
        const fetchMock = mockFetch(
            jsonResponse(usersResponse([existing])),
            jsonResponse(userResponse(updated)),
        );

        const client = new RemnawaveClient({ baseUrl: BASE_URL, token: TOKEN });
        const result = await client.createOrUpdateUser({
            linuxdoSub: "123",
            linuxdoUsername: "User",
            trafficLimitBytes: 500 * REMNAWAVE_GIB,
            daysToAdd: 30,
            isTrial: false,
            tier: "LV2",
        });

        expect(result).toEqual(updated);
        expect(fetchMock).toHaveBeenNthCalledWith(2, `${BASE_URL}/api/users`, expect.objectContaining({ method: "PATCH" }));
        expect(requestBody(fetchMock.mock.calls[1])).toEqual({
            uuid: existing.uuid,
            externalId: "linuxdo_123",
            expireAt: "2026-06-19T00:00:00.000Z",
            status: "ACTIVE",
            trafficLimitBytes: 500 * REMNAWAVE_GIB,
            activeInternalSquads: [LV2_SQUAD_UUID],
            trafficLimitStrategy: "MONTH",
            externalSquadUuid: EXTERNAL_SQUAD_UUID,
            description: "User",
        });
    });

    it("finds existing users by username prefix when externalId is not returned", async () => {
        const existing = {
            uuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            username: "linuxdo_123_old",
            subscriptionUrl: "https://sub.example/old",
            expireAt: "2026-05-20T00:00:00.000Z",
        };
        const fetchMock = mockFetch(
            jsonResponse(usersResponse([existing])),
            jsonResponse(userResponse(existing)),
        );

        const client = new RemnawaveClient({ baseUrl: BASE_URL, token: TOKEN });
        await client.createOrUpdateUser({
            linuxdoSub: "123",
            linuxdoUsername: "new",
            trafficLimitBytes: REMNAWAVE_GIB,
            daysToAdd: 1,
            isTrial: false,
            tier: "LV0",
        });

        expect(fetchMock).toHaveBeenNthCalledWith(2, `${BASE_URL}/api/users`, expect.objectContaining({ method: "PATCH" }));
    });

    it.each([
        ["LV0", LV0_SQUAD_UUID, 10 * REMNAWAVE_GIB],
        ["LV1", LV1_SQUAD_UUID, 1000 * REMNAWAVE_GIB],
        ["LV2", LV2_SQUAD_UUID, 2000 * REMNAWAVE_GIB],
    ] as const)("uses %s squad and caller traffic limit", async (tier, squadUuid, trafficLimitBytes) => {
        const fetchMock = mockFetch(
            jsonResponse(usersResponse([])),
            jsonResponse(userResponse({
                uuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                username: "linuxdo_123_user",
                externalId: "linuxdo_123",
                subscriptionUrl: "https://sub.example/u",
                expireAt: "2026-05-13T00:00:00.000Z",
            })),
        );

        const client = new RemnawaveClient({ baseUrl: BASE_URL, token: TOKEN });
        await client.createOrUpdateUser({
            linuxdoSub: "123",
            linuxdoUsername: "user",
            trafficLimitBytes,
            daysToAdd: 1,
            isTrial: false,
            tier,
        });

        expect(requestBody(fetchMock.mock.calls[1])).toMatchObject({
            activeInternalSquads: [squadUuid],
            trafficLimitBytes,
        });
    });

    it.each([
        [401, { message: "Unauthorized", errorCode: "AUTH" }, "API error 401: Unauthorized (code: AUTH)"],
        [404, { message: "Missing" }, "not found"],
        [500, { message: "Server error", errorCode: "E500" }, "API error 500: Server error (code: E500)"],
    ])("throws typed error for HTTP %s", async (status, body, message) => {
        mockFetch(jsonResponse(JSON.stringify(body), status));

        const client = new RemnawaveClient({ baseUrl: BASE_URL, token: TOKEN });
        await expect(client.createOrUpdateUser({
            linuxdoSub: "123",
            linuxdoUsername: "user",
            trafficLimitBytes: REMNAWAVE_GIB,
            daysToAdd: 1,
            isTrial: false,
            tier: "LV0",
        })).rejects.toMatchObject({
            name: "RemnawaveApiError",
            status,
            message,
        } satisfies Partial<RemnawaveApiError>);
    });
});

describe("identity helpers", () => {
    it("sanitizes linux.do usernames like the bot Telegram sanitizer", () => {
        expect(sanitizeLinuxdoUsername("@User-Foo.Bar")).toBe("user_foo_bar");
    });

    it("truncates sanitized usernames to 32 chars", () => {
        expect(sanitizeLinuxdoUsername("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBe("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    });

    it("builds username with immutable linux.do sub first", () => {
        expect(usernameForLinuxdo("123", "@User-Foo.Bar")).toBe("linuxdo_123_user_foo_bar");
    });
});
