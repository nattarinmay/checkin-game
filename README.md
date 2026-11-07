# Pop Cat Check-in

เว็บเกมเช็กอินกิจกรรมโรงเรียน: หน้าผู้เล่น, หน้าจอโปรเจกเตอร์ และหลังบ้านแอดมิน

## เทคโนโลยี
- React + Vite
- Supabase Database, Auth, Storage และ Realtime
- Excel import/export ด้วย SheetJS
- Netlify deploy

## ก่อนเริ่ม
ต้องมี Node.js 20+ (หรือใช้ GitHub Codespaces) และบัญชี Supabase/Netlify/GitHub

## 1. สร้างฐานข้อมูล Supabase
1. สร้างโปรเจกต์ที่ https://supabase.com/
2. ไปที่ **SQL Editor → New query**
3. วางเนื้อหาทั้งหมดจาก `supabase/schema.sql` แล้วกด Run
4. ไปที่ **Project Settings → API** แล้วคัดลอก Project URL และ publishable key (หรือ anon public key รุ่นเก่า)
5. ไปที่ **Authentication → Users → Add user** สร้างอีเมลและรหัสผ่านสำหรับแอดมิน
6. ใน Authentication settings ให้ปิดการสมัครสมาชิกสาธารณะ (Disable sign-ups) เพื่อไม่ให้บุคคลทั่วไปสร้างบัญชีและได้รับสิทธิ์แอดมิน
7. ไปที่ **Authentication → URL Configuration** เพิ่ม URL ที่จะใช้จริงใน Site URL และ Redirect URLs


> ห้ามใช้ `service_role` / secret key ในเว็บหรือใน Netlify environment variables ที่ขึ้นต้นด้วย `VITE_` เด็ดขาด

## 2. รันบนเครื่องหรือ Codespaces
```bash
npm install
cp .env.example .env
```
เปิด `.env` แล้วใส่ค่า:
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```
จากนั้น:
```bash
npm run dev
```
เปิด URL ที่ Vite แสดง (ปกติ `http://localhost:5173`)

## 3. URL ของแต่ละหน้าจอ
- ผู้เล่น: `/`
- แอดมิน: `/admin`
- โปรเจกเตอร์: `/projector`

แอดมินล็อกอินด้วยบัญชีที่สร้างใน Supabase Auth

## 4. นำเข้ารายชื่อนักเรียน
1. เข้า `/admin` แล้วล็อกอิน
2. ดาวน์โหลดเทมเพลต Excel
3. ใส่ข้อมูลตามคอลัมน์: `คำนำหน้า`, `ชื่อ`, `นามสกุล`, `รหัสนักเรียน`
4. อัปโหลดไฟล์ `.xlsx` หรือ `.xls`
5. รหัสนักเรียนซ้ำจะอัปเดตข้อมูลเดิม

## 5. อัปโหลดภาพตัวการ์ตูน
- เข้า `/admin` เลือกไฟล์ PNG ขนาดไม่เกิน 5 MB
- แนะนำภาพ PNG ที่พื้นหลังโปร่งใส
- กด “เริ่มเกม / เริ่มรอบใหม่” เพื่อใช้ภาพและการตั้งค่าใหม่

## 6. เผยแพร่บน Netlify
1. Push โปรเจกต์นี้ขึ้น GitHub
2. เข้า https://app.netlify.com/ แล้วเลือก **Add new site → Import an existing project**
3. เลือก repository นี้
4. Build command: `npm run build`
5. Publish directory: `dist`
6. ที่ Site configuration → Environment variables เพิ่ม:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. Deploy แล้วเปิด `https://ชื่อเว็บ.netlify.app`
8. เพิ่ม URL เว็บ Netlify ใน Supabase Authentication → URL Configuration
9. ทดสอบ `/`, `/admin`, `/projector` บนมือถือและคอมพิวเตอร์

## 7. ทดสอบก่อนใช้จริง
- ทดลองนำเข้า 5–10 รายชื่อก่อน แล้วค่อยนำเข้าทั้งหมด
- เปิดหน้าโปรเจกเตอร์และมือถือพร้อมกัน ตรวจว่าจำนวนคนเข้าร่วมตรงกัน
- ล็อกอินแอดมิน เริ่มเกม และแตะจากอุปกรณ์หลายเครื่อง
- ตรวจว่าเปอร์เซ็นต์รวมขึ้นจนถึง 100% และข้อความสำเร็จแสดง
- รีเซ็ตและทดสอบรอบใหม่
- ใช้ DevTools/เครื่องจำลองหรืออุปกรณ์จริงเพิ่มจำนวนผู้ใช้เป็น 100+ ก่อนวันจริง

## ข้อจำกัดและหมายเหตุสำคัญ
- โปรเจกต์นี้เป็น starter implementation ที่ต้องติดตั้งและทดสอบใน Supabase ของผู้ใช้ก่อนใช้งานจริง
- `add_taps` ทำ atomic updates ผ่าน PostgreSQL RPC แต่ผู้ใช้แบบ anonymous ยังสามารถเรียก RPC ได้โดยตรง จึงไม่ควรใช้คะแนนนี้เป็นข้อมูลเดิมพันหรือผลประเมินที่มีความสำคัญสูง
- ถ้าใช้กับกิจกรรมที่ต้องป้องกันการปลอมคะแนนจริงจัง ควรเพิ่มระบบยืนยันตัวตน/โทเคนผู้เล่นแบบรายคนและจำกัด rate ที่ server-side
- เพื่อปกป้องข้อมูลนักเรียน ให้ใช้เฉพาะข้อมูลที่จำเป็น จำกัดสิทธิ์ผู้ดูแล และไม่แชร์ student_code ออกสู่หน้าสาธารณะ
- Free tier และข้อจำกัดของบริการเปลี่ยนแปลงได้ ควรตรวจสอบโควตาล่าสุดของ Supabase และ Netlify ก่อนกิจกรรม
- โค้ดตัวอย่างนี้ไม่ได้แทนที่การทดสอบโหลดจริง 100+ concurrent users

## โครงสร้าง
```
src/
  App.jsx
  main.jsx
  styles.css
  lib/supabase.js
supabase/
  schema.sql
```
