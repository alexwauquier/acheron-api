export class AurionSession {
  private cookies: Map<string, string> = new Map();
  private userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0";

  constructor() {}

  public getCookieString(): string {
    return Array.from(this.cookies.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }

  public setCookies(header: string | null) {
    if (!header) return;
    const cookies = header.split(/,(?=\s*[^;]+=[^;]+)/g);

    cookies.forEach((cookie) => {
      const parts = cookie.split(";");
      if (parts[0]) {
        const [name, value] = parts[0].trim().split("=");
        if (name && value) {
          this.cookies.set(name, value);
        }
      }
    });
  }

  public async login(username: string, password: string): Promise<boolean> {
    const body = new URLSearchParams();
    body.append("username", username);
    body.append("password", password);

    const response = await this.request(
      "https://aurion.junia.com/login",
      "POST",
      body,
      {},
      "manual",
    );

    return response.status === 302;
  }

  public async request(
    url: string,
    method: "GET" | "POST",
    body?: URLSearchParams,
    customHeaders: Record<string, string> = {},
    redirect: "follow" | "error" | "manual" = "manual",
  ): Promise<Response> {
    const headers: Record<string, string> = {
      "user-agent": this.userAgent,
      cookie: this.getCookieString(),
      ...customHeaders,
    };

    if (method === "POST" && !headers["content-type"]) {
      headers["content-type"] = "application/x-www-form-urlencoded";
    }

    const response = await fetch(url, {
      method,
      headers,
      body,
      redirect,
    });

    this.setCookies(response.headers.get("set-cookie"));
    return response;
  }
}
