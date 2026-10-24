/* NESTORA API client */

window.API_BASE_URL = "http://localhost:5000/api";

const AUTH_STORAGE_KEY = "nestora_auth_v1";

function getAuthSession() {
    try {
        return JSON.parse(
            localStorage.getItem(AUTH_STORAGE_KEY) || "null"
        );
    } catch {
        return null;
    }
}

function setAuthSession(session) {
    if (session) {
        localStorage.setItem(
            AUTH_STORAGE_KEY,
            JSON.stringify(session)
        );
    } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
    }
}

async function apiRequest(path, options = {}) {
    const session = getAuthSession();

    const headers = {
        ...(options.headers || {})
    };

    if (options.body && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }

    if (session?.token) {
        headers.Authorization = `Bearer ${session.token}`;
    }

    let response;

    try {
        response = await fetch(
            `${window.API_BASE_URL}${path}`,
            {
                ...options,
                headers
            }
        );
    } catch (error) {
        console.error("API connection failed:", error);

        throw new Error(
            "Cannot connect to the backend. Start the server on port 5000."
        );
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        if (response.status === 401 && session?.token) {
            setAuthSession(null);
        }

        throw new Error(
            data.message || `Request failed (${response.status}).`
        );
    }

    return data;
}

window.apiRequest = apiRequest;
window.getAuthSession = getAuthSession;
window.setAuthSession = setAuthSession;