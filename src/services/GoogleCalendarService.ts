import { google } from "googleapis";
import fs from "fs/promises";
import path from "path";
import process from "process";

const SCOPES = ["https://www.googleapis.com/auth/calendar"];
const TOKEN_DIR = path.join(process.cwd(), "tokens");
const TOKEN_PATH = path.join(TOKEN_DIR, "token.json");

export class GoogleCalendarService {
  private auth;
  private calendar;

  constructor() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error("Missing Google Credentials in .env");
    }

    this.auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    this.calendar = google.calendar({ version: "v3", auth: this.auth });
  }

  async loadToken(): Promise<boolean> {
    try {
      const content = await fs.readFile(TOKEN_PATH, "utf-8");
      const token = JSON.parse(content);
      this.auth.setCredentials(token);
      return true;
    } catch (err) {
      return false;
    }
  }

  generateAuthUrl(): string {
    return this.auth.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
    });
  }

  async saveToken(code: string): Promise<void> {
    const { tokens } = await this.auth.getToken(code);
    this.auth.setCredentials(tokens);

    try {
      await fs.mkdir(TOKEN_DIR, { recursive: true });
      await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens));
    } catch (err) {
      console.error("Error saving token:", err);
    }
  }

  async listEvents(timeMin: string, timeMax: string) {
    const res = await this.calendar.events.list({
      calendarId: "primary",
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
    });
    return res.data.items || [];
  }

  async createEvent(event: any) {
    return await this.calendar.events.insert({
      calendarId: "primary",
      requestBody: event,
    });
  }

  async updateEvent(eventId: string, event: any) {
    return await this.calendar.events.update({
      calendarId: "primary",
      eventId: eventId,
      requestBody: event,
    });
  }

  async deleteEvent(eventId: string) {
    try {
      await this.calendar.events.delete({
        calendarId: "primary",
        eventId: eventId,
      });
    } catch (e) {
      console.error(`Failed to delete event ${eventId}`, e);
    }
  }

  async syncEvents(
    aurionEvents: import("../utils/PlanningParser").AurionEvent[],
  ) {
    if (aurionEvents.length === 0) return;

    const timestamps = aurionEvents.flatMap((e) => [
      new Date(e.start).getTime(),
      new Date(e.end).getTime(),
    ]);
    const minTime = new Date(Math.min(...timestamps)).toISOString();
    const maxTime = new Date(Math.max(...timestamps)).toISOString();

    console.log(`Syncing range: ${minTime} to ${maxTime}`);
    const existingEvents = await this.listEvents(minTime, maxTime);

    const processedGoogleEventIds = new Set<string>();

    for (const aurionEvent of aurionEvents) {
      const startTime = new Date(aurionEvent.start).toISOString();
      const endTime = new Date(aurionEvent.end).toISOString();
      const summary = aurionEvent.subject
        ? `${aurionEvent.courseType || "Cours"} - ${aurionEvent.subject}`
        : aurionEvent.title;

      const description = `Teacher: ${aurionEvent.teacher || "N/A"}\nAurionID: ${aurionEvent.id}`;

      const eventPayload = {
        summary: summary,
        location: aurionEvent.room,
        description: description,
        start: {
          dateTime: startTime,
          timeZone: "Europe/Paris",
        },
        end: {
          dateTime: endTime,
          timeZone: "Europe/Paris",
        },
        extendedProperties: {
          private: {
            aurionId: aurionEvent.id,
          },
        },
      };

      let match = existingEvents.find(
        (e) =>
          !processedGoogleEventIds.has(e.id!) &&
          e.extendedProperties?.private?.aurionId === aurionEvent.id,
      );

      if (match) {
        console.log(`Updating event: ${summary} (ID: ${match.id})`);
        await this.updateEvent(match.id!, eventPayload);
        processedGoogleEventIds.add(match.id!);
      } else {
        console.log(`Creating event: ${summary}`);
        await this.createEvent(eventPayload);
      }
    }

    for (const e of existingEvents) {
      if (!e.id || processedGoogleEventIds.has(e.id)) continue;

      const isAurionEvent =
        e.extendedProperties?.private?.aurionId ||
        e.description?.includes("AurionID:");

      if (isAurionEvent) {
        console.log(
          `Deleting stale/duplicate event: ${e.summary} (ID: ${e.id})`,
        );
        await this.deleteEvent(e.id);
      }
    }
  }

  async deleteAurionEvents(start: string, end: string) {
    console.log(`Deleting Aurion events from ${start} to ${end}`);
    const events = await this.listEvents(start, end);
    let deletedCount = 0;

    for (const event of events) {
      if (!event.id) continue;

      const isAurionEvent =
        event.extendedProperties?.private?.aurionId ||
        event.description?.includes("AurionID:");

      if (isAurionEvent) {
        console.log(`Deleting event: ${event.summary} (${event.id})`);
        await this.deleteEvent(event.id);
        deletedCount++;
      }
    }
    return deletedCount;
  }
}
