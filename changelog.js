// Changelog data per version and locale
const CHANGELOG_DATA = {
  '2.3': {
    en: [
      'Line break support during dictation — press Shift+Enter while the microphone is on.',
      'Tip: pause briefly before inserting a line break to let the current text finalize.',
      'Fixed duplicate text that occurred when rebase happened during recognition.',
      'Manual edits are now preserved while dictation is active.',
      'Settings modal redesign: close button (X), cleaner layout.',
    ],
    ru: [
      'Поддержка переноса строки во время диктовки — нажмите Shift+Enter, пока микрофон включён.',
      'Совет: сделайте короткую паузу перед переносом строки, чтобы текущий текст применился.',
      'Исправлено дублирование текста при перебазировании во время распознавания.',
      'Ручные правки теперь сохраняются при активной диктовке.',
      'Переработано окно настроек: кнопка закрытия (X), улучшен макет.',
    ],
    es: [
      'Soporte para saltos de línea durante la dictado — pulsa Shift+Enter con el micrófono activo.',
      'Consejo: haz una breve pausa antes de insertar un salto de línea.',
      'Corregida la duplicación de texto durante el reconocimiento de voz.',
      'Las ediciones manuales se conservan ahora durante la dictado.',
      'Rediseño del modal de ajustes: botón de cierre (X), diseño más limpio.',
    ],
    uk: [
      'Підтримка перенесення рядка під час диктування — натисніть Shift+Enter, поки мікрофон увімкнено.',
      'Порада: зробіть коротку паузу перед переносом рядка, щоб текст застосувався.',
      'Виправлено дублювання тексту під час активного розпізнавання мови.',
      'Ручні правки тепер зберігаються під час диктування.',
      'Перероблено вікно налаштувань: кнопка закриття (X), покращений макет.',
    ],
    zh: [
      '口述时支持换行 — 麦克风开启时按 Shift+Enter。',
      '提示：插入换行前先短暂暂停，让当前文本生效。',
      '修复了语音识别过程中重新定位时出现的文本重复问题。',
      '口述时手动编辑现在会被保留。',
      '设置窗口重新设计：关闭按钮 (X)，更简洁的布局。',
    ],
    ko: [
      '받아쓰기 중 줄 바꿈 지원 — 마이크가 켜져 있을 때 Shift+Enter를 누르세요.',
      '팁: 줄 바꿈을 삽입하기 전에 현재 텍스트가 적용되도록 잠시 멈추세요.',
      '진행 중인 음성 인식 중 재기본화가 발생할 때 발생하던 텍스트 중복 문제를 수정했습니다.',
      '받아쓰기 중 수동 편집이 이제 보존됩니다.',
      '설정 창 재설계: 닫기 버튼(X), 더 깔끔한 레이아웃.',
    ],
    fr: [
      'Prise en charge des sauts de ligne pendant la dictée — appuyez sur Shift+Entrée pendant que le micro est allumé.',
      'Conseil : faites une courte pause avant d\'insérer un saut de ligne pour que le texte actuel soit appliqué.',
      'Correction de la duplication de texte lors du rebasing pendant la reconnaissance vocale.',
      'Les éditions manuelles sont désormais conservées pendant la dictée.',
      'Redesign du modal des paramètres : bouton de fermeture (X), mise en page plus propre.',
    ],
    pt: [
      'Suporte a quebra de linha durante a ditado — pressione Shift+Enter enquanto o microfone está ligado.',
      'Dica: faça uma breve pausa antes de inserir uma quebra de linha para que o texto atual seja aplicado.',
      'Corrigida a duplicação de texto que ocorria durante o reconhecimento de voz.',
      'As edições manuais agora são preservadas durante o ditado.',
      'Redesign do modal de configurações: botão de fechar (X), layout mais limpo.',
    ],
    hi: [
      'डिक्टेशन के दौरान लाइन ब्रेक सहायता — माइक्रोफ़ोन चालू होने पर Shift+Enter दबाएँ।',
      'टिप: लाइन ब्रेक डालने से पहले थोड़ा रुकें ताकि मौजूदा टेक्स्ट लागू हो सके।',
      'स्पीच रिकग्निशन के दौरान रीबेस होने पर टेक्स्ट डुप्लीकेट की समस्या ठीक की गई।',
      'डिक्टेशन के दौरान मैन्युअल एडिट्स अब सुरक्षित रहेंगे।',
      'सेटिंग्स मोडल का पुनर्डिज़ाइन: बंद करें बटन (X), साफ-सुथरा लेआउट।',
    ],
  },
  '2.2': {
    en: [
      'Improved speech recognition reliability.',
      'Full i18n localization for EN, RU, ES, UK, ZH, KO, FR, PT, HI.',
      'Refined settings modal layout.',
      'Improved Push-to-Talk handling.',
    ],
    ru: [
      'Улучшена надёжность распознавания речи.',
      'Полная мультиязычность: EN, RU, ES, UK, ZH, KO, FR, PT, HI.',
      'Улучшен макет окна настроек.',
      'Улучшена работа режима рации.',
    ],
    es: [
      'Reconocimiento de voz más fiable.',
      'Localización completa: EN, RU, ES, UK, ZH, KO, FR, PT, HI.',
      'Diseño del modal de ajustes refinado.',
      'Mejorada la gestión de Push-to-Talk.',
    ],
    uk: [
      'Покращено надійність розпізнавання мови.',
      'Повна багатомовність: EN, RU, ES, UK, ZH, KO, FR, PT, HI.',
      'Удосконалено макет вікна налаштувань.',
      'Покращено роботу режиму рації.',
    ],
    zh: [
      '语音识别可靠性提高。',
      '完整国际化支持：英语、俄语、西班牙语、乌克兰语、中文、韩语、法语、葡萄牙语、印地语。',
      '设置窗口布局优化。',
      '一键通（对讲机）处理改进。',
    ],
    ko: [
      '음성 인식 안정성 향상.',
      '완전한 i18n 지역화: 영어, 러시아어, 스페인어, 우크라이나어, 중국어, 한국어, 프랑스어, 포르투갈어, 힌디어.',
      '설정 모달 레이아웃 개선.',
      '푸시 투 토크 처리 개선.',
    ],
    fr: [
      'Fiabilité de la reconnaissance vocale améliorée.',
      'Localisation i18n complète : EN, RU, ES, UK, ZH, KO, FR, PT, HI.',
      'Mise en page du modal de paramètres affinée.',
      'Gestion du Push-to-Talk améliorée.',
    ],
    pt: [
      'Confiabilidade do reconhecimento de voz aprimorada.',
      'Localização i18n completa: EN, RU, ES, UK, ZH, KO, FR, PT, HI.',
      'Layout do modal de configurações refinado.',
      'Manuseio do Push-to-Talk aprimorado.',
    ],
    hi: [
      'स्पीच रिकग्निशन की विश्वसनीयता में सुधार।',
      'पूर्ण i18n लोकलाइज़ेशन: EN, RU, ES, UK, ZH, KO, FR, PT, HI।',
      'सेटिंग्स मोडल लेआउट को बेहतर बनाया गया।',
      'पुश-टू-टॉक हैंडलिंग में सुधार।',
    ],
  },
};

export const CURRENT_VERSION = '2.3';

export const getChangelog = (version, locale) => {
  const data = CHANGELOG_DATA[version];
  if (!data) return [];
  return data[locale] || data.en || [];
};
