// Adds real Hebrew/Arabic translations for every remaining real
// string the General Journal form (frontend/src/routes/post) uses,
// per direct request - appends to the single, shared translations.csv.
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { readCsv, writeCsv } from './csv.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const csvPath = path.join(here, 'translations.csv');
const existing = readCsv(fs.readFileSync(csvPath, 'utf-8'));

const journalTranslations: Record<string, { hebrew: string; arabic: string }> = {
  'Account': { hebrew: 'חשבון', arabic: 'الحساب' },
  'Debit': { hebrew: 'חובה', arabic: 'مدين' },
  'Credit': { hebrew: 'זכות', arabic: 'دائن' },
  'Total': { hebrew: 'סך הכל', arabic: 'الإجمالي' },
  'Description': { hebrew: 'תיאור', arabic: 'الوصف' },
  'Date': { hebrew: 'תאריך', arabic: 'التاريخ' },
  'Start Date': { hebrew: 'תאריך התחלה', arabic: 'تاريخ البدء' },
  'Cancel': { hebrew: 'ביטול', arabic: 'إلغاء' },
  'Memo': { hebrew: 'הערה', arabic: 'مذكرة' },
  'Save': { hebrew: 'שמירה', arabic: 'حفظ' },
  'Monthly': { hebrew: 'חודשי', arabic: 'شهري' },
  'Number of occurrences': { hebrew: 'מספר הופעות', arabic: 'عدد المرات' },
  'Once': { hebrew: 'פעם אחת', arabic: 'مرة واحدة' },
  'Recurrence': { hebrew: 'חזרתיות', arabic: 'التكرار' },
  'Weekly': { hebrew: 'שבועי', arabic: 'أسبوعي' },
  'Yearly': { hebrew: 'שנתי', arabic: 'سنوي' },
  'A direct, multi-line entry into the ledger — debits and credits across any accounts, balanced to zero. Fill in the header fields, add lines until the entry balances, then Save.': {
    hebrew: 'רשומה ישירה ורב-שורתית בפנקס — חובה וזכות על פני כל חשבון, מאוזנים לאפס. מלאו את שדות הכותרת, הוסיפו שורות עד שהרשומה מאוזנת, ולאחר מכן שמרו.',
    arabic: 'قيد مباشر متعدد السطور في دفتر الأستاذ — مدين ودائن عبر أي حسابات، متوازن إلى صفر. املأ حقول الترويسة، أضف سطورًا حتى يتوازن القيد، ثم احفظ.',
  },
};

const merged = new Map(existing.map((r) => [r.concept + '|' + r.language, r]));
let added = 0;
for (const [concept, { hebrew, arabic }] of Object.entries(journalTranslations)) {
  for (const [language, text] of [['Hebrew', hebrew], ['Arabic', arabic]] as const) {
    const key = concept + '|' + language;
    if (!merged.has(key)) {
      merged.set(key, { concept, language, text });
      added++;
    }
  }
}
fs.writeFileSync(csvPath, writeCsv(Array.from(merged.values()), ['concept', 'language', 'text']));
console.log(`Added ${added} real, new Hebrew/Arabic General Journal translations.`);
