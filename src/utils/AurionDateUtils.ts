export class AurionDateUtils {
  static getMonday(d: Date): Date {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    date.setDate(diff);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  static toDateString(d: Date): string {
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  static toWeekString(d: Date): string {
    const date = new Date(d.valueOf());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
    const week1 = new Date(date.getFullYear(), 0, 4);
    const weekNumber =
      1 +
      Math.round(
        ((date.getTime() - week1.getTime()) / 86400000 -
          3 +
          ((week1.getDay() + 6) % 7)) /
          7,
      );

    return `${weekNumber}-${date.getFullYear()}`;
  }

  static getWeekParams(date: Date) {
    const monday = this.getMonday(date);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return {
      startMs: monday.getTime(),
      endMs: sunday.getTime(),
      dateStr: this.toDateString(monday),
      weekStr: this.toWeekString(monday),
      view: "agendaWeek",
    };
  }

  static getMonthParams(date: Date) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);

    const end = new Date(start);
    end.setDate(start.getDate() + 45);

    return {
      startMs: start.getTime(),
      endMs: end.getTime(),
      dateStr: this.toDateString(start),
      weekStr: this.toWeekString(start),
      view: "month",
    };
  }
}
