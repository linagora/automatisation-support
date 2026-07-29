import { describe, expect, it, vi } from "vitest";

import {
  validateMatrixHomeserver
} from "../../../src/infrastructure/matrix/validateMatrixHomeserver";

import type {
  MatrixHomeserverFetch
} from "../../../src/infrastructure/matrix/validateMatrixHomeserver";

function response(params: {
  status: number;
  headers?: Record<string, string>;
}): Awaited<ReturnType<MatrixHomeserverFetch>> {
  const headers = new Map(
    Object.entries(params.headers ?? {}).map(([key, value]) => [
      key.toLowerCase(),
      value
    ])
  );

  return {
    status: params.status,
    headers: {
      get: (name: string) => headers.get(name.toLowerCase()) ?? null
    }
  };
}

describe("validateMatrixHomeserver", function () {
  it("accepts a Matrix API response without redirects", async function () {
    const fetchFn = vi.fn<MatrixHomeserverFetch>(async () => response({
      status: 401,
      headers: {
        "content-type": "application/json"
      }
    }));

    await expect(validateMatrixHomeserver("https://matrix.example.org", {
      fetchFn
    })).resolves.toBeUndefined();

    expect(fetchFn).toHaveBeenCalledWith(
      "https://matrix.example.org/_matrix/client/v3/account/whoami",
      {
        method: "GET",
        redirect: "manual",
        headers: {
          accept: "application/json"
        }
      }
    );
  });

  it("accepts one legitimate redirect to a Matrix API response", async function () {
    const fetchFn = vi.fn<MatrixHomeserverFetch>(async (url) => {
      if (url === "https://matrix.example.org/_matrix/client/v3/account/whoami") {
        return response({
          status: 308,
          headers: {
            location: "https://matrix.example.org/matrix/_matrix/client/v3/account/whoami"
          }
        });
      }

      return response({
        status: 401,
        headers: {
          "content-type": "application/json"
        }
      });
    });

    await expect(validateMatrixHomeserver("https://matrix.example.org", {
      fetchFn
    })).resolves.toBeUndefined();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("rejects a homeserver endpoint redirecting to itself", async function () {
    const fetchFn = vi.fn<MatrixHomeserverFetch>(async () => response({
      status: 301,
      headers: {
        location: "https://stg.lin-saas.com/_matrix/client/v3/account/whoami"
      }
    }));

    await expect(validateMatrixHomeserver("https://stg.lin-saas.com", {
      fetchFn
    })).rejects.toThrow("redirects to itself");
  });

  it("rejects a redirect loop alternating between URLs", async function () {
    const fetchFn = vi.fn<MatrixHomeserverFetch>(async (url) => {
      if (url === "https://matrix.example.org/_matrix/client/v3/account/whoami") {
        return response({
          status: 301,
          headers: {
            location: "https://www.example.org/_matrix/client/v3/account/whoami"
          }
        });
      }

      return response({
        status: 301,
        headers: {
          location: "https://matrix.example.org/_matrix/client/v3/account/whoami"
        }
      });
    });

    await expect(validateMatrixHomeserver("https://matrix.example.org", {
      fetchFn
    })).rejects.toThrow("redirect loop detected");
  });

  it("rejects a redirect ending on a web UI page", async function () {
    const fetchFn = vi.fn<MatrixHomeserverFetch>(async (url) => {
      if (url === "https://matrix.example.org/_matrix/client/v3/account/whoami") {
        return response({
          status: 302,
          headers: {
            location: "https://matrix.example.org/login"
          }
        });
      }

      return response({
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8"
        }
      });
    });

    await expect(validateMatrixHomeserver("https://matrix.example.org", {
      fetchFn
    })).rejects.toThrow("returned an HTML page");
  });

  it("rejects missing, invalid, and non-TLS homeserver URLs", async function () {
    await expect(validateMatrixHomeserver("")).rejects.toThrow("must not be empty");
    await expect(validateMatrixHomeserver("matrix.example.org")).rejects.toThrow(
      "absolute URL"
    );
    await expect(validateMatrixHomeserver("http://matrix.example.org")).rejects.toThrow(
      "must use https"
    );
  });

  it("rejects an incorrect Matrix URL returning a non-Matrix response", async function () {
    const fetchFn = vi.fn<MatrixHomeserverFetch>(async () => response({
      status: 404,
      headers: {
        "content-type": "application/json"
      }
    }));

    await expect(validateMatrixHomeserver("https://www.example.org", {
      fetchFn
    })).rejects.toThrow("returned HTTP 404");
  });
});
