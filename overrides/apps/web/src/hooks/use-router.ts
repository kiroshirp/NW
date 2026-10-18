import { useState, useEffect, useCallback, useMemo } from "react";
import { shareBaseOrigin } from "../services/share-origin";
import { MOTION_CREATOR_ENABLED } from "../config/features";

export type AppRoute =
  | "welcome"
  | "editor"
  | "new"
  | "templates"
  | "recent"
  | "share"
  | "motion";

export interface RouteParams {
  dimensions?: string;
  preset?: string;
  width?: string;
  height?: string;
  fps?: string;
  tab?: string;
  shareId?: string;
  compositionId?: string;
}

export interface RouterState {
  route: AppRoute;
  params: RouteParams;
}

function parseHash(hash: string): RouterState {
  const cleanHash = hash.replace(/^#\/?/, "");
  const [path, queryString] = cleanHash.split("?");

  const params: RouteParams = {};
  if (queryString) {
    const searchParams = new URLSearchParams(queryString);
    searchParams.forEach((value, key) => {
      params[key as keyof RouteParams] = value;
    });
  }

  const pathParts = path.split("/");
  let route: AppRoute = (pathParts[0] || "welcome") as AppRoute;
  const validRoutes: AppRoute[] = [
    "welcome",
    "editor",
    "new",
    "templates",
    "recent",
    "share",
    "motion",
  ];

  if (route === "share" && pathParts[1]) {
    params.shareId = pathParts[1];
  }

  if (route === "motion" && !MOTION_CREATOR_ENABLED) {
    route = "editor";
  }

  return {
    route: validRoutes.includes(route) ? route : "welcome",
    params,
  };
}

function buildHash(route: AppRoute, params?: RouteParams): string {
  if (route === "motion" && !MOTION_CREATOR_ENABLED) {
    route = "editor";
    params = undefined;
  }
  let hash = `${import.meta.env.BASE_URL}${route === "welcome" ? "" : route + "/"}`;

  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.set(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      hash += `?${queryString}`;
    }
  }

  return hash;
}

function readLocation(): RouterState {
  if (window.location.hash.startsWith("#/")) return parseHash(window.location.hash);
  const base = import.meta.env.BASE_URL;
  const route = window.location.pathname.startsWith(base) ? window.location.pathname.slice(base.length) : "";
  return parseHash(route.replace(/\/$/, "") + window.location.search);
}
function pushRoute(url: string) {
  window.history.pushState(null, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
export function useRouter() {
  const [state, setState] = useState<RouterState>(() => {
    if (typeof window !== "undefined") {
      return readLocation();
    }
    return { route: "welcome", params: {} };
  });

  useEffect(() => {
    const handleHashChange = () => {
      setState(readLocation());
    };

    if (window.location.hash.startsWith("#/")) {
      const legacy = readLocation();
      window.history.replaceState(null, "", buildHash(legacy.route, legacy.params));
      handleHashChange();
    }
    window.addEventListener("popstate", handleHashChange);
    window.addEventListener("hashchange", handleHashChange);
    return () => { window.removeEventListener("popstate", handleHashChange); window.removeEventListener("hashchange", handleHashChange); };
  }, []);

  const navigate = useCallback((route: AppRoute, params?: RouteParams) => {
    const hash = buildHash(route, params);
    pushRoute(hash);
  }, []);

  const updateParams = useCallback(
    (newParams: Partial<RouteParams>) => {
      const hash = buildHash(state.route, { ...state.params, ...newParams });
      pushRoute(hash);
    },
    [state.route, state.params],
  );

  const clearParams = useCallback(() => {
    const hash = buildHash(state.route);
    pushRoute(hash);
  }, [state.route]);

  const parsedDimensions = useMemo(() => {
    const { dimensions, width, height } = state.params;

    if (dimensions) {
      const match = dimensions.match(/^(\d+)x(\d+)$/i);
      if (match) {
        return {
          width: parseInt(match[1], 10),
          height: parseInt(match[2], 10),
        };
      }
    }

    if (width && height) {
      return { width: parseInt(width, 10), height: parseInt(height, 10) };
    }

    return null;
  }, [state.params]);

  const fps = useMemo(() => {
    const { fps } = state.params;
    if (fps) {
      const parsed = parseInt(fps, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 120) {
        return parsed;
      }
    }
    return 30;
  }, [state.params]);

  return {
    route: state.route,
    params: state.params,
    navigate,
    updateParams,
    clearParams,
    parsedDimensions,
    fps,
  };
}

export function generateShareableLink(
  route: AppRoute,
  params?: RouteParams,
): string {
  return new URL(buildHash(route, params), shareBaseOrigin()).href;
}

export function generateNewProjectLink(options: {
  width?: number;
  height?: number;
  preset?: string;
  fps?: number;
}): string {
  const params: RouteParams = {};

  if (options.preset) {
    params.preset = options.preset;
  } else if (options.width && options.height) {
    params.dimensions = `${options.width}x${options.height}`;
  }

  if (options.fps && options.fps !== 30) {
    params.fps = String(options.fps);
  }

  return generateShareableLink("new", params);
}
