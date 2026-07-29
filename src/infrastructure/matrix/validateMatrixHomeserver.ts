type MatrixHomeserverFetch = (
  input: string,
  init: {
    method: "GET";
    redirect: "manual";
    headers: Record<string, string>;
  }
) => Promise<{
  status: number;
  headers: {
    get: (name: string) => string | null;
  };
}>;

type ValidateMatrixHomeserverOptions = {
  fetchFn?: MatrixHomeserverFetch;
  maxRedirects?: number;
};

const MATRIX_HOMESERVER_PROBE_PATH = "/_matrix/client/v3/account/whoami";
const DEFAULT_MAX_REDIRECTS = 5;

function normalizeMatrixHomeserverUrl(homeserverUrl: string): string {
  const trimmedUrl = homeserverUrl.trim();

  if (trimmedUrl === "") {
    throw new Error("MATRIX_HOMESERVER_URL must not be empty");
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(trimmedUrl);
  } catch {
    throw new Error("MATRIX_HOMESERVER_URL must be an absolute URL");
  }

  const isLocalHttp =
    parsedUrl.protocol === "http:" &&
    (
      parsedUrl.hostname === "localhost" ||
      parsedUrl.hostname === "127.0.0.1" ||
      parsedUrl.hostname === "::1"
    );

  if (parsedUrl.protocol !== "https:" && !isLocalHttp) {
    throw new Error(
      "MATRIX_HOMESERVER_URL must use https, except for localhost development"
    );
  }

  return parsedUrl.toString().replace(/\/+$/, "");
}

function buildMatrixHomeserverProbeUrl(homeserverUrl: string): string {
  return `${normalizeMatrixHomeserverUrl(homeserverUrl)}${MATRIX_HOMESERVER_PROBE_PATH}`;
}

function isRedirectStatus(status: number): boolean {
  return status >= 300 && status < 400;
}

function isMatrixLikeResponse(params: {
  status: number;
  contentType: string;
}): boolean {
  return (
    (params.status === 200 ||
      params.status === 401 ||
      params.status === 403) &&
    (
      params.contentType === "" ||
      params.contentType.includes("application/json")
    )
  );
}

function formatRedirectChain(chain: string[]): string {
  return chain.join(" -> ");
}

async function validateMatrixHomeserver(
  homeserverUrl: string,
  options: ValidateMatrixHomeserverOptions = {}
): Promise<void> {
  const fetchFn = options.fetchFn ?? fetch;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const visitedUrls: string[] = [];
  let currentUrl = buildMatrixHomeserverProbeUrl(homeserverUrl);

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    if (visitedUrls.includes(currentUrl)) {
      throw new Error(
        `Matrix homeserver validation failed: redirect loop detected (${formatRedirectChain([
          ...visitedUrls,
          currentUrl
        ])})`
      );
    }

    visitedUrls.push(currentUrl);

    const response = await fetchFn(currentUrl, {
      method: "GET",
      redirect: "manual",
      headers: {
        accept: "application/json"
      }
    });
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

    if (isRedirectStatus(response.status)) {
      const location = response.headers.get("location");

      if (!location) {
        throw new Error(
          `Matrix homeserver validation failed: HTTP ${response.status} redirect without Location for ${currentUrl}`
        );
      }

      const redirectUrl = new URL(location, currentUrl).toString();

      if (redirectUrl === currentUrl) {
        throw new Error(
          `Matrix homeserver validation failed: ${currentUrl} redirects to itself with HTTP ${response.status}`
        );
      }

      currentUrl = redirectUrl;
      continue;
    }

    if (contentType.includes("text/html")) {
      throw new Error(
        `Matrix homeserver validation failed: ${currentUrl} returned an HTML page instead of Matrix JSON (HTTP ${response.status})`
      );
    }

    if (!isMatrixLikeResponse({
      status: response.status,
      contentType
    })) {
      throw new Error(
        `Matrix homeserver validation failed: ${currentUrl} returned HTTP ${response.status} with content-type "${contentType || "unknown"}"`
      );
    }

    return;
  }

  throw new Error(
    `Matrix homeserver validation failed: exceeded ${maxRedirects} redirects (${formatRedirectChain(visitedUrls)})`
  );
}

export {
  MATRIX_HOMESERVER_PROBE_PATH,
  buildMatrixHomeserverProbeUrl,
  normalizeMatrixHomeserverUrl,
  validateMatrixHomeserver
};

export type {
  MatrixHomeserverFetch,
  ValidateMatrixHomeserverOptions
};
