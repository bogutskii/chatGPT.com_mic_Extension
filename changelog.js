// Changelog data per version and locale
const CHANGELOG_DATA = {
  '2.5': {
    en: [
      'Major performance optimization: smoother dragging, faster speech recognition rendering, and reduced main-thread work during ChatGPT streaming.',
      'Cached input field and send button references — no more querySelector on every speech result or countdown tick.',
      'Replaced deprecated execCommand with Range API for contenteditable input — eliminates forced reflow during dictation.',
      'Single combined keydown listener for Ctrl+M and Push-to-Talk — less overhead on every keystroke.',
      'Settings modal: entrance animation, focus trap, and ARIA labels for screen readers.',
      'Narrowed MutationObserver from body to main — no longer fires on streaming tokens or overlays.',
    ],
    ru: [
      'Масштабная оптимизация производительности: более плавное перетаскивание, быстрая отрисовка распознавания речи, меньше нагрузки на главный поток при стриминге ChatGPT.',
      'Кэширование поля ввода и кнопки отправки — больше нет querySelector при каждом результате речи или тике таймера.',
      'Замена устаревшего execCommand на Range API для contenteditable — убран forced reflow во время диктовки.',
      'Единый listener для Ctrl+M и Push-to-Talk — меньше накладных расходов на каждое нажатие.',
      'Окно настроек: анимация появления, focus trap и ARIA-метки для скринридеров.',
      'MutationObserver сужен с body до main — больше не срабатывает на стриминг токенов и оверлеи.',
    ],
    es: [
      'Optimización de rendimiento importante: arrastre más suave, renderizado de reconocimiento de voz más rápido y menos trabajo en el hilo principal durante el streaming de ChatGPT.',
      'Campo de entrada y botón de envío en caché — sin querySelector en cada resultado de voz o tick del temporizador.',
      'Reemplazo del obsoleto execCommand por Range API para contenteditable — elimina el reflow forzado durante el dictado.',
      'Un único listener de teclado para Ctrl+M y Push-to-Talk — menos sobrecarga en cada pulsación.',
      'Modal de ajustes: animación de entrada, focus trap y etiquetas ARIA para lectores de pantalla.',
      'MutationObserver reducido de body a main — ya no se activa con tokens de streaming u overlays.',
    ],
    fr: [
      'Optimisation majeure des performances : glisser plus fluide, rendu plus rapide de la reconnaissance vocale et moins de travail sur le thread principal pendant le streaming de ChatGPT.',
      'Champ de saisie et bouton d\'envoi mis en cache — plus de querySelector à chaque résultat vocal ou tick du minuteur.',
      'Remplacement du deprecated execCommand par l\'API Range pour contenteditable — élimine le reflow forcé pendant la dictée.',
      'Un seul listener clavier pour Ctrl+M et Push-to-Talk — moins de surcoût à chaque frappe.',
      'Modal des paramètres : animation d\'entrée, focus trap et étiquettes ARIA pour les lecteurs d\'écran.',
      'MutationObserver réduit de body à main — ne se déclenche plus sur les tokens de streaming ou les overlays.',
    ],
    hi: [
      'प्रमुख प्रदर्शन अनुकूलन: अधिक सहज ड्रैगिंग, तेज़ भाषण पहचान रेंडरिंग, और ChatGPT स्ट्रीमिंग के दौरान कम मेन-थ्रेड कार्य।',
      'कैश्ड इनपुट फ़ील्ड और सेंड बटन संदर्भ — हर भाषण परिणाम या टाइमर टिक पर querySelector नहीं।',
      'contenteditable के लिए deprecated execCommand को Range API से बदला — डिक्टेशन के दौरान forced reflow समाप्त।',
      'Ctrl+M और Push-to-Talk के लिए एकल कीबोर्ड listener — हर कीस्ट्रोक पर कम ओवरहेड।',
      'सेटिंग्स मोडल: एंट्री एनिमेशन, फोकस ट्रैप और स्क्रीन रीडर के लिए ARIA लेबल।',
      'MutationObserver को body से main तक सीमित किया — स्ट्रीमिंग टोकन या ओवरले पर अब सक्रिय नहीं।',
    ],
    ko: [
      '주요 성능 최적화: 더 부드러운 드래그, 더 빠른 음성 인식 렌더링, ChatGPT 스트리밍 중 메인 스레드 작업 감소.',
      '입력 필드 및 전송 버튼 참조 캐싱 — 음성 결과나 타이머 틱마다 querySelector 없음.',
      'contenteditable에 대해 더 이상 사용되지 않는 execCommand를 Range API로 교체 — 받아쓰기 중 강제 리플로우 제거.',
      'Ctrl+M 및 Push-to-Talk을 위한 단일 키보드 리스너 — 키 입력마다 오버헤드 감소.',
      '설정 모달: 등장 애니메이션, 포커스 트랩 및 스크린 리더용 ARIA 라벨.',
      'MutationObserver를 body에서 main으로 축소 — 스트리밍 토큰이나 오버레이에서 더 이상 트리거되지 않음.',
    ],
    pt: [
      'Otimização importante de desempenho: arrasto mais suave, renderização mais rápida do reconhecimento de voz e menos trabalho na thread principal durante o streaming do ChatGPT.',
      'Campo de entrada e botão de envio em cache — sem querySelector a cada resultado de voz ou tick do temporizador.',
      'Substituição do obsoleto execCommand pela API Range para contenteditable — elimina o reflow forçado durante o ditado.',
      'Único listener de teclado para Ctrl+M e Push-to-Talk — menos sobrecarga em cada tecla.',
      'Modal de configurações: animação de entrada, focus trap e rótulos ARIA para leitores de tela.',
      'MutationObserver reduzido de body para main — não dispara mais em tokens de streaming ou overlays.',
    ],
    uk: [
      'Масштабна оптимізація продуктивності: плавніше перетягування, швидший рендерінг розпізнавання мови, менше навантаження на головний потік під час стрімінгу ChatGPT.',
      'Кешування поля вводу та кнопки надсилання — більше немає querySelector при кожному результаті мови або тику таймера.',
      'Заміна застарілого execCommand на Range API для contenteditable — прибрано forced reflow під час диктування.',
      'Єдиний listener для Ctrl+M та Push-to-Talk — менше накладних витрат на кожне натискання.',
      'Вікно налаштувань: анімація появи, focus trap та ARIA-мітки для скрінрідерів.',
      'MutationObserver звужено з body до main — більше не спрацьовує на стрімінг токени та оверлеї.',
    ],
    zh: [
      '重大性能优化：更流畅的拖拽、更快的语音识别渲染，以及减少 ChatGPT 流式传输期间的主线程工作。',
      '缓存输入字段和发送按钮引用 — 不再在每次语音结果或计时器滴答时调用 querySelector。',
      '用 Range API 替换已弃用的 execCommand 处理 contenteditable — 消除听写期间的强制回流。',
      'Ctrl+M 和一键通合并为单个键盘监听器 — 每次按键开销更小。',
      '设置弹窗：入场动画、焦点陷阱和屏幕阅读器 ARIA 标签。',
      'MutationObserver 从 body 缩小到 main — 不再对流式标记或覆盖层触发。',
    ],
  },
  '2.4': {
    en: [
      'Smoother interim speech recognition spacing — spaces appear as words are recognized instead of after finalization.',
      'Security and reliability hardening: tightened resource exposure and fixed message handler leaks.',
      'Settings modal visually refreshed: modern header, card layout, two-column language grid, and compact footer.',
    ],
    ru: [
      'Более плавное распознавание речи — пробелы между словами появляются сразу, а не после финализации.',
      'Улучшения безопасности и надёжности: ограничен доступ к ресурсам расширения, исправлены утечки обработчиков сообщений.',
      'Окно настроек обновлено внешне: современный заголовок, карточки, двухколоночная сетка языков и компактный подвал.',
    ],
    es: [
      'Espaciado más fluido de los resultados intermedios de reconocimiento de voz: los espacios aparecen a medida que se reconocen las palabras, en lugar de después de la finalización.',
      'Mayor seguridad y fiabilidad: reducida la exposición de recursos y corregidas fugas de manejadores de mensajes.',
      'Modal de ajustes renovado visualmente: encabezado moderno, diseño de tarjetas, cuadrícula de idiomas en dos columnas y pie compacto.',
    ],
    fr: [
      "Espacement plus fluide des résultats intermédiaires de reconnaissance vocale — les espaces apparaissent au fur et à mesure que les mots sont reconnus, au lieu d'apparaître après finalisation.",
      "Renforcement de la sécurité et de la fiabilité : exposition des ressources réduite et fuites de gestionnaires de messages corrigées.",
      "Modal des paramètres rafraîchi visuellement : en-tête moderne, disposition en cartes, grille de langues sur deux colonnes et pied de page compact.",
    ],
    hi: [
      'अंतरिम भाषण पहचान में अधिक सहज जगह — शब्द पहचानते ही स्पेस दिखाई देते हैं, अंतिम रूप देने के बाद नहीं।',
      'सुरक्षा और विश्वसनीयता में सुधार: संसाधन एक्सपोज़र कड़ा किया गया और संदेश हैंडलर लीक ठीक किए गए।',
      'सेटिंग्स मोडल को दिखने में नया रूप दिया गया: आधुनिक हेडर, कार्ड लेआउट, दो-कॉलम भाषा ग्रिड और कॉम्पैक्ट फुटर।',
    ],
    ko: [
      '더 부드러운 중간 음성 인식 간격 — 단어가 인식되는 즉시 공백이 표시되어 최종 변환 후에만 나타나지 않습니다.',
      '보안 및 안정성 강화: 리소스 노출을 줄이고 메시지 핸들러 누수를 수정했습니다.',
      '설정 모달 UI 개선: 현대적인 헤더, 카드 레이아웃, 2열 언어 그리드, 컴팩트한 푸터.',
    ],
    pt: [
      'Espaçamento mais suave dos resultados intermediários de reconhecimento de voz — os espaços aparecem à medida que as palavras são reconhecidas, em vez de só após a finalização.',
      'Endurecimento de segurança e confiabilidade: exposição de recursos reduzida e vazamentos de manipuladores de mensagens corrigidos.',
      'Modal de configurações renovado visualmente: cabeçalho moderno, layout em cartões, grade de idiomas em duas colunas e rodapé compacto.',
    ],
    uk: [
      'Більш плавне розпізнавання мови — пробіли між словами з’являються одразу, а не після фіналізації.',
      'Покращення безпеки та надійності: обмежено доступ до ресурсів розширення, виправлено витоки обробників повідомлень.',
      'Вікно налаштувань оновлено візуально: сучасний заголовок, картковий макет, двоколонкова сітка мов і компактний підвал.',
    ],
    zh: [
      '更流畅的临时语音识别间距 — 空格会在识别单词时立即出现，而不是等到最终确定后才显示。',
      '安全性与可靠性增强：收紧资源暴露范围，并修复消息处理程序泄漏。',
      '设置窗口视觉升级：现代标题、卡片布局、双列语言网格、紧凑页脚。',
    ],
  },
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

export const CURRENT_VERSION = '2.5';

export const getChangelog = (version, locale) => {
  const data = CHANGELOG_DATA[version];
  if (!data) return [];
  return data[locale] || data.en || [];
};
