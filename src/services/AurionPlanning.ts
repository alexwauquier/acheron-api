import { load } from "cheerio";
import { AurionSession } from "../sessions/AurionSession";
import { PlanningParser, type AurionEvent } from "../utils/PlanningParser";
import { AurionDateUtils } from "../utils/AurionDateUtils";

export class AurionPlanning {
  constructor(private session: AurionSession) {}

  async navigateToPlanning(): Promise<{
    viewState: string;
    idInit: string;
  } | null> {
    const mainMenuRes = await this.session.request(
      "https://aurion.junia.com/faces/MainMenuPage.xhtml",
      "GET",
    );
    const mainMenuHtml = await mainMenuRes.text();
    let $ = load(mainMenuHtml);

    let idInit = $('input[name="form:idInit"]').val() as string | undefined;
    if (!idInit) {
      const match = mainMenuHtml.match(/value="(webscolaapp\.[^"]+)"/);
      if (match) idInit = match[1];
    }
    let viewState = $('input[name="javax.faces.ViewState"]').val() as string;

    if (!idInit || !viewState) return null;

    const formData = new URLSearchParams();
    formData.append("form", "form");
    formData.append("form:largeurDivCenter", "530");
    formData.append("form:idInit", idInit);
    formData.append("form:j_idt773_input", "46623");
    formData.append("javax.faces.ViewState", viewState);
    formData.append("form:sidebar", "form:sidebar");
    formData.append("form:sidebar_menuid", "0");

    const navRes = await this.session.request(
      "https://aurion.junia.com/faces/MainMenuPage.xhtml",
      "POST",
      formData,
      {
        Origin: "https://aurion.junia.com",
        Referer: "https://aurion.junia.com/faces/MainMenuPage.xhtml",
      },
      "follow",
    );

    const planningHtml = await navRes.text();
    $ = load(planningHtml);

    idInit = $('input[name="form:idInit"]').val() as string | undefined;
    if (!idInit) {
      const match = planningHtml.match(/value="(webscolaapp\.[^"]+)"/);
      if (match) idInit = match[1];
    }
    viewState = $('input[name="javax.faces.ViewState"]').val() as string;

    if (!idInit || !viewState) return null;

    return { viewState, idInit };
  }

  async fetchEvents(
    viewState: string,
    idInit: string,
    dateParams: {
      startMs: number;
      endMs: number;
      dateStr: string;
      weekStr: string;
      view?: string;
    },
  ): Promise<AurionEvent[]> {
    const formData = new URLSearchParams();
    formData.append("javax.faces.partial.ajax", "true");
    formData.append("javax.faces.source", "form:j_idt118");
    formData.append("javax.faces.partial.render", "form:j_idt118");
    formData.append("form:j_idt118", "form:j_idt118");

    formData.append("form:j_idt118_start", dateParams.startMs.toString());
    formData.append("form:j_idt118_end", dateParams.endMs.toString());

    formData.append("form", "form");
    formData.append("form:idInit", idInit);
    formData.append("form:date_input", dateParams.dateStr);
    formData.append("form:week", dateParams.weekStr);
    formData.append("form:j_idt118_view", dateParams.view || "agendaWeek");
    formData.append("javax.faces.ViewState", viewState);


    const response = await this.session.request(
      "https://aurion.junia.com/faces/Planning.xhtml",
      "POST",
      formData,
      {
        "Faces-Request": "partial/ajax",
        "X-Requested-With": "XMLHttpRequest",
        Origin: "https://aurion.junia.com",
        Referer: "https://aurion.junia.com/faces/Planning.xhtml",
      },
    );

    const xml = await response.text();
    return PlanningParser.parseXmlResponse(xml);
  }
}
