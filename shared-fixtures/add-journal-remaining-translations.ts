// Adds real Hebrew/Arabic translations for the strings directly
// requested, plus several more genuinely hardcoded strings found in
// the same screen while fixing those - all in frontend/src/routes/post
// and the top-bar header.
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { readCsv, writeCsv } from './csv.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const csvPath = path.join(here, 'translations.csv');
const existing = readCsv(fs.readFileSync(csvPath, 'utf-8'));

const translations: Record<string, { hebrew: string; arabic: string }> = {
  'Log out': { hebrew: 'התנתקות', arabic: 'تسجيل الخروج' },
  'Change password': { hebrew: 'שינוי סיסמה', arabic: 'تغيير كلمة المرور' },
  'Actual': { hebrew: 'בפועל', arabic: 'الفعلي' },
  'Period open': { hebrew: 'התקופה פתוחה', arabic: 'الفترة مفتوحة' },
  'Closed through': { hebrew: 'סגורה עד', arabic: 'مغلقة حتى' },
  'manage': { hebrew: 'ניהול', arabic: 'إدارة' },
  'Reference': { hebrew: 'אסמכתא', arabic: 'المرجع' },
  'optional': { hebrew: 'לא חובה', arabic: 'اختياري' },
  'Press Insert to add a line; Delete on an empty field or the account picker to remove one.': {
    hebrew: 'הקישו Insert להוספת שורה; Delete בשדה ריק או בבורר החשבון להסרתה.',
    arabic: 'اضغط Insert لإضافة سطر؛ اضغط Delete في حقل فارغ أو في محدد الحساب لإزالته.',
  },
  'Add at least two lines to begin.': { hebrew: 'הוסיפו לפחות שתי שורות כדי להתחיל.', arabic: 'أضف سطرين على الأقل للبدء.' },
  'Balanced': { hebrew: 'מאוזן', arabic: 'متوازن' },
  'Pick an account for every line to finish.': { hebrew: 'בחרו חשבון לכל שורה כדי לסיים.', arabic: 'اختر حسابًا لكل سطر للإنهاء.' },
  'Out of balance by': { hebrew: 'לא מאוזן בסך', arabic: 'غير متوازن بمقدار' },
  'falls within a closed period (through': { hebrew: 'נופל בתוך תקופה סגורה (עד', arabic: 'يقع ضمن فترة مغلقة (حتى' },
  'this will be rejected unless the period is reopened first.': {
    hebrew: 'הרישום יידחה אלא אם התקופה תיפתח מחדש קודם.',
    arabic: 'سيتم رفض هذا ما لم يتم إعادة فتح الفترة أولاً.',
  },
};

const merged = new Map(existing.map((r) => [r.concept + '|' + r.language, r]));
let added = 0;
for (const [concept, { hebrew, arabic }] of Object.entries(translations)) {
  for (const [language, text] of [['Hebrew', hebrew], ['Arabic', arabic]] as const) {
    const key = concept + '|' + language;
    if (!merged.has(key)) {
      merged.set(key, { concept, language, text });
      added++;
    }
  }
}
fs.writeFileSync(csvPath, writeCsv(Array.from(merged.values()), ['concept', 'language', 'text']));
console.log(`Added ${added} real, new Hebrew/Arabic translations for the requested and newly-found strings.`);
