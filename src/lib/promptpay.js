// PromptPay QR payload (EMVCo merchant-presented QR, Thai QR Payment spec).
// Pure functions — the QR image itself is rendered by the `qrcode` package in the UI.

const AID = 'A000000677010111';

const field = (id, value) => `${id}${String(value.length).padStart(2, '0')}${value}`;

// CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) as 4 uppercase hex digits.
export function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Phone (10 digits) → '01' + 0066xxxxxxxxx; national/tax ID (13) → '02'; e-wallet (15) → '03'.
export function promptPayTarget(id) {
  const digits = String(id ?? '').replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) return ['01', `0066${digits.slice(1)}`];
  if (digits.length === 11 && digits.startsWith('66')) return ['01', `00${digits}`];
  if (digits.length === 13) return ['02', digits];
  if (digits.length === 15) return ['03', digits];
  return null;
}

export const isValidPromptPayId = (id) => promptPayTarget(id) !== null;

export function buildPromptPayPayload(id, amount) {
  const target = promptPayTarget(id);
  if (!target) throw new Error('INVALID_PROMPTPAY_ID');
  const hasAmount = Number(amount) > 0;
  const body = [
    field('00', '01'),
    field('01', hasAmount ? '12' : '11'), // 12 = one-time QR with amount, 11 = reusable
    field('29', field('00', AID) + field(target[0], target[1])),
    field('58', 'TH'),
    field('53', '764'), // THB
    hasAmount ? field('54', Number(amount).toFixed(2)) : '',
  ].join('');
  const withCrcTag = `${body}6304`;
  return withCrcTag + crc16(withCrcTag);
}

// 0812345678 → 081-234-5678, 13-digit ID → 1-2345-67890-12-3.
export function formatPromptPayId(id) {
  const d = String(id ?? '').replace(/\D/g, '');
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 13) return `${d[0]}-${d.slice(1, 5)}-${d.slice(5, 10)}-${d.slice(10, 12)}-${d[12]}`;
  return d;
}

const SLIP_ERRORS = {
  SLIP_PENDING: 'คุณมีสลิปที่รอตรวจสอบอยู่แล้ว',
  PRICE_CHANGED: 'ราคามีการเปลี่ยนแปลง กรุณาปิดแล้วเปิดหน้านี้ใหม่ก่อนโอน',
  INVALID_SLIP_PATH: 'อัปโหลดสลิปไม่สำเร็จ ลองใหม่อีกครั้ง',
  UNAUTHORIZED: 'กรุณาเข้าสู่ระบบก่อนแจ้งชำระเงิน',
  IMAGE_UNSUPPORTED: 'อ่านไฟล์รูปนี้ไม่ได้ กรุณาใช้ไฟล์ JPG หรือ PNG',
};

export function slipErrorMessage(error) {
  const msg = String(error?.message ?? error ?? '');
  const code = Object.keys(SLIP_ERRORS).find((k) => msg.includes(k));
  return code ? SLIP_ERRORS[code] : 'ส่งสลิปไม่สำเร็จ ลองใหม่อีกครั้ง';
}
