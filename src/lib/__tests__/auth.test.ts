// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";

// Must mock server-only before importing auth
vi.mock("server-only", () => ({}));

const mockCookieStore = {
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

// Import after mocks are set up
const { createSession, getSession, deleteSession, verifySession } =
  await import("@/lib/auth");

const JWT_SECRET = new TextEncoder().encode("development-secret-key");

async function makeToken(
  payload: object,
  expiresIn = "7d"
): Promise<string> {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(JWT_SECRET);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createSession", () => {
  test("sets an httpOnly cookie with a signed JWT", async () => {
    await createSession("user-1", "test@example.com");

    expect(mockCookieStore.set).toHaveBeenCalledOnce();
    const [name, token, options] = mockCookieStore.set.mock.calls[0];
    expect(name).toBe("auth-token");
    expect(typeof token).toBe("string");
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  test("token contains userId and email", async () => {
    await createSession("user-42", "hello@example.com");

    const token = mockCookieStore.set.mock.calls[0][1];
    const { jwtVerify } = await import("jose");
    const { payload } = await jwtVerify(token, JWT_SECRET);

    expect(payload.userId).toBe("user-42");
    expect(payload.email).toBe("hello@example.com");
  });

  test("cookie expires ~7 days from now", async () => {
    const before = Date.now();
    await createSession("user-1", "test@example.com");
    const after = Date.now();

    const { expires } = mockCookieStore.set.mock.calls[0][2];
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    expect(expires.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(expires.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
  });
});

describe("getSession", () => {
  test("returns null when no cookie is present", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    const session = await getSession();
    expect(session).toBeNull();
  });

  test("returns session payload for a valid token", async () => {
    const payload = {
      userId: "user-1",
      email: "test@example.com",
      expiresAt: new Date().toISOString(),
    };
    const token = await makeToken(payload);
    mockCookieStore.get.mockReturnValue({ value: token });

    const session = await getSession();
    expect(session?.userId).toBe("user-1");
    expect(session?.email).toBe("test@example.com");
  });

  test("returns null for an invalid/tampered token", async () => {
    mockCookieStore.get.mockReturnValue({ value: "not.a.valid.jwt" });

    const session = await getSession();
    expect(session).toBeNull();
  });

  test("returns null for an expired token", async () => {
    const token = await makeToken(
      { userId: "u1", email: "e@x.com" },
      "-1s" // already expired
    );
    mockCookieStore.get.mockReturnValue({ value: token });

    const session = await getSession();
    expect(session).toBeNull();
  });
});

describe("deleteSession", () => {
  test("deletes the auth-token cookie", async () => {
    await deleteSession();

    expect(mockCookieStore.delete).toHaveBeenCalledOnce();
    expect(mockCookieStore.delete).toHaveBeenCalledWith("auth-token");
  });
});

describe("verifySession", () => {
  function makeRequest(token?: string): NextRequest {
    const req = new NextRequest("http://localhost/");
    if (token) {
      // NextRequest is read-only, so build via headers/cookies on construction
      return new NextRequest("http://localhost/", {
        headers: { cookie: `auth-token=${token}` },
      });
    }
    return req;
  }

  test("returns null when no cookie is present", async () => {
    const req = makeRequest();
    const session = await verifySession(req);
    expect(session).toBeNull();
  });

  test("returns session payload for a valid token", async () => {
    const token = await makeToken({
      userId: "user-99",
      email: "valid@example.com",
      expiresAt: new Date().toISOString(),
    });
    const req = makeRequest(token);

    const session = await verifySession(req);
    expect(session?.userId).toBe("user-99");
    expect(session?.email).toBe("valid@example.com");
  });

  test("returns null for an invalid token", async () => {
    const req = makeRequest("garbage.token.value");
    const session = await verifySession(req);
    expect(session).toBeNull();
  });

  test("returns null for an expired token", async () => {
    const token = await makeToken(
      { userId: "u1", email: "e@x.com" },
      "-1s"
    );
    const req = makeRequest(token);
    const session = await verifySession(req);
    expect(session).toBeNull();
  });
});
