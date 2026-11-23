const test = require("node:test");
const assert = require("node:assert/strict");
const Kalender = require("../js/kalender.js");

const jetzt = new Date("2026-11-23T10:00:00Z");

test("Termin mit Uhrzeit: Berliner Zeitzone, Ende und Erinnerung", () => {
    const ics = Kalender.erstelleIcs([{
        titel: "Tag der offenen Tür – Schadow-Gymnasium",
        datum: "2027-01-23", von: "10:30", ende: "13:00",
        ort: "Beuckestraße 27, 14163 Berlin", beschreibung: "Bitte prüfen", link: "https://example.org/a"
    }], jetzt);
    assert.match(ics, /^BEGIN:VCALENDAR\r\nVERSION:2\.0\r\n/);
    assert.match(ics, /BEGIN:VTIMEZONE\r\nTZID:Europe\/Berlin/);
    assert.match(ics, /DTSTART;TZID=Europe\/Berlin:20270123T103000\r\n/);
    assert.match(ics, /DTEND;TZID=Europe\/Berlin:20270123T130000\r\n/);
    assert.match(ics, /LOCATION:Beuckestraße 27\\, 14163 Berlin\r\n/);
    assert.match(ics, /DTSTAMP:20261123T100000Z\r\n/);
    assert.match(ics, /TRIGGER:-P1D/);
    assert.match(ics, /END:VCALENDAR\r\n$/);
});

test("Ohne Ende dauert ein Termin 2 Stunden", () => {
    const ics = Kalender.erstelleIcs([{ titel: "Infoabend", datum: "2027-01-15", von: "18:00" }], jetzt);
    assert.match(ics, /DTEND;TZID=Europe\/Berlin:20270115T200000/);
});

test("Ohne Uhrzeit: ganztägig, mehrtägig mit exklusivem Ende", () => {
    const ics = Kalender.erstelleIcs([
        { titel: "Tag der offenen Tür", datum: "2027-01-15" },
        { titel: "Anmeldung", datum: "2027-03-03", bis: "2027-03-11" }
    ], jetzt);
    assert.doesNotMatch(ics, /VTIMEZONE/);
    assert.match(ics, /DTSTART;VALUE=DATE:20270115\r\nDTEND;VALUE=DATE:20270116/);
    assert.match(ics, /DTSTART;VALUE=DATE:20270303\r\nDTEND;VALUE=DATE:20270312/);
    assert.equal(ics.match(/BEGIN:VEVENT/g).length, 2);
});

test("Lange Zeilen werden auf 75 Byte gefaltet, auch mit Umlauten und Arabisch", () => {
    const titel = "أمسية معلومات ".repeat(10) + "Grüße";
    const ics = Kalender.erstelleIcs([{ titel, datum: "2027-01-15" }], jetzt);
    for (const zeile of ics.split("\r\n")) {
        assert.ok(Buffer.byteLength(zeile, "utf8") <= 75, zeile);
    }
    const entfaltet = ics.replace(/\r\n /g, "");
    assert.ok(entfaltet.includes("SUMMARY:" + titel));
});

test("Gleicher Termin bekommt immer dieselbe UID", () => {
    const t = { titel: "Tag der offenen Tür – X", datum: "2027-01-15" };
    const uid = (ics) => ics.match(/UID:(.*)\r\n/)[1];
    assert.equal(uid(Kalender.erstelleIcs([t], jetzt)), uid(Kalender.erstelleIcs([t], new Date())));
});

test("Dateiname ohne Sonderzeichen", () => {
    assert.equal(Kalender.dateiname("Tag der offenen Tür – Schüler-Straße 2027-01-15"), "tag-der-offenen-tur-schuler-strasse-2027-01-15.ics");
    assert.equal(Kalender.dateiname("أمسية"), "termine.ics");
});

test("Google-Link: Uhrzeit mit Berliner Zeitzone, ganztägig mit exklusivem Ende", () => {
    const g = new URL(Kalender.googleLink({ titel: "Tag der offenen Tür", datum: "2027-01-23", von: "10:30", ende: "13:00", ort: "Beuckestraße 27" }));
    assert.equal(g.hostname, "calendar.google.com");
    assert.equal(g.searchParams.get("action"), "TEMPLATE");
    assert.equal(g.searchParams.get("dates"), "20270123T103000/20270123T130000");
    assert.equal(g.searchParams.get("ctz"), "Europe/Berlin");
    assert.equal(g.searchParams.get("location"), "Beuckestraße 27");
    const ganz = new URL(Kalender.googleLink({ titel: "Anmeldung", datum: "2027-03-03", bis: "2027-03-11" }));
    assert.equal(ganz.searchParams.get("dates"), "20270303/20270312");
    assert.equal(ganz.searchParams.get("ctz"), null);
});

test("Outlook-Links: Zeitversatz für Winter- und Sommerzeit", () => {
    const w = new URL(Kalender.outlookLink({ titel: "Infoabend", datum: "2027-01-15", von: "18:00" }, "live"));
    assert.equal(w.hostname, "outlook.live.com");
    assert.equal(w.searchParams.get("startdt"), "2027-01-15T18:00:00+01:00");
    assert.equal(w.searchParams.get("enddt"), "2027-01-15T20:00:00+01:00");
    assert.equal(w.searchParams.get("allday"), "false");
    const s = new URL(Kalender.outlookLink({ titel: "Infoabend", datum: "2027-06-15", von: "18:00" }, "office"));
    assert.equal(s.hostname, "outlook.office.com");
    assert.equal(s.searchParams.get("startdt"), "2027-06-15T18:00:00+02:00");
    const g = new URL(Kalender.outlookLink({ titel: "Probeunterricht", datum: "2027-02-19" }, "live"));
    assert.equal(g.searchParams.get("allday"), "true");
    assert.equal(g.searchParams.get("enddt"), "2027-02-20");
});

test("Umstellung Sommer-/Winterzeit wird richtig erkannt", () => {
    assert.equal(Kalender.berlinVersatz("2027-03-28", "01:00"), "+01:00");
    assert.equal(Kalender.berlinVersatz("2027-03-28", "03:00"), "+02:00");
    assert.equal(Kalender.berlinVersatz("2026-10-25", "02:30"), "+02:00");
    assert.equal(Kalender.berlinVersatz("2026-10-25", "03:00"), "+01:00");
    assert.equal(Kalender.berlinVersatz("2026-12-05", "10:00"), "+01:00");
});

test("iPhone und iPad werden erkannt", () => {
    assert.ok(Kalender.istApple({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" }));
    assert.ok(Kalender.istApple({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", maxTouchPoints: 5 }));
    assert.ok(!Kalender.istApple({ userAgent: "Mozilla/5.0 (Linux; Android 14)" }));
});
