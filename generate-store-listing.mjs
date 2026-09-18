#!/usr/bin/env node
// Generates STORE_LISTING.md for every supported locale.
// The "What's New" sections are pulled from changelog.js automatically —
// add a version there, run `node generate-store-listing.mjs`, done.

import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {VERSIONS, getChangelog} from './changelog.js';

const ROOT = dirname(fileURLToPath(import.meta.url));

// Static listing copy per locale. Features lists live here; changelog
// entries do NOT — they come from changelog.js.
const LISTING = {
  en: {
    name: 'English',
    title: 'Voice to Text for ChatGPT',
    short: 'Speak instead of typing. Hands-free dictation with auto-send on silence, push-to-talk, and a floating microphone panel.',
    featuresHeader: 'Key features:',
    features: [
      'Real-time speech-to-text in the ChatGPT input field',
      'Auto-send after a configurable silence delay',
      'Push-to-Talk (walkie-talkie) mode — hold a key, speak, release to stop',
      'Collapsible floating panel with drag-and-drop positioning',
      'Adjustable ChatGPT content width',
      'Light / Dark / System theme selector',
      'Voice punctuation commands in your dictation language (~30 languages)',
      'Word replacements in any language',
      'Support for multiple recognition languages',
    ],
    intro: 'Turn your voice into text on ChatGPT.',
    body: 'This extension adds a floating microphone panel to the ChatGPT interface, letting you dictate messages hands-free. No extra apps or cloud services required — everything runs locally in your browser.',
    privacy: 'Your voice data never leaves your device. All processing happens inside the browser using the built-in Web Speech API.',
    whatsNew: 'What’s New',
    versionLabel: (v) => `Version ${v}`,
  },
  ru: {
    name: 'Russian',
    title: 'Голосовой ввод для ChatGPT',
    short: 'Говорите вместо печати. Диктовка с автоотправкой по тишине, режим рации и плавающая панель микрофона.',
    featuresHeader: 'Основные возможности:',
    features: [
      'Распознавание речи в реальном времени в поле ввода ChatGPT',
      'Автоотправка после настраиваемой паузы',
      'Режим Push-to-Talk (как рация) — зажмите клавишу, говорите, отпустите — запись остановится',
      'Сворачиваемая плавающая панель с возможностью перетаскивания',
      'Регулировка ширины контента ChatGPT',
      'Выбор темы: светлая / тёмная / системная',
      'Голосовые команды пунктуации на языке диктовки (~30 языков)',
      'Автозамена слов на любом языке',
      'Поддержка множества языков распознавания',
    ],
    intro: 'Превратите свой голос в текст прямо в ChatGPT.',
    body: 'Расширение добавляет плавающую панель микрофона в интерфейс ChatGPT, позволяя диктовать сообщения без помощи рук. Никаких сторонних приложений или облачных сервисов — всё работает локально в браузере.',
    privacy: 'Ваши голосовые данные не покидают устройство. Вся обработка происходит в браузере через встроенный Web Speech API.',
    whatsNew: 'Что нового',
    versionLabel: (v) => `Версия ${v}`,
  },
  es: {
    name: 'Spanish',
    title: 'Dictado por voz para ChatGPT',
    short: 'Habla en vez de escribir. Dictado manos libres con envío automático tras silencio, modo walkie-talkie y panel flotante de micrófono.',
    featuresHeader: 'Características principales:',
    features: [
      'Conversión de voz a texto en tiempo real en el campo de entrada de ChatGPT',
      'Envío automático tras un silencio configurable',
      'Modo Push-to-Talk (walkie-talkie) — mantén pulsada una tecla, habla, suelta para detener',
      'Panel flotante plegable con posición arrastrable',
      'Ajuste del ancho de contenido de ChatGPT',
      'Selector de tema: claro / oscuro / sistema',
      'Comandos de puntuación por voz en tu idioma de dictado (~30 idiomas)',
      'Reemplazos de palabras en cualquier idioma',
      'Soporte para múltiples idiomas de reconocimiento',
    ],
    intro: 'Convierte tu voz en texto directamente en ChatGPT.',
    body: 'Esta extensión añade un panel flotante de micrófono a la interfaz de ChatGPT, permitiéndote dictar mensajes manos libres. No necesitas apps adicionales ni servicios en la nube — todo funciona localmente en tu navegador.',
    privacy: 'Tus datos de voz nunca salen de tu dispositivo. Todo el procesamiento se realiza dentro del navegador mediante la API Web Speech integrada.',
    whatsNew: 'Novedades',
    versionLabel: (v) => `Versión ${v}`,
  },
  uk: {
    name: 'Ukrainian',
    title: 'Голосове введення для ChatGPT',
    short: 'Говоріть замість друкування. Диктування з автовідправкою за тишею, режим рації та плаваюча панель мікрофона.',
    featuresHeader: 'Основні можливості:',
    features: [
      'Розпізнавання мови в реальному часі в полі введення ChatGPT',
      'Автовідправка після налаштовуваної паузи',
      'Режим Push-to-Talk (як рація) — затисніть клавішу, говоріть, відпустіть — запис зупиниться',
      'Згортна плаваюча панель з можливістю перетягування',
      'Регулювання ширини контенту ChatGPT',
      'Вибір теми: світла / темна / системна',
      'Голосові команди розділових знаків мовою диктування (~30 мов)',
      'Автозаміна слів будь-якою мовою',
      'Підтримка багатьох мов розпізнавання',
    ],
    intro: 'Перетворіть свій голос на текст прямо в ChatGPT.',
    body: 'Розширення додає плаваючу панель мікрофона до інтерфейсу ChatGPT, дозволяючи диктувати повідомлення без допомоги рук. Жодних сторонніх додатків чи хмарних сервісів — усе працює локально в браузері.',
    privacy: 'Ваші голосові дані не залишають пристрій. Уся обробка відбувається в браузері через вбудований Web Speech API.',
    whatsNew: 'Що нового',
    versionLabel: (v) => `Версія ${v}`,
  },
  zh: {
    name: 'Chinese',
    title: 'ChatGPT 语音输入',
    short: '说话代替打字。静音自动发送、一键通模式、浮动麦克风面板。',
    featuresHeader: '主要功能：',
    features: [
      'ChatGPT 输入框中的实时语音转文字',
      '可配置的静音后自动发送',
      '一键通（对讲机）模式 — 按住按键，说话，松开停止',
      '可折叠的浮动面板，可拖动定位',
      '调整 ChatGPT 内容宽度',
      '主题选择器：浅色 / 深色 / 系统',
      '听写语言中的语音标点命令（约30种语言）',
      '任意语言的单词替换',
      '支持多种识别语言',
    ],
    intro: '将您的声音转换为 ChatGPT 中的文本。',
    body: '此扩展程序在 ChatGPT 界面中添加了浮动麦克风面板，让您可以免提口述消息。无需额外的应用程序或云服务 — 一切都在浏览器中本地运行。',
    privacy: '您的语音数据永远不会离开您的设备。所有处理都在浏览器内通过内置的 Web Speech API 完成。',
    whatsNew: '更新内容',
    versionLabel: (v) => `版本 ${v}`,
  },
  ko: {
    name: 'Korean',
    title: 'ChatGPT 음성 입력',
    short: '타이핑 대신 말하세요. 침묵 시 자동 전송, 무전기 모드 및 플로팅 마이크 패널.',
    featuresHeader: '주요 기능:',
    features: [
      'ChatGPT 입력 필드의 실시간 음성 인식',
      '구성 가능한 침묵 후 자동 전송',
      '푸시 투 토크(무전기) 모드 — 키를 누르고, 말하고, 놓으면 중지',
      '드래그 앤 드롭 위치 지정이 가능한 접이식 플로팅 패널',
      'ChatGPT 콘텐츠 너비 조정',
      '테마 선택기: 라이트 / 다크 / 시스템',
      '받아쓰기 언어의 음성 문장 부호 명령(~30개 언어)',
      '모든 언어의 단어 치환',
      '다양한 인식 언어 지원',
    ],
    intro: 'ChatGPT에서 음성을 텍스트로 변환하세요.',
    body: '이 확장 프로그램은 ChatGPT 인터페이스에 플로팅 마이크 패널을 추가하여 핸즈프리로 메시지를 받아쓸 수 있게 해줍니다. 추가 앱이나 클라우드 서비스가 필요 없습니다 — 모든 것이 브라우저에서 로컬로 실행됩니다.',
    privacy: '음성 데이터는 절대 기기를 떠나지 않습니다. 모든 처리는 내장된 Web Speech API를 사용하여 브라우저 내부에서 이루어집니다.',
    whatsNew: '업데이트 내용',
    versionLabel: (v) => `버전 ${v}`,
  },
  fr: {
    name: 'French',
    title: 'Dictée vocale pour ChatGPT',
    short: 'Parlez au lieu de taper. Envoi automatique en cas de silence, mode talkie-walkie, panneau micro flottant.',
    featuresHeader: 'Fonctionnalités principales :',
    features: [
      'Reconnaissance vocale en temps réel dans le champ de saisie ChatGPT',
      'Envoi automatique après une pause configurable',
      'Mode Push-to-Talk (talkie-walkie) — maintenez la touche, parlez, relâchez pour arrêter',
      'Panneau flottant pliable avec position glissante',
      'Ajustement de la largeur du contenu ChatGPT',
      'Sélecteur de thème : clair / sombre / système',
      'Commandes vocales de ponctuation dans votre langue de dictée (~30 langues)',
      "Remplacements de mots dans n'importe quelle langue",
      'Prise en charge de plusieurs langues de reconnaissance',
    ],
    intro: 'Transformez votre voix en texte directement dans ChatGPT.',
    body: "Cette extension ajoute un panneau micro flottant à l'interface ChatGPT, vous permettant de dicter vos messages mains libres. Pas d'application supplémentaire ni de service cloud — tout fonctionne localement dans le navigateur.",
    privacy: "Vos données vocales ne quittent jamais votre appareil. Tout le traitement s'effectue dans le navigateur via l'API Web Speech intégrée.",
    whatsNew: 'Nouveautés',
    versionLabel: (v) => `Version ${v}`,
  },
  pt: {
    name: 'Portuguese',
    title: 'Ditado por voz para ChatGPT',
    short: 'Fale em vez de digitar. Envio automático em silêncio, modo rádio e painel flutuante de microfone.',
    featuresHeader: 'Principais recursos:',
    features: [
      'Reconhecimento de voz em tempo real no campo de entrada do ChatGPT',
      'Envio automático após uma pausa configurável',
      'Modo Push-to-Talk (rádio) — segure a tecla, fale, solte para parar',
      'Painel flutuante dobrável com posição arrastável',
      'Ajuste da largura do conteúdo do ChatGPT',
      'Seletor de tema: claro / escuro / sistema',
      'Comandos de pontuação por voz no seu idioma de ditado (~30 idiomas)',
      'Substituições de palavras em qualquer idioma',
      'Suporte a vários idiomas de reconhecimento',
    ],
    intro: 'Transforme sua voz em texto diretamente no ChatGPT.',
    body: 'Esta extensão adiciona um painel flutuante de microfone à interface do ChatGPT, permitindo que você dite mensagens sem usar as mãos. Nenhum aplicativo adicional ou serviço em nuvem — tudo funciona localmente no navegador.',
    privacy: 'Seus dados de voz nunca saem do seu dispositivo. Todo o processamento ocorre dentro do navegador usando a API Web Speech integrada.',
    whatsNew: 'Novidades',
    versionLabel: (v) => `Versão ${v}`,
  },
  hi: {
    name: 'Hindi',
    title: 'ChatGPT के लिए वॉइस टाइपिंग',
    short: 'टाइपिंग के बजाय बोलें। शांति पर ऑटो-सेंड, वॉकी-टॉकी मोड और फ्लोटिंग माइक पैनल।',
    featuresHeader: 'मुख्य विशेषताएँ:',
    features: [
      'ChatGPT इनपुट फ़ील्ड में रीयल-टाइम स्पीच रिकग्निशन',
      'कॉन्फ़िगर करने योग्य पॉज़ के बाद ऑटो-सेंड',
      'पुश-टू-टॉक (वॉकी-टॉकी) मोड — कुंजी दबाएँ, बोलें, छोड़ें — रिकॉर्डिंग बंद',
      'ड्रैग करने योग्य स्थिति के साथ फोल्डेबल फ्लोटिंग पैनल',
      'ChatGPT सामग्री की चौड़ाई को समायोजित करें',
      'थीम चयनकर्ता: लाइट / डार्क / सिस्टम',
      'आपकी डिक्टेशन भाषा में वॉइस विराम चिह्न कमांड (~30 भाषाएँ)',
      'किसी भी भाषा में शब्द प्रतिस्थापन',
      'कई रिकग्निशन भाषाओं का समर्थन',
    ],
    intro: 'अपनी आवाज़ को सीधे ChatGPT में टेक्स्ट में बदलें।',
    body: 'यह एक्सटेंशन ChatGPT इंटरफेस में एक फ्लोटिंग माइक पैनल जोड़ता है, जिससे आप बिना हाथ लगाए संदेश डिक्टेट कर सकते हैं। कोई अतिरिक्त ऐप या क्लाउड सेवा नहीं — सब कुछ ब्राउज़र में लोकल रूप से काम करता है।',
    privacy: 'आपकी आवाज़ का डेटा कभी भी आपके डिवाइस को नहीं छोड़ता। सारी प्रोसेसिंग बिल्ट-इन Web Speech API के माध्यम से ब्राउज़र के अंदर होती है।',
    whatsNew: 'नया क्या है',
    versionLabel: (v) => `संस्करण ${v}`,
  },
};

const out = [
  '# Chrome Web Store Listing Translations',
  '',
  '<!-- GENERATED FILE — do not edit by hand. Run `node generate-store-listing.mjs`. -->',
  '',
  'Paste these into the Chrome Web Store Dashboard under the **Store listing** tab for each locale.',
];

for (const [locale, l] of Object.entries(LISTING)) {
  out.push('', '---', '', `## ${l.name} (${locale})`, '');
  out.push('**Title**  ', l.title, '');
  out.push('**Short description**  ', l.short, '');
  out.push('**Full description**  ');
  out.push(l.intro, '', l.body, '');
  out.push(l.featuresHeader);
  l.features.forEach((f) => out.push(`- ${f}`));
  out.push('', l.privacy, '');
  out.push(`**${l.whatsNew}**`, '');
  for (const v of VERSIONS) {
    const entries = getChangelog(v, locale);
    if (!entries.length) continue;
    out.push(`**${l.versionLabel(v)}**  `);
    entries.forEach((e) => out.push(`- ${e}`));
    out.push('');
  }
}

out.push(
  '---',
  '',
  '## How to add a new language',
  '',
  '1. Create `_locales/<lang>/messages.json` (e.g. `_locales/de/messages.json`).',
  '2. Copy the structure from `_locales/en/messages.json` and translate every `message` field.',
  '3. Add the locale\'s static copy to `LISTING` in `generate-store-listing.mjs` and changelog entries to `changelog.js`.',
  '4. Add the same locale in the Chrome Web Store Dashboard under **Store listing → Add a language**.',
  '5. Re-run `node generate-store-listing.mjs` and paste the localized title, short description, and full description into the Dashboard fields.',
  '6. Chrome will automatically pick the locale that matches the user’s browser language and fall back to `default_locale` (English) for missing keys.',
  '',
);

writeFileSync(join(ROOT, 'STORE_LISTING.md'), out.join('\n'));
console.log(`STORE_LISTING.md generated for ${Object.keys(LISTING).length} locales, versions: ${VERSIONS.join(', ')}`);
