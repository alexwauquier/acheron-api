import { load } from "cheerio";

export class AurionClient {
  private cookies: Map<string, string> = new Map();
  private userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0";

  constructor() {}

  private getCookieString(): string {
    return Array.from(this.cookies.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }

  private setCookies(header: string | null) {
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

  async login(username: string, password: string): Promise<boolean> {
    const body = new URLSearchParams();
    body.append("username", username);
    body.append("password", password);

    const response = await fetch("https://aurion.junia.com/login", {
      method: "POST",
      headers: {
        "user-agent": this.userAgent,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: body,
      redirect: "manual",
    });

    this.setCookies(response.headers.get("set-cookie"));

    return response.status === 302;
  }

  async fetchPage(
    url: string,
  ): Promise<{ viewState: string; idInit?: string; body: string } | null> {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "user-agent": this.userAgent,
        cookie: this.getCookieString(),
      },
    });

    const html = await response.text();
    const $ = load(html);

    let idInit = $('input[name="form:idInit"]').val() as string | undefined;

    if (!idInit) {
      const match = html.match(/value="(webscolaapp\.[^"]+)"/);
      if (match) {
        idInit = match[1];
      }
    }

    const viewState = $('input[name="javax.faces.ViewState"]').val() as string;

    if (!viewState) {
      return null;
    }

    return { viewState, idInit, body: html };
  }

  async navigateToPlanning(): Promise<{
    viewState: string;
    idInit: string;
  } | null> {
    const mainMenu = await this.fetchPage(
      "https://aurion.junia.com/faces/MainMenuPage.xhtml",
    );
    if (!mainMenu || !mainMenu.idInit) {
      return null;
    }

    const formData = new URLSearchParams();
    formData.append("form", "form");
    formData.append("form:idInit", mainMenu.idInit);
    formData.append("form:j_idt773_input", "46623");
    formData.append("javax.faces.ViewState", mainMenu.viewState);
    formData.append("form:sidebar", "form:sidebar");
    formData.append("form:sidebar_menuid", "0");

    const response = await fetch(
      "https://aurion.junia.com/faces/MainMenuPage.xhtml",
      {
        method: "POST",
        headers: {
          "user-agent": this.userAgent,
          "content-type": "application/x-www-form-urlencoded",
          cookie: this.getCookieString(),
          Origin: "https://aurion.junia.com",
          Referer: "https://aurion.junia.com/faces/MainMenuPage.xhtml",
        },
        body: formData,
        redirect: "follow",
      },
    );

    const html = await response.text();
    const $ = load(html);

    let idInit = $('input[name="form:idInit"]').val() as string | undefined;

    if (!idInit) {
      const match = html.match(/value="(webscolaapp\.[^"]+)"/);
      if (match) {
        idInit = match[1];
      }
    }

    const viewState = $('input[name="javax.faces.ViewState"]').val() as string;

    if (!viewState || !idInit) {
      return null;
    }

    return { viewState, idInit };
  }

  async fetchPlanningEvents(
    viewState: string,
    idInit: string,
  ): Promise<string> {
    const formData = new URLSearchParams();
    formData.append("javax.faces.partial.render", "form:j_idt118");
    formData.append("form:j_idt118", "form:j_idt118");
    formData.append("form:j_idt118_start", "1769986800000");
    formData.append("form:j_idt118_end", "1770505200000");
    formData.append("form:idInit", idInit);
    formData.append("form:date_input", "02/02/2026");
    formData.append("form:week", "6-2026");
    formData.append("javax.faces.ViewState", viewState);

    const response = await fetch(
      "https://aurion.junia.com/faces/Planning.xhtml",
      {
        method: "POST",
        headers: {
          "user-agent": this.userAgent,
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          cookie: this.getCookieString(),
          "Faces-Request": "partial/ajax",
          "X-Requested-With": "XMLHttpRequest",
          Origin: "https://aurion.junia.com",
          Referer: "https://aurion.junia.com/faces/Planning.xhtml",
        },
        body: formData,
      },
    );

    return await response.text();
  }
}
