"""
Checks trusted-contact details before saving (backups saved as <file>.bak_valid). Run from the repo root.
Works on the SMS version of SafePlace.jsx and main.py (the files with the phone number field).

Before: anything typed was accepted, including gibberish, an email in the phone box, or letters as a phone number.
After:
  * Name must contain a letter. Email must look like an email. Phone must be a 10-digit Indian mobile number or a
    number that starts with + and a country code. It is stored as +91XXXXXXXXXX.
  * The form says what is wrong right under the box, and tells the person if they typed an email in the phone box
    (or a phone number in the email box). The Add button stays disabled until the details are valid.
  * The backend checks the same rules, so bad data cannot get in even if the page is bypassed.
  * If the server rejects the details, the page shows why. Before, it quietly saved the contact in the browser only.

Edits backend/main.py and frontend/src/pages/SafePlace/SafePlace.jsx. Safe to run twice.
"""
import re, shutil, sys
from pathlib import Path

MAIN = Path("backend/main.py")
SP = Path("frontend/src/pages/SafePlace/SafePlace.jsx")

def read(p):
    raw = p.read_bytes().decode("utf-8")
    return raw, raw.replace("\r\n", "\n"), "\r\n" in raw

problems, results = [], []

def edit(path, text, edits):
    for done, old, new, label in edits:
        if done in text:
            print(f"already : {path.name}: {label}")
        elif text.count(old) == 1:
            text = text.replace(old, new)
            print(f"applied : {path.name}: {label}")
        else:
            problems.append(f"{path.name}: {label}")
    return text

# ---------------------------------------------------------------- main.py
raw, text, crlf = read(MAIN)

BACKEND_HELPERS = '''def _contact_error(message: str):
    raise HTTPException(status_code=422, detail=message)


def _clean_contact_name(value) -> str:
    name = " ".join(str(value or "").split())
    if not name or len(name) > 80 or not re.search(r"[^\\W\\d_]", name):
        _contact_error("Enter the person's real name (it must contain letters, at most 80 characters).")
    return name


def _clean_contact_email(value) -> str:
    email = str(value or "").strip().lower()
    if not email:
        return ""
    if not re.fullmatch(r"[a-z0-9._%+\\-]+@[a-z0-9.\\-]+\\.[a-z]{2,}", email):
        _contact_error("That does not look like an email address, for example name@example.com.")
    return email


def _clean_contact_phone(value) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    if "@" in raw:
        _contact_error("That looks like an email address. Put it in the email box.")
    digits = _normalize_sms_number(raw)
    ok = digits is not None
    if ok and digits.startswith("91"):
        ok = len(digits) == 12 and digits[2] in "6789"      # Indian mobile numbers start with 6, 7, 8 or 9
    if not ok:
        _contact_error("Enter a 10-digit Indian mobile number, or a number that starts with + and the country code.")
    return "+" + digits


def _validate_new_contact(req):
    name = _clean_contact_name(req.name)
    email = _clean_contact_email(req.email)
    phone = _clean_contact_phone(req.phone)
    if not email and not phone:
        _contact_error("Add an email address or a phone number.")
    if req.receive_sms and not phone:
        _contact_error("Add a phone number before turning on SMS alerts.")
    return name, email, phone


'''
text = edit(MAIN, text, [
    ("def _validate_new_contact", '@app.post("/api/contacts")\ndef add_contact(',
     BACKEND_HELPERS + '@app.post("/api/contacts")\ndef add_contact(', "contact validation helpers"),
    ("name, email, phone = _validate_new_contact(req)",
     '    doc = {\n        "user_id": user_id,\n        "name": req.name,\n        "phone": req.phone,\n        "email": req.email,\n',
     '    name, email, phone = _validate_new_contact(req)\n\n    doc = {\n        "user_id": user_id,\n        "name": name,\n        "phone": phone,\n        "email": email,\n',
     "check new contacts"),
    ('update_fields["name"] = _clean_contact_name(req.name)',
     '    if req.name is not None: update_fields["name"] = req.name\n    if req.phone is not None: update_fields["phone"] = req.phone\n    if req.email is not None: update_fields["email"] = req.email\n',
     '    if req.name is not None: update_fields["name"] = _clean_contact_name(req.name)\n    if req.phone is not None: update_fields["phone"] = _clean_contact_phone(req.phone)\n    if req.email is not None: update_fields["email"] = _clean_contact_email(req.email)\n',
     "check edited contacts"),
])
results.append((MAIN, raw, text, crlf))

# ---------------------------------------------------------------- SafePlace.jsx
raw, text, crlf = read(SP)

JS_HELPERS = '''
// ---- Checking contact details before they are saved (the backend checks the same rules)
const isValidName = (value) => {
  const name = String(value || "").trim();
  return name.length > 0 && name.length <= 80 && /[A-Za-z\\u00C0-\\u024F\\u0900-\\u097F]/.test(name);
};

const isValidEmail = (value) => /^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(String(value || "").trim());

// Returns "+91XXXXXXXXXX" style text, "" for empty input, or null when the number is not valid.
const cleanPhone = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\\D/g, "");
  let normalized;
  if (raw.startsWith("+")) normalized = digits;
  else if (digits.length === 10) normalized = "91" + digits;
  else if (digits.length === 12 && digits.startsWith("91")) normalized = digits;
  else return null;
  if (normalized.length < 8 || normalized.length > 15 || normalized.startsWith("0")) return null;
  if (normalized.startsWith("91") && (normalized.length !== 12 || !/[6-9]/.test(normalized[2]))) return null;
  return "+" + normalized;
};

const emailProblem = (value) => {
  const v = String(value || "").trim();
  if (!v || isValidEmail(v)) return "";
  if (/^[+\\d\\s()-]+$/.test(v)) return "That looks like a phone number. Put it in the phone box.";
  return "That does not look like an email address, for example name@example.com.";
};

const phoneProblem = (value) => {
  const v = String(value || "").trim();
  if (!v || cleanPhone(v) !== null) return "";
  if (v.includes("@")) return "That looks like an email address. Put it in the email box.";
  return "Enter a 10-digit Indian mobile number, or a number that starts with + and the country code.";
};
'''

CHECKS = '''  const nameOk = isValidName(newContactName);
  const emailMessage = emailProblem(newContactEmail);
  const phoneMessage = phoneProblem(newContactPhone);
  const hasContactMethod = Boolean(newContactEmail.trim() || newContactPhone.trim());
  const contactFormValid = nameOk && !emailMessage && !phoneMessage && hasContactMethod;

'''

FORM_NEW = '''<div className="flex flex-col gap-3">
                <input 
                  type="text" 
                  placeholder="Full Name" 
                  value={newContactName}
                  onChange={(e) => { setNewContactName(e.target.value); setContactError(""); }}
                  className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-primary text-sm"
                />
                {newContactName.trim() && !nameOk && (
                  <p className="text-xs text-red-600 -mt-1">Enter the person's real name (it must contain letters).</p>
                )}
                <input
                  type="email"
                  placeholder="Email Address (optional)"
                  value={newContactEmail}
                  onChange={(e) => { setNewContactEmail(e.target.value); setContactError(""); }}
                  className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-primary text-sm"
                />
                {emailMessage && <p className="text-xs text-red-600 -mt-1">{emailMessage}</p>}
                <input
                  type="tel"
                  placeholder="Phone (10-digit Indian mobile or +country code)"
                  value={newContactPhone}
                  onChange={(e) => { setNewContactPhone(e.target.value); setContactError(""); }}
                  autoComplete="tel"
                  className="w-full p-3 rounded-xl border border-border bg-background outline-none focus:border-primary text-sm"
                />
                {phoneMessage && <p className="text-xs text-red-600 -mt-1">{phoneMessage}</p>}
                <label className="flex items-start gap-2 text-xs text-textSecondary leading-relaxed">
                  <input
                    type="checkbox"
                    checked={newContactReceiveSms}
                    onChange={(e) => setNewContactReceiveSms(e.target.checked)}
                    disabled={!newContactPhone.trim() || Boolean(phoneMessage)}
                    className="accent-primary mt-0.5"
                  />
                  <span>This trusted person has agreed to receive SMS safety alerts. Keep this unchecked unless they have consented.</span>
                </label>
                {newContactName.trim() && !hasContactMethod && (
                  <p className="text-xs text-textSecondary">Add an email address or a phone number.</p>
                )}
                {contactError && <p className="text-xs text-red-600">{contactError}</p>}
                <button
                  onClick={handleAddContact}
                  disabled={!contactFormValid || (newContactReceiveSms && !newContactPhone.trim())}
                  className="bg-primary hover:bg-primary/90 text-white p-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 mt-1 cursor-pointer font-medium text-sm transition shadow-sm"
                >
                  <FontAwesomeIcon icon={faPlus} />
                  Add to Trusted Circle
                </button>
              </div>'''

IMPORT_LINE = 'import { API_URL, sendSosAlert, sendSmsSosAlert, getSafetyActivities, getSafetyStatus } from "../../services/api";\n'
text = edit(SP, text, [
    ("const isValidName", IMPORT_LINE, IMPORT_LINE + JS_HELPERS, "validation helpers"),
    ("const [contactError", "  const [newContactReceiveSms, setNewContactReceiveSms] = useState(false);\n",
     "  const [newContactReceiveSms, setNewContactReceiveSms] = useState(false);\n  const [contactError, setContactError] = useState(\"\");\n", "error state"),
    ("const contactFormValid", "  const handleAddContact = async () => {\n    if (!newContactName.trim() || (!newContactEmail.trim() && !newContactPhone.trim())) return;\n",
     CHECKS + "  const handleAddContact = async () => {\n    if (!contactFormValid) {\n      setContactError(\"Please fix the details marked in red.\");\n      return;\n    }\n    setContactError(\"\");\n",
     "check before saving"),
    ("phone: cleanPhone(newContactPhone)", "        body: JSON.stringify({\n          name: newContactName.trim(),\n          email: newContactEmail.trim(),\n          phone: newContactPhone.trim(),\n",
     "        body: JSON.stringify({\n          name: newContactName.trim(),\n          email: newContactEmail.trim(),\n          phone: cleanPhone(newContactPhone),\n", "send the cleaned phone number"),
    ("res.status === 422", "      if (res.ok) {\n        const created = await res.json();\n",
     "      if (res.status === 400 || res.status === 422) {\n        const err = await res.json().catch(() => ({}));\n        setContactError(typeof err.detail === \"string\" ? err.detail : \"Those details do not look right. Please check them.\");\n        return;\n      }\n      if (res.ok) {\n        const created = await res.json();\n",
     "show why the server rejected the contact"),
])
if "{emailMessage && <p" in text:
    print("already : SafePlace.jsx: form with messages")
else:
    pattern = re.compile(r'<div className="flex flex-col gap-3">\n\s*<input \n\s*type="text" \n\s*placeholder="Full Name".*?Add to Trusted Circle\n\s*</button>\n\s*</div>', re.S)
    ms = pattern.findall(text)
    if len(ms) == 1:
        text = pattern.sub(lambda m: FORM_NEW, text, count=1)
        print("applied : SafePlace.jsx: form with messages")
    else:
        problems.append("SafePlace.jsx: add-contact form")
results.append((SP, raw, text, crlf))

if problems:
    print("\nNOTHING WAS WRITTEN. Could not find:", "; ".join(problems))
    print("Your files may differ from the version I expected; send them to me and I will adjust.")
    sys.exit(1)

for path, old_raw, new_text, crlf in results:
    new_raw = new_text.replace("\n", "\r\n") if crlf else new_text
    if new_raw != old_raw:
        shutil.copy(path, str(path) + ".bak_valid")
        path.write_bytes(new_raw.encode("utf-8"))
print("\ndone. Restart the backend; the page refreshes by itself.")