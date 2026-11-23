/*
 * Kalender: erstellt eine .ics-Datei (iCalendar, RFC 5545) direkt im Browser.
 * Die Datei funktioniert mit iPhone/iPad, Android, Google Kalender, Outlook und Thunderbird.
 * Es wird nichts gesendet: kein Konto, kein fremder Dienst, kein Tracking.
 */
(function (root) {
    "use strict";

    // Zeitzone Berlin (Sommer- und Winterzeit), damit Uhrzeiten überall richtig ankommen
    var ZEITZONE = [
        "BEGIN:VTIMEZONE",
        "TZID:Europe/Berlin",
        "BEGIN:DAYLIGHT",
        "TZOFFSETFROM:+0100",
        "TZOFFSETTO:+0200",
        "TZNAME:CEST",
        "DTSTART:19700329T020000",
        "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
        "END:DAYLIGHT",
        "BEGIN:STANDARD",
        "TZOFFSETFROM:+0200",
        "TZOFFSETTO:+0100",
        "TZNAME:CET",
        "DTSTART:19701025T030000",
        "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
        "END:STANDARD",
        "END:VTIMEZONE"
    ];

    function textSicher(text) {
        return String(text || "")
            .replace(/\\/g, "\\\\")
            .replace(/;/g, "\\;")
            .replace(/,/g, "\\,")
            .replace(/\r?\n/g, "\\n");
    }

    // Zeilen länger als 75 Byte werden umgebrochen (Folgezeile beginnt mit Leerzeichen)
    function falten(zeile) {
        var teile = [];
        var aktuell = "";
        var bytes = 0;
        for (var i = 0; i < zeile.length; i++) {
            var zeichen = zeile[i];
            var code = zeile.charCodeAt(i);
            // Ersatzpaare (Emoji) nicht trennen
            if (code >= 0xd800 && code <= 0xdbff && i + 1 < zeile.length) {
                zeichen += zeile[++i];
            }
            var laenge = unescape(encodeURIComponent(zeichen)).length;
            var grenze = teile.length ? 74 : 75;
            if (bytes + laenge > grenze) {
                teile.push(aktuell);
                aktuell = "";
                bytes = 0;
            }
            aktuell += zeichen;
            bytes += laenge;
        }
        teile.push(aktuell);
        return teile.join("\r\n ");
    }

    function nurZiffern(iso) {
        return String(iso).replace(/[^0-9]/g, "");
    }

    function zeitstempel(jetzt) {
        return jetzt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    }

    function naechsterTag(iso) {
        var d = new Date(iso + "T00:00:00Z");
        d.setUTCDate(d.getUTCDate() + 1);
        return d.toISOString().slice(0, 10);
    }

    function plusStunden(uhrzeit, stunden) {
        var t = uhrzeit.split(":");
        var h = Math.min(23, Number(t[0]) + stunden);
        return ("0" + h).slice(-2) + ":" + (t[1] || "00");
    }

    // Kurzer, stabiler Hash: derselbe Termin bekommt immer dieselbe UID (keine Doppelten beim erneuten Import)
    function hash(text) {
        var h = 5381;
        for (var i = 0; i < text.length; i++) {
            h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
        }
        return h.toString(36);
    }

    function uhrzeitGueltig(u) {
        return typeof u === "string" && /^\d{1,2}:\d{2}$/.test(u);
    }

    /*
     * termin: {
     *   titel, datum ("2027-01-23"), bis (optional, letzter Tag, ganztägig),
     *   von / ende (optional, "10:00" / "13:00"), ort, beschreibung, link
     * }
     */
    function ereignis(termin, jetzt) {
        var zeilen = ["BEGIN:VEVENT"];
        var schluessel = [termin.titel, termin.datum, termin.von || "", termin.ort || ""].join("|");
        zeilen.push("UID:" + hash(schluessel) + "-" + nurZiffern(termin.datum) + "@oberschul-helfer-berlin");
        zeilen.push("DTSTAMP:" + zeitstempel(jetzt));
        if (uhrzeitGueltig(termin.von)) {
            var ende = uhrzeitGueltig(termin.ende) && termin.ende > termin.von ? termin.ende : plusStunden(termin.von, 2);
            var tag = nurZiffern(termin.datum);
            zeilen.push("DTSTART;TZID=Europe/Berlin:" + tag + "T" + nurZiffern(("0" + termin.von).slice(-5)) + "00");
            zeilen.push("DTEND;TZID=Europe/Berlin:" + tag + "T" + nurZiffern(("0" + ende).slice(-5)) + "00");
        } else {
            zeilen.push("DTSTART;VALUE=DATE:" + nurZiffern(termin.datum));
            zeilen.push("DTEND;VALUE=DATE:" + nurZiffern(naechsterTag(termin.bis || termin.datum)));
            zeilen.push("TRANSP:TRANSPARENT");
        }
        zeilen.push("SUMMARY:" + textSicher(termin.titel));
        if (termin.ort) zeilen.push("LOCATION:" + textSicher(termin.ort));
        var beschreibung = [termin.beschreibung, termin.link].filter(Boolean).join("\n");
        if (beschreibung) zeilen.push("DESCRIPTION:" + textSicher(beschreibung));
        if (termin.link) zeilen.push("URL:" + termin.link.replace(/[\r\n]/g, ""));
        // Erinnerung einen Tag vorher
        zeilen.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + textSicher(termin.titel), "TRIGGER:-P1D", "END:VALARM");
        zeilen.push("END:VEVENT");
        return zeilen;
    }

    function erstelleIcs(termine, jetzt) {
        jetzt = jetzt || new Date();
        var zeilen = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Oberschul-Helfer Berlin//DE",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH"
        ];
        if (termine.some(function (x) { return uhrzeitGueltig(x.von); })) {
            zeilen = zeilen.concat(ZEITZONE);
        }
        termine.forEach(function (termin) {
            zeilen = zeilen.concat(ereignis(termin, jetzt));
        });
        zeilen.push("END:VCALENDAR");
        return zeilen.map(falten).join("\r\n") + "\r\n";
    }

    function dateiname(text) {
        var name = String(text || "termine")
            .normalize("NFD").replace(/[̀-ͯ]/g, "")
            .replace(/ß/g, "ss")
            .replace(/[^A-Za-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .toLowerCase()
            .slice(0, 60);
        return (name || "termine") + ".ics";
    }

    // Startet den Download im Browser (Datei öffnet sich dann im Kalender)
    function herunterladen(termine, name) {
        var inhalt = erstelleIcs(termine);
        var blob = new Blob([inhalt], { type: "text/calendar;charset=utf-8" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = dateiname(name);
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    }

    var api = { erstelleIcs: erstelleIcs, dateiname: dateiname, herunterladen: herunterladen, falten: falten };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    } else {
        root.Kalender = api;
    }
})(this);
