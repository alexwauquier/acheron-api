import { load } from "cheerio";

export interface AurionEvent {
  id: string;
  start: string;
  end: string;
  title: string;
  type: string;
  className: string;
  editable: boolean;
  allDay: boolean;

  room?: string;
  subject?: string;
  courseType?: string;
  teacher?: string;
}

export class PlanningParser {

  static parseXmlResponse(xml: string): AurionEvent[] {
  
    const startMarker = '<update id="form:j_idt118"><![CDATA[';
    const endMarker = "]]></update>";

    const startIndex = xml.indexOf(startMarker);
    if (startIndex === -1) {
      throw new Error("Could not find planning update block in XML response.");
    }

    const payloadStart = startIndex + startMarker.length;
    const endIndex = xml.indexOf(endMarker, payloadStart);
    if (endIndex === -1) {
      throw new Error("Could not find end of planning update block.");
    }

    const jsonString = xml.substring(payloadStart, endIndex);

    try {
      const rawData = JSON.parse(jsonString);
      if (!rawData.events || !Array.isArray(rawData.events)) {
        return [];
      }

      return rawData.events.map((e: any) => this.processEvent(e));
    } catch (e) {
      console.error("Failed to parse inner JSON from Aurion:", e);
      throw new Error("Invalid JSON in Aurion response");
    }
  }


  private static processEvent(raw: any): AurionEvent {
    const event: AurionEvent = {
      id: raw.id,
      start: raw.start,
      end: raw.end,
      title: raw.title,
      type: raw.type,
      className: raw.className,
      editable: raw.editable,
      allDay: raw.allDay,
    };

    if (event.title) {
      const parts = event.title
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      if (parts.length >= 1) event.room = parts[0];
      if (parts.length >= 2) event.subject = parts[1];
      if (parts.length >= 3) event.courseType = parts[2];
      if (parts.length >= 4) event.teacher = parts[3];
    }

    return event;
  }
}
