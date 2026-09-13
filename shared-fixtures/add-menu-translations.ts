// Adds real Hebrew and Arabic translations for every real menu
// section/link label, per direct request - appends to the single,
// shared translations.csv, matching the exact same format/mechanism
// as every other translation.
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { readCsv, writeCsv } from './csv.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const csvPath = path.join(here, 'translations.csv');
const existing = readCsv(fs.readFileSync(csvPath, 'utf-8'));

const menuTranslations: Record<string, { hebrew: string; arabic: string }> = {
  'Accounting Periods': { hebrew: 'תקופות חשבונאיות', arabic: 'الفترات المحاسبية' },
  'Accounts Payable (Creditors / Purchasing)': { hebrew: 'חשבונות לתשלום (נושים / רכש)', arabic: 'الحسابات الدائنة (الدائنون / المشتريات)' },
  'Accounts Receivable (Debtors / Sales)': { hebrew: 'חשבונות לקבל (חייבים / מכירות)', arabic: 'الحسابات المدينة (المدينون / المبيعات)' },
  'Aged Payables': { hebrew: 'גיול תשלומים', arabic: 'أعمار الدائنين' },
  'Aged Receivables': { hebrew: 'גיול חייבים', arabic: 'أعمار المدينين' },
  'Balance Sheet': { hebrew: 'מאזן', arabic: 'الميزانية العمومية' },
  'Below Reorder': { hebrew: 'מתחת לנקודת ההזמנה', arabic: 'أقل من نقطة إعادة الطلب' },
  'Business Setup': { hebrew: 'הגדרת העסק', arabic: 'إعداد النشاط التجاري' },
  'Cash': { hebrew: 'מזומן', arabic: 'النقد' },
  'Cash Flow Forecast': { hebrew: 'תחזית תזרים מזומנים', arabic: 'توقعات التدفق النقدي' },
  'Cash Purchase': { hebrew: 'רכישה במזומן', arabic: 'شراء نقدي' },
  'Cash Sale': { hebrew: 'מכירה במזומן', arabic: 'بيع نقدي' },
  'Compare Ledgers': { hebrew: 'השוואת פנקסים', arabic: 'مقارنة دفاتر الأستاذ' },
  'Customer Statement': { hebrew: 'דוח לקוח', arabic: 'كشف حساب العميل' },
  'Customers': { hebrew: 'לקוחות', arabic: 'العملاء' },
  'Employee Directory': { hebrew: 'מדריך עובדים', arabic: 'دليل الموظفين' },
  'Entity Tree': { hebrew: 'עץ הישויות', arabic: 'شجرة الكيانات' },
  'General Journal': { hebrew: 'יומן כללי', arabic: 'اليومية العامة' },
  'General Ledger': { hebrew: 'פנקס חשבונות כללי', arabic: 'دفتر الأستاذ العام' },
  'HR': { hebrew: 'משאבי אנוש', arabic: 'الموارد البشرية' },
  'Hierarchies': { hebrew: 'היררכיות', arabic: 'التسلسلات الهرمية' },
  'Inventory Catalog': { hebrew: 'קטלוג מלאי', arabic: 'كتالوج المخزون' },
  'Inventory Listing': { hebrew: 'רשימת מלאי', arabic: 'قائمة المخزون' },
  'Journal Entries': { hebrew: 'רשומות יומן', arabic: 'قيود اليومية' },
  'Locations': { hebrew: 'מיקומים', arabic: 'المواقع' },
  'Logistics': { hebrew: 'לוגיסטיקה', arabic: 'اللوجستيات' },
  'Manufacturers': { hebrew: 'יצרנים', arabic: 'الشركات المصنعة' },
  'New Business': { hebrew: 'עסק חדש', arabic: 'نشاط تجاري جديد' },
  'Payment': { hebrew: 'תשלום', arabic: 'دفعة' },
  'Payroll': { hebrew: 'שכר', arabic: 'كشوف المرتبات' },
  'Profit and Loss': { hebrew: 'רווח והפסד', arabic: 'الأرباح والخسائر' },
  'Projects & Jobs': { hebrew: 'פרויקטים ועבודות', arabic: 'المشاريع والوظائف' },
  'Purchase': { hebrew: 'רכישה', arabic: 'شراء' },
  'Purchase Invoices': { hebrew: 'חשבוניות רכש', arabic: 'فواتير الشراء' },
  'Purchase Order': { hebrew: 'הזמנת רכש', arabic: 'أمر شراء' },
  'Receipt': { hebrew: 'קבלה', arabic: 'إيصال' },
  'Reminders': { hebrew: 'תזכורות', arabic: 'التذكيرات' },
  'Restock Retail Outlets': { hebrew: 'חידוש מלאי לחנויות', arabic: 'إعادة تخزين منافذ البيع' },
  'Sale': { hebrew: 'מכירה', arabic: 'بيع' },
  'Sales Invoices': { hebrew: 'חשבוניות מכירה', arabic: 'فواتير البيع' },
  'Sales Order': { hebrew: 'הזמנת מכירה', arabic: 'أمر بيع' },
  'Sales Report': { hebrew: 'דוח מכירות', arabic: 'تقرير المبيعات' },
  'Shipping': { hebrew: 'משלוח', arabic: 'الشحن' },
  'Stock Dispatch': { hebrew: 'ניפוק מלאי', arabic: 'صرف المخزون' },
  'Stock Movement Report': { hebrew: 'דוח תנועת מלאי', arabic: 'تقرير حركة المخزون' },
  'Stock Receipt': { hebrew: 'קבלת מלאי', arabic: 'استلام المخزون' },
  'Stock Take': { hebrew: 'ספירת מלאי', arabic: 'جرد المخزون' },
  'Stock Transfer': { hebrew: 'העברת מלאי', arabic: 'نقل المخزون' },
  'Stock-Out Risk': { hebrew: 'סיכון אזילת מלאי', arabic: 'مخاطر نفاد المخزون' },
  'Structured Editor': { hebrew: 'עורך מובנה', arabic: 'المحرر المنظم' },
  'Trial Balance': { hebrew: 'מאזן בוחן', arabic: 'ميزان المراجعة' },
  'Users': { hebrew: 'משתמשים', arabic: 'المستخدمون' },
  'Vendors': { hebrew: 'ספקים', arabic: 'الموردون' },
  'Vouchers': { hebrew: 'שוברים', arabic: 'السندات' },
  'Warehouses': { hebrew: 'מחסנים', arabic: 'المستودعات' },
  'Write-offs & Expiration': { hebrew: 'מחיקות ותפוגה', arabic: 'الشطب وانتهاء الصلاحية' },
  'Year End Close': { hebrew: 'סגירת שנת כספים', arabic: 'إغلاق نهاية السنة' },
  'New New P&L': { hebrew: 'רווח והפסד חדש 2', arabic: 'الأرباح والخسائر الجديدة 2' },
  'New P&L': { hebrew: 'רווח והפסד חדש', arabic: 'الأرباح والخسائر الجديدة' },
  'Old P&L': { hebrew: 'רווח והפסד ישן', arabic: 'الأرباح والخسائر القديمة' },
  'New Stock on Hand': { hebrew: 'מלאי בפועל חדש', arabic: 'المخزون الحالي الجديد' },
  'POS Terminal (retail register)': { hebrew: 'עמדת מכירה (קופה)', arabic: 'نقطة البيع (الصندوق)' },
  'Translations': { hebrew: 'תרגומים', arabic: 'الترجمات' },
  'Vocabulary': { hebrew: 'אוצר מילים', arabic: 'المفردات' },
  // Real language names, on par with every other language, per direct
  // request - every real language's own name, in every real language.
  'English': { hebrew: 'אנגלית', arabic: 'الإنجليزية' },
  'German': { hebrew: 'גרמנית', arabic: 'الألمانية' },
  'French': { hebrew: 'צרפתית', arabic: 'الفرنسية' },
  'Danish': { hebrew: 'דנית', arabic: 'الدنماركية' },
  'Italian': { hebrew: 'איטלקית', arabic: 'الإيطالية' },
};

const merged = new Map(existing.map((r) => [r.concept + '|' + r.language, r]));
let added = 0;
for (const [concept, { hebrew, arabic }] of Object.entries(menuTranslations)) {
  for (const [language, text] of [['Hebrew', hebrew], ['Arabic', arabic]] as const) {
    const key = concept + '|' + language;
    if (!merged.has(key)) {
      merged.set(key, { concept, language, text });
      added++;
    }
  }
}
fs.writeFileSync(csvPath, writeCsv(Array.from(merged.values()), ['concept', 'language', 'text']));
console.log(`Added ${added} real, new Hebrew/Arabic menu translations.`);
