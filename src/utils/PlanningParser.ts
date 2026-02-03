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

      const examPatterns = [
        "PARTIEL",
        "INTERRO",
        "DS_SURV",
        "CC",
        "EXAM",
        "RATTRAPAGE",
      ];
      const autoPatterns = ["AUTO_GERE", "E-LEARNING"];
      const standardPatterns = ["CM", "TD", "TP", "COURS"];

      let typeIndex = -1;
      let detectedType = "";

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;

        const p = part.toUpperCase();

        if (examPatterns.some((pat) => p.includes(pat))) {
          typeIndex = i;
          if (p.includes("PARTIEL")) detectedType = "PARTIEL";
          else if (p.includes("INTERRO")) detectedType = "INTERRO";
          else if (p.includes("DS_SURV") || p.includes("DS"))
            detectedType = "DS";
          else if (p.includes("CC")) detectedType = "CC";
          else detectedType = part;

          event.className = "est-epreuve";
          break;
        }

        if (autoPatterns.some((pat) => p.includes(pat))) {
          typeIndex = i;
          if (p.includes("TD_AUTO")) detectedType = "TD_AUTO";
          else if (p.includes("CM_AUTO")) detectedType = "CM_AUTO";
          else detectedType = "AUTO";
          break;
        }

        if (
          ["CM", "TD", "TP", "COURS_TD", "CM_DIST", "TD_DIST"].includes(part)
        ) {
          typeIndex = i;
          detectedType = part;
          break;
        }
      }

      if (typeIndex !== -1) {
        event.courseType = detectedType;

        if (parts.length > typeIndex + 1) {
          event.teacher = parts.slice(typeIndex + 1).join(" ");
        }

        const before = parts.slice(0, typeIndex);

        if (before.length === 0) {
        } else if (before.length === 1) {
          const firstLine = before[0];
          if (
            detectedType === "PARTIEL" ||
            detectedType === "INTERRO" ||
            detectedType === "DS" ||
            detectedType.includes("AUTO")
          ) {
            if (firstLine && this.looksLikeRoom(firstLine)) {
              event.room = firstLine;
            } else {
              event.subject = firstLine;
              event.room = undefined;
            }
          } else {
            event.room = firstLine;
          }
        } else {
          event.room = before[0];
          event.subject = before.slice(1).join(" ");
        }
      }
    }

    return event;
  }

  private static looksLikeRoom(str: string): boolean {
    if (!str) return false;
    const s = str.toUpperCase();
    return (
      s.startsWith("IC") ||
      s.startsWith("ALG") ||
      s.startsWith("HE") ||
      s.match(/^\w\d+/) !== null
    );
  }
}
