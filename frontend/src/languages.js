// Display-only list of the 14 Indian languages the pipeline understands.
// The backend auto-detects spoken/typed language itself — there is no
// `language` request parameter — so this selector drives local UI copy
// (placeholder example) rather than an API argument.

export const LANGUAGES = [
  { code: 'en', label: 'English', example: 'What is the capital of India?' },
  { code: 'hi', label: 'Hindi', example: 'भारत की राजधानी क्या है?' },
  { code: 'te', label: 'Telugu', example: 'భారత రాజధాని ఏది?' },
  { code: 'ta', label: 'Tamil', example: 'இந்தியாவின் தலைநகரம் என்ன?' },
  { code: 'bn', label: 'Bengali', example: 'ভারতের রাজধানী কী?' },
  { code: 'mr', label: 'Marathi', example: 'भारताची राजधानी कोणती आहे?' },
  { code: 'gu', label: 'Gujarati', example: 'ભારતની રાજધાની શું છે?' },
  { code: 'kn', label: 'Kannada', example: 'ಭಾರತದ ರಾಜಧಾನಿ ಯಾವುದು?' },
  { code: 'ml', label: 'Malayalam', example: 'ഇന്ത്യയുടെ തലസ്ഥാനം ഏതാണ്?' },
  { code: 'pa', label: 'Punjabi', example: 'ਭਾਰਤ ਦੀ ਰਾਜਧਾਨੀ ਕੀ ਹੈ?' },
  { code: 'or', label: 'Odia', example: 'ଭାରତର ରାଜଧାନୀ କ\'ଣ?' },
  { code: 'as', label: 'Assamese', example: 'ভাৰতৰ ৰাজধানী কি?' },
  { code: 'ur', label: 'Urdu', example: 'بھارت کا دارالحکومت کیا ہے؟' },
  { code: 'kok', label: 'Konkani', example: 'भारताची राजधानी कोणती?' },
]
