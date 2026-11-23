/*
 * Filter für die Schulsuche: Schwerpunkt, Fremdsprachen und Besonderes.
 * Grundlage sind nur die Angaben aus dem Berliner Schulverzeichnis
 * (data/schulinfos.js, Felder sp = Sprachen, pr = Profil, bm = Bemerkungen, gt = Ganztag).
 *
 * Regel: Innerhalb einer Gruppe reicht eine Übereinstimmung (Musik ODER Kunst),
 * zwischen den Gruppen muss alles passen (MINT UND Spanisch).
 */
(function (root) {
    "use strict";

    function text(info) {
        return [info.pr || "", info.bm || ""].join(" | ");
    }

    function profil(re) {
        return function (info) { return re.test(text(info)); };
    }

    // Fremdsprachen stehen im Feld sp, z. B. "2. Fremdsprache Spanisch" oder "S2 Englisch/Latein".
    function sprachen(info) {
        var liste = {};
        String(info.sp || "").split(/,\s*/).forEach(function (teil) {
            var m = teil.match(/Fremdsprache\s+(.+)$/) || teil.match(/^S\d+\s+(.+)$/) ||
                teil.match(/ab Klasse \d+\s+(.+)$/);
            if (!m) return;
            m[1].split("/").forEach(function (s) { liste[s.trim()] = true; });
        });
        return liste;
    }

    function sprache(name) {
        return function (info) { return !!sprachen(info)[name]; };
    }

    var GRUPPEN = [
        {
            id: "schwerpunkt", text: "flt_g_focus",
            optionen: [
                { id: "mint", text: "flt_mint", passt: profil(/mathematisch-naturwissenschaftlich|MINT/i) },
                { id: "it", text: "flt_it", passt: profil(/Informationstechnik|Informatik/i) },
                { id: "musik", text: "flt_music", passt: profil(/musikbetont/i) },
                { id: "kunst", text: "flt_art", passt: profil(/kunstbetont/i) },
                { id: "theater", text: "flt_theatre", passt: profil(/theaterbetont/i) },
                { id: "sport", text: "flt_sport", passt: profil(/sportbetont|Leistungssport/i) },
                { id: "sprachen", text: "flt_languages", passt: profil(/sprachbetont|altsprachlich/i) },
                { id: "medien", text: "flt_media", passt: profil(/medienbetont/i) },
                { id: "beruf", text: "flt_job", passt: profil(/berufsorientiert|Dualen Lernens|Wirtschaft-Arbeit-Technik/i) }
            ]
        },
        {
            id: "sprache", text: "flt_g_lang",
            optionen: ["Englisch", "Französisch", "Spanisch", "Latein", "Russisch", "Italienisch",
                "Chinesisch", "Türkisch", "Altgriechisch", "Japanisch"].map(function (n) {
                return { id: n, name: n, passt: sprache(n) };
            })
        },
        {
            id: "besonderes", text: "flt_g_special",
            optionen: [
                { id: "ab5", text: "flt_from5", passt: profil(/ab Jahrgangsstufe 5|Latein ab Jahrgangsstufe 5|grundständig/i) },
                { id: "bili", text: "flt_bilingual", passt: profil(/bilingual|Europa-Schule/i) },
                { id: "europa", text: "flt_europe", passt: profil(/Staatliche Europa-Schule/i) },
                { id: "ganztag", text: "flt_allday", passt: function (info) { return info.gt === "gebunden"; } },
                { id: "begabt", text: "flt_gifted", passt: profil(/Hochbegabten|Begabtengruppen/i) }
            ]
        }
    ];

    var OPTION = {};
    GRUPPEN.forEach(function (g) {
        g.optionen.forEach(function (o) { o.gruppe = g.id; OPTION[g.id + ":" + o.id] = o; });
    });

    // auswahl: Liste von Schlüsseln "gruppe:id"
    function passt(info, auswahl) {
        if (!auswahl || auswahl.length === 0) return true;
        if (!info) return false;
        var proGruppe = {};
        auswahl.forEach(function (schluessel) {
            var o = OPTION[schluessel];
            if (!o) return;
            (proGruppe[o.gruppe] = proGruppe[o.gruppe] || []).push(o);
        });
        return Object.keys(proGruppe).every(function (g) {
            return proGruppe[g].some(function (o) { return o.passt(info); });
        });
    }

    var api = { GRUPPEN: GRUPPEN, OPTION: OPTION, passt: passt, sprachen: sprachen };

    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    } else {
        root.SchulFilter = api;
    }
})(this);
