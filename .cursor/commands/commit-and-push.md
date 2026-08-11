---
description: Commit การเปลี่ยนแปลงที่เกี่ยวข้อง แล้ว push สาขาปัจจุบันไป remote
---

# Commit and push

Commit การเปลี่ยนแปลงที่เกี่ยวข้อง แล้ว push สาขาปัจจุบันไป remote — ทำทันทีเมื่อเรียกคำสั่งนี้ (ถือว่าได้รับอนุญาตแล้ว)

## ขั้นตอน

1. รันแบบขนาน:
   - `git status`
   - `git diff` และ `git diff --staged`
   - `git log -5 --oneline` (จับสไตล์ข้อความ commit)
   - ตรวจว่าสาขา track remote หรือยัง และ ahead/behind อย่างไร
2. วิเคราะห์ไฟล์ที่ควรเข้า commit — ข้าม secrets และไฟล์ที่ห้าม commit (ดูข้อห้ามด้านล่าง)
3. Stage เฉพาะไฟล์ที่เกี่ยวข้อง (`git add <paths>`) — อย่า `git add -A` ถ้ามีไฟล์ต้องข้ามปนอยู่
4. ร่างข้อความ commit 1–2 ประโยค เน้นเหตุผล (why) ไม่ใช่รายการไฟล์; ให้สอดคล้องสไตล์ `git log`
5. Commit ด้วย HEREDOC:

```bash
git commit -m "$(cat <<'EOF'
ข้อความ commit ที่นี่

EOF
)"
```

6. ถ้า pre-commit hook แก้ไฟล์แล้วทำให้ commit ล้มเหลว — แก้ปัญหาแล้วสร้าง commit **ใหม่** (อย่า amend เว้นเงื่อนไขด้านล่างครบ)
7. หลัง commit สำเร็จ:
   - ยังไม่มี upstream → `git push -u origin HEAD`
   - มี upstream แล้ว → `git push`
8. รัน `git status` ยืนยันผล แล้วสรุปสั้นๆ: สาขา, commit hash/ข้อความ, ผล push

## ข้อห้าม

- ห้ามอัปเดต git config
- ห้าม `--force` / `--force-with-lease` / `--no-verify` / `--no-gpg-sign`
- ห้าม interactive (`-i`) เช่น `git add -i`, `git rebase -i`
- ห้าม empty commit เมื่อไม่มี changes — รายงานว่าไม่มีอะไรให้ทำ
- ห้าม amend ยกเว้นครบทุกข้อ: (ก) ผู้ใช้ขอ amend หรือ hook แก้ไฟล์หลัง commit สำเร็จและต้องรวม, (ข) HEAD commit สร้างใน session นี้, (ค) ยังไม่ push ไป remote
- ห้าม push ไป `main`/`master` ด้วย force

## ไฟล์ที่ห้าม commit (Shift-Flow)

- secrets: `.env`, `credentials.json`, คีย์/โทเคน
- `/temp/` ทั้งโฟลเดอร์
- `pilot-vault/raw/`, `pilot-vault/anonymized/`, `pilot-vault/consent/`, `pilot-vault/manifest.json`
- ชื่อจริงหรือรหัสพนักงานจริงใน `docs/` หรือ `demo/`

ถ้ามีเฉพาะไฟล์ต้องข้าม — หยุดและรายงาน ไม่บังคับ commit/push
