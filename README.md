# Golden Mobile — متجر حقيقي بباكند (نسخة Vercel + Postgres)

موقع متجر موبايلات شغّال فعليًا: فرونت إند (المتجر) + باكند Node.js/Express + قاعدة بيانات
Postgres، فيه حسابات عملاء حقيقية وبوابة أدمن حقيقية، ومبني خصيصًا يشتغل على Vercel.

## شو جوا المشروع
```
app.js              إعداد تطبيق Express (الراوتات والميدل وير) — بدون تشغيل سيرفر
server.js           للتشغيل محليًا فقط: يشغّل app.js على بورت محلي
api/index.js         نقطة الدخول لـ Vercel (serverless function) — بتستخدم app.js نفسه
vercel.json          إعدادات التوجيه على Vercel
db/                  الاتصال بقاعدة بيانات Postgres + إنشاء الجداول + بيانات ابتدائية
middleware/auth.js    تسجيل الدخول (JWT) + صلاحيات الأدمن
routes/               كل الـ API: auth, products, orders
public/index.html     واجهة المتجر (اللي الزباين بيشوفوها)
public/admin.html     لوحة تحكم الأدمن
```

ليش Postgres بدل SQLite يلي كان بالنسخة الأولى؟ لأنو Vercel منصة Serverless — ما في عندها
قرص دائم تحفظله ملف قاعدة بيانات محلي زي SQLite. Postgres قاعدة بيانات حقيقية تعيش على سيرفر
منفصل وتوصلها عن بعد، فبتشتغل صح مع Vercel.

## ١. جهّز قاعدة بيانات Postgres (قبل أي شي)

أسهل طريقة — من داخل مشروعك على Vercel نفسه:
1. افتح مشروعك على [vercel.com](https://vercel.com) → تبويب **Storage** → **Create Database** → اختر **Postgres**
2. بعد ما تنعمل، Vercel بيعرض زر **Connect Project** — اربطها بنفس المشروع
3. هاد بيضيف تلقائيًا متغيّر `DATABASE_URL` (أو شبيه إلو) لإعدادات بيئة مشروعك على Vercel

بديل: اعمل قاعدة بيانات مجانية على [neon.tech](https://neon.tech) أو [supabase.com](https://supabase.com)
وخد منها الـ Connection String (بيبدأ بـ `postgres://...`) وحطه إنت يدويًا كـ `DATABASE_URL`.

## ٢. التشغيل محليًا (اختياري، للتجربة قبل الرفع)

يحتاج [Node.js](https://nodejs.org) نسخة 18 أو أحدث.

```bash
npm install
cp .env.example .env
```

عبّي بملف `.env`: `DATABASE_URL` (من الخطوة الأولى)، `JWT_SECRET` (نص عشوائي طويل)،
`ADMIN_EMAIL`/`ADMIN_PASSWORD` (أول حساب أدمن بينعمل تلقائيًا منهم)، و `SHOP_WHATSAPP`.

```bash
npm start
```

افتح `http://localhost:3000` للمتجر، و `http://localhost:3000/admin.html` للوحة التحكم.

## ٣. رفعه على GitHub

```bash
git init
git add .
git commit -m "Golden Mobile shop"
git branch -M main
git remote add origin https://github.com/<اسم-المستخدم>/<اسم-الريبو>.git
git push -u origin main
```

ملف `.env` ما رح ينرفع (موجود بـ `.gitignore`) — أسرارك ما بتنكشف على GitHub.

## ٤. النشر على Vercel

1. على [vercel.com](https://vercel.com) → **Add New** → **Project** → اختر الريبو يلي رفعته
2. Vercel بيكتشف `vercel.json` تلقائيًا، ما تحتاج تغيّر إعدادات Build
3. قبل Deploy، افتح **Environment Variables** وضيف:
   - `DATABASE_URL` (إذا ما كانت انضافت تلقائيًا من خطوة ١)
   - `JWT_SECRET`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `SHOP_WHATSAPP`
4. اضغط **Deploy**

أول ما يفتح حدا الموقع لأول مرة بعد الـ Deploy، السيرفر بينشئ الجداول ويزرع حساب الأدمن
والمنتجات الابتدائية تلقائيًا (أول طلب بس ممكن ياخذ ثانية إضافية لهاد السبب).

## ٥. ربط الدومين متاعك

بما إنو الدومين موجود عندك على Vercel أصلاً: من صفحة المشروع → **Settings** → **Domains** →
ضيف الدومين واختاره. Vercel بيربطه مباشرة بما إنه نفس الحساب.

## ٦. شو المشروع هاد مبني عليه

- **تسجيل الدخول**: JWT محفوظ بكوكي httpOnly (أأمن من localStorage)
- **كلمات المرور**: مشفّرة بـ bcrypt، ما بتنخزن نص صريح أبدًا
- **الأدمن**: أي مستخدم بعمود `role = 'admin'` — أول واحد بينعمل تلقائيًا من متغيّرات البيئة
- **الطلبات**: لازم تسجيل دخول عشان تكمّل طلب (هيك بتظهر بصفحة "طلباتي")، والسعر دايمًا
  بينحسب من السيرفر (مش من المتصفح) عشان حدا ما يقدر يلعّب بالأسعار
- **قاعدة البيانات**: Postgres، بإعادة استخدام اتصالات (connection pool) مناسبة لبيئة Serverless

## ٧. اللي لسا مش موجود (وكيف تضيفه لاحقًا)

- **دفع إلكتروني حقيقي**: الدفع حاليًا "عند الاستلام" بس. لما يصير عندك حساب تاجر حقيقي
  (PayTabs, HyperPay, Moyasar, Stripe...) ابعتلي مفاتيح الـ API وبوصل الـ checkout فيهم.
- **صور منتجات حقيقية**: حاليًا كل منتج إلو أيقونة بس. لو بدك صور حقيقية، أسهل حل مع Vercel
  هو Vercel Blob Storage أو Cloudinary.
- **استرجاع كلمة مرور منسية**: محتاج خدمة إرسال إيميلات (زي Resend أو SendGrid) مش موجودة حاليًا.

قلّي إذا بدك أي واحدة من هاي وبضيفها.
