/**
 * Glossary index. The list only holds ids and string keys; every player-facing
 * word lives in the string table so writers can edit it without touching code.
 */

export const GLOSSARY = [
  { id: 'dose', termKey: 'glossary.dose.term', definitionKey: 'glossary.dose.definition', related: ['msv', 'gcr', 'spe'] },
  { id: 'msv', termKey: 'glossary.msv.term', definitionKey: 'glossary.msv.definition', related: ['dose'] },
  { id: 'microgravity', termKey: 'glossary.microgravity.term', definitionKey: 'glossary.microgravity.definition', related: [] },
  { id: 'lunar_day', termKey: 'glossary.lunar_day.term', definitionKey: 'glossary.lunar_day.definition', related: [] },
  { id: 'spe', termKey: 'glossary.spe.term', definitionKey: 'glossary.spe.definition', related: ['dose'] },
  { id: 'gcr', termKey: 'glossary.gcr.term', definitionKey: 'glossary.gcr.definition', related: ['dose'] },
  { id: 'regolith', termKey: 'glossary.regolith.term', definitionKey: 'glossary.regolith.definition', related: [] },
  { id: 'eva', termKey: 'glossary.eva.term', definitionKey: 'glossary.eva.definition', related: ['dose'] },
  { id: 'dsn', termKey: 'glossary.dsn.term', definitionKey: 'glossary.dsn.definition', related: [] },
  { id: 'hydroponics', termKey: 'glossary.hydroponics.term', definitionKey: 'glossary.hydroponics.definition', related: [] },
];

export const GLOSSARY_BY_ID = Object.fromEntries(GLOSSARY.map((entry) => [entry.id, entry]));
