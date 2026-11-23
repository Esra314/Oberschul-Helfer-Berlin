const test = require("node:test");
const assert = require("node:assert/strict");
const F = require("../js/filter.js");

const musikSpanisch = {
    sp: "1. Fremdsprache Englisch, 2. Fremdsprache Spanisch, S2 Englisch/Latein",
    pr: "musikbetontes Profil, ab Jahrgangsstufe 5 beginnende Züge",
    gt: "offen"
};
const mintGanztag = {
    sp: "1. Fremdsprache Englisch, 2. Fremdsprache Französisch",
    pr: "mathematisch-naturwissenschaftliches Profil",
    gt: "gebunden"
};

test("Fremdsprachen werden aus dem Schulverzeichnis gelesen (auch Sprachenfolge S2)", () => {
    assert.deepEqual(Object.keys(F.sprachen(musikSpanisch)).sort(), ["Englisch", "Latein", "Spanisch"]);
});

test("Ohne Auswahl passen alle Schulen, auch ohne Angaben", () => {
    assert.equal(F.passt(undefined, []), true);
    assert.equal(F.passt(mintGanztag, []), true);
});

test("Innerhalb einer Gruppe reicht eine Übereinstimmung", () => {
    const wahl = ["schwerpunkt:musik", "schwerpunkt:mint"];
    assert.equal(F.passt(musikSpanisch, wahl), true);
    assert.equal(F.passt(mintGanztag, wahl), true);
});

test("Zwischen Gruppen muss alles passen", () => {
    const wahl = ["schwerpunkt:mint", "sprache:Spanisch"];
    assert.equal(F.passt(musikSpanisch, wahl), false);
    assert.equal(F.passt(mintGanztag, wahl), false);
    assert.equal(F.passt(musikSpanisch, ["schwerpunkt:musik", "sprache:Latein", "besonderes:ab5"]), true);
});

test("Ganztag (gebunden) und Schulen ohne Angaben", () => {
    assert.equal(F.passt(mintGanztag, ["besonderes:ganztag"]), true);
    assert.equal(F.passt(musikSpanisch, ["besonderes:ganztag"]), false);
    assert.equal(F.passt(undefined, ["sprache:Englisch"]), false);
});

test("Jede Filter-Option trifft in den echten Daten mindestens eine Schule", () => {
    global.window = {};
    require("../data/schulinfos.js");
    const infos = Object.values(global.window.SCHULINFOS.schulen);
    F.GRUPPEN.forEach((g) => g.optionen.forEach((o) => {
        assert.ok(infos.some((i) => o.passt(i)), `${g.id}:${o.id} findet keine Schule`);
    }));
});
