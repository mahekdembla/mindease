/**
 * Devanagari to Romanized Hinglish Transliterator for MindEase Voice Input
 * 
 * Accurately converts Hindi speech recognized in Devanagari script into natural,
 * conversational Hinglish (Latin alphabet), preserving English and other languages
 * in their original form.
 */

// Common conversational Hindi / Hinglish dictionary mapping
export const HINDI_WORD_MAP = {
  // Pronouns & Possessives
  "मैं": "main",
  "मै": "main",
  "मुझे": "mujhe",
  "मुझको": "mujhko",
  "मेरा": "mera",
  "मेरी": "meri",
  "मेरे": "mere",
  "हम": "hum",
  "हमें": "humein",
  "हमारा": "hamara",
  "हमारी": "hamari",
  "हमारे": "hamare",
  "तू": "tu",
  "तुझे": "tujhe",
  "तेरा": "tera",
  "तेरी": "teri",
  "तेरे": "tere",
  "तुम": "tum",
  "तुम्हें": "tumhein",
  "तुम्हे": "tumhein",
  "तुम्हारा": "tumhara",
  "तुम्हारी": "tumhari",
  "तुम्हारे": "tumhare",
  "आप": "aap",
  "आपको": "aapko",
  "आपका": "aapka",
  "आपकी": "aapki",
  "आपके": "aapke",
  "यह": "yeh",
  "ये": "yeh",
  "वह": "woh",
  "वो": "woh",
  "उस": "us",
  "उसे": "use",
  "उसका": "uska",
  "उसकी": "uski",
  "उसके": "uske",
  "इन": "in",
  "इन्हें": "inhein",
  "इनका": "inka",
  "इनकी": "inki",
  "इनके": "inke",
  "उन": "un",
  "उन्हें": "unhein",
  "उनका": "unka",
  "उनकी": "unki",
  "उनके": "unke",
  "कोई": "koi",
  "कुछ": "kuch",
  "कौन": "kaun",
  "क्या": "kya",
  "क्यों": "kyun",
  "क्यो": "kyun",
  "कब": "kab",
  "कहाँ": "kahan",
  "कहा": "kaha",
  "कैसे": "kaise",
  "कैसा": "kaisa",
  "कैसी": "kaisi",
  "कितना": "kitna",
  "कितनी": "kitni",
  "कितने": "kitne",

  // Verbs, Auxiliaries & Tenses
  "है": "hai",
  "हैं": "hain",
  "हूँ": "hoon",
  "हूं": "hoon",
  "हो": "ho",
  "था": "tha",
  "थी": "thi",
  "थे": "the",
  "होगा": "hoga",
  "होगी": "hogi",
  "होंगे": "honge",
  "होता": "hota",
  "होती": "hoti",
  "होते": "hote",
  "होना": "hona",
  "होने": "hone",
  "रहा": "raha",
  "रही": "rahi",
  "रहे": "rahe",
  "करना": "karna",
  "करता": "karta",
  "करती": "karti",
  "करते": "karte",
  "कर": "kar",
  "करो": "karo",
  "करें": "karein",
  "किया": "kiya",
  "की": "ki",
  "के": "ke",
  "का": "ka",
  "को": "ko",
  "से": "se",
  "में": "mein",
  "पे": "pe",
  "पर": "par",
  "तक": "tak",
  "ने": "ne",
  "लग": "lag",
  "लगा": "laga",
  "लगी": "lagi",
  "लगे": "lage",
  "लगता": "lagta",
  "लगती": "lagti",
  "लगते": "lagte",
  "चाहता": "chahta",
  "चाहती": "chahti",
  "चाहते": "chahte",
  "चाहिए": "chahiye",
  "सकता": "sakta",
  "सकती": "sakti",
  "सकते": "sakte",
  "सकूं": "sakoon",
  "सकू": "sakoon",
  "पा": "paa",
  "गया": "gaya",
  "गयी": "gayi",
  "गए": "gaye",
  "जाना": "jaana",
  "जाता": "jaata",
  "जाती": "jaati",
  "जाते": "jaate",
  "जा": "jaa",
  "आना": "aana",
  "आता": "aata",
  "आती": "aati",
  "आते": "aate",
  "आ": "aa",
  "बोल": "bol",
  "बोलना": "bolna",
  "कहना": "kehna",
  "बात": "baat",
  "बातें": "baatein",
  "बातों": "baaton",
  "समझ": "samajh",
  "समझना": "samajhna",
  "सोच": "soch",
  "सोचना": "sochna",
  "देख": "dekh",
  "देखना": "dekhna",
  "देना": "dena",
  "दो": "do",
  "दीजिए": "dijiye",
  "लेना": "lena",
  "लो": "lo",
  "लीजिए": "lijiye",
  "रखना": "rakhna",
  "रखो": "rakho",

  // Adjectives, Emotions, Common Words
  "बहुत": "bahut",
  "ज्यादा": "zyada",
  "थोड़ा": "thoda",
  "थोड़ी": "thodi",
  "थोड़े": "thode",
  "कम": "kam",
  "अच्छा": "achha",
  "अच्छी": "achhi",
  "अच्छे": "achhe",
  "बुरा": "bura",
  "बुरी": "buri",
  "बुरे": "bure",
  "सही": "sahi",
  "गलत": "galat",
  "आज": "aaj",
  "कल": "kal",
  "अब": "ab",
  "अभी": "abhi",
  "तब": "tab",
  "फिर": "phir",
  "भी": "bhi",
  "ही": "hi",
  "तो": "toh",
  "नहीं": "nahi",
  "नही": "nahi",
  "ना": "na",
  "हाँ": "haan",
  "हां": "haan",
  "और": "aur",
  "या": "ya",
  "लेकिन": "lekin",
  "मगर": "magar",
  "क्योंकि": "kyunki",
  "क्योकि": "kyunki",
  "इसलिए": "isliye",
  "डर": "dar",
  "चिंता": "chinta",
  "तनाव": "tanaav",
  "अकेला": "akela",
  "अकेली": "akeli",
  "परेशान": "pareshaan",
  "थक": "thak",
  "थका": "thaka",
  "थकी": "thaki",
  "खुश": "khush",
  "उदास": "udaas",
  "मन": "mann",
  "दिल": "dil",
  "दिमाग": "dimaag",
  "सर": "sar",
  "सिर": "sir",
  "सब": "sab",
  "लोग": "log",
  "घर": "ghar",
  "काम": "kaam",
  "समय": "samay",
  "वक्त": "waqt",
  "मदद": "madad",
  "दोस्त": "dost",
  "परिवार": "parivaar",
  "ज़िंदगी": "zindagi",
  "जिंदगी": "zindagi",
  "घबराहट": "ghabrahat",
  "मुश्किल": "mushkil",
  "आसान": "aasaan",
  "तबीयत": "tabiyat",
  "नींद": "neend",
  "रो": "ro",
  "रोना": "rona",
  "हंसना": "hansna",
  "अकेले": "akele",
  "अकेलापन": "akelapan",

  // English Loanwords often transcribed in Devanagari
  "प्रोजेक्ट": "project",
  "सबमिशन": "submission",
  "टेंशन": "tension",
  "डिप्रेशन": "depression",
  "एंग्जायटी": "anxiety",
  "एंजायटी": "anxiety",
  "स्ट्रेस": "stress",
  "डेडलाइन": "deadline",
  "एग्जाम": "exam",
  "असाइनमेंट": "assignment",
  "फीलिंग": "feeling",
  "हेल्प": "help",
  "प्रॉब्लम": "problem",
  "सिचुएशन": "situation",
  "इमोशनल": "emotional",
  "डॉक्टर": "doctor",
  "थेरेपी": "therapy",
  "टाइमटेबल": "timetable",
  "कैलकुलेट": "calculate"
};

// Independent vowels
const INDEPENDENT_VOWELS = {
  "अ": "a",
  "आ": "aa",
  "इ": "i",
  "ई": "ee",
  "उ": "u",
  "ऊ": "oo",
  "ऋ": "ri",
  "ए": "e",
  "ऐ": "ai",
  "ओ": "o",
  "औ": "au"
};

// Dependent vowel signs (Matras)
const MATRAS = {
  "ा": "a",
  "ि": "i",
  "ी": "i",
  "ु": "u",
  "ू": "oo",
  "ृ": "ri",
  "े": "e",
  "ै": "ai",
  "ो": "o",
  "ौ": "au"
};

// Consonants
const CONSONANTS = {
  "क": "k",  "ख": "kh", "ग": "g",  "घ": "gh", "ङ": "ng",
  "च": "ch", "छ": "chh","ज": "j",  "झ": "jh", "ञ": "ny",
  "ट": "t",  "ठ": "th", "ड": "d",  "ढ": "dh", "ण": "n",
  "त": "t",  "थ": "th", "द": "d",  "ध": "dh", "न": "n",
  "प": "p",  "फ": "ph", "ब": "b",  "भ": "bh", "म": "m",
  "य": "y",  "र": "r",  "ल": "l",  "व": "v",
  "श": "sh", "ष": "sh", "स": "s",  "ह": "h",
  // Nukta consonants
  "क़": "q",  "ख़": "kh", "ग़": "gh", "ज़": "z",
  "ड़": "r",  "ढ़": "rh", "फ़": "f"
};

const VIRAMA = "\u094D";      // ्
const ANUSVARA = "\u0902";    // ं
const CHANDRABINDU = "\u0901";// ँ
const VISARGA = "\u0903";     // ः
const NUKTA = "\u093C";       // ़

/**
 * Returns true if the text contains any Devanagari characters.
 */
export function hasDevanagari(text) {
  return /[\u0900-\u097F]/.test(text || "");
}

/**
 * Phonetically transliterates a single Devanagari word to Romanized script.
 */
export function transliterateDevanagariWord(word) {
  if (!word) return "";

  // Check direct dictionary first
  const cleanWord = word.replace(/[.,/#!$%^&*;:{}=\-_`~()?"']/g, "");
  if (HINDI_WORD_MAP[cleanWord]) {
    return word.replace(cleanWord, HINDI_WORD_MAP[cleanWord]);
  }

  let result = "";
  const len = word.length;

  for (let i = 0; i < len; i++) {
    const char = word[i];
    const nextChar = i + 1 < len ? word[i + 1] : "";
    const nextNextChar = i + 2 < len ? word[i + 2] : "";

    // Check for consonant with nukta
    if (nextChar === NUKTA) {
      const nuktaPair = char + NUKTA;
      if (CONSONANTS[nuktaPair]) {
        result += CONSONANTS[nuktaPair];
        i++; // skip nukta
        if (nextNextChar === VIRAMA) {
          i++; // skip virama
        } else if (MATRAS[nextNextChar]) {
          result += MATRAS[nextNextChar];
          i++; // skip matra
        } else if (i + 1 < len && (CONSONANTS[word[i + 1]] || INDEPENDENT_VOWELS[word[i + 1]])) {
          result += "a";
        }
        continue;
      }
    }

    // Independent Vowel
    if (INDEPENDENT_VOWELS[char]) {
      result += INDEPENDENT_VOWELS[char];
      continue;
    }

    // Consonant
    if (CONSONANTS[char]) {
      result += CONSONANTS[char];

      if (nextChar === VIRAMA) {
        i++; // skip virama (suppresses inherent 'a')
      } else if (MATRAS[nextChar]) {
        result += MATRAS[nextChar];
        i++; // skip matra
      } else if (nextChar && (CONSONANTS[nextChar] || INDEPENDENT_VOWELS[nextChar])) {
        // Inherent 'a' between consonants unless at word end
        result += "a";
      }
      continue;
    }

    // Anusvara / Chandrabindu
    if (char === ANUSVARA || char === CHANDRABINDU) {
      result += "n";
      continue;
    }

    // Visarga
    if (char === VISARGA) {
      result += "h";
      continue;
    }

    // Any other character (punctuation, numbers, English letters)
    result += char;
  }

  return result;
}

/**
 * Detects spoken language and preserves it in Romanized form where appropriate.
 * If Devanagari Hindi is detected, transliterates it to natural Romanized Hinglish.
 * Preserves English and other languages in their original form.
 */
export function romanizeSpokenText(text) {
  if (!text) return "";

  // If no Devanagari script is present, preserve text in its original language
  if (!hasDevanagari(text)) {
    return text;
  }

  // Tokenize while preserving punctuation and spacing
  const tokens = text.split(/(\s+|[.,!?;:()"])/);

  const romanizedTokens = tokens.map((token) => {
    if (!token || /^\s+$/.test(token) || /^[.,!?;:()"]+$/.test(token)) {
      return token;
    }

    // If token has Devanagari characters, transliterate it
    if (hasDevanagari(token)) {
      return transliterateDevanagariWord(token);
    }

    // Non-Devanagari words (e.g. English words "anxiety", "deadline") stay unchanged
    return token;
  });

  let output = romanizedTokens.join("");

  // Clean up any double spaces and ensure neat capitalization at sentence starts
  output = output.replace(/\s+/g, " ").trim();
  if (output.length > 0) {
    output = output.charAt(0).toUpperCase() + output.slice(1);
  }

  return output;
}
