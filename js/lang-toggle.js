/* global KEEP */

KEEP.initLanguageToggle = () => {
  const languageToggleConfig = KEEP.theme_config.language_switch;

  if (!languageToggleConfig || languageToggleConfig.enable !== true) {
    return;
  }

  const storageKey = languageToggleConfig.storage_key || 'KEEP-LANGUAGE-PREFERENCE';
  const configuredLanguages = Array.isArray(languageToggleConfig.languages)
    ? languageToggleConfig.languages
    : [];

  const normalizeLanguage = (language) => {
    const target = String(language || '').trim().toLowerCase().replace('_', '-');
    if (target === 'zh') return 'zh-cn';
    if (target === 'en' || target.startsWith('en-')) return 'en';
    if (target.startsWith('zh-')) return 'zh-cn';
    return target;
  };

  const getLanguageDictionary = (language) => {
    const normalized = normalizeLanguage(language);
    const resources = KEEP.language_resources || {};

    if (resources[normalized]) return resources[normalized];
    for (const key of Object.keys(resources)) {
      if (normalizeLanguage(key) === normalized) return resources[key];
    }

    return resources.en || resources['zh-cn'] || {};
  };

  const languageResources = KEEP.language_resources || {};
  const fallbackLanguage = normalizeLanguage(KEEP.language_default || KEEP.hexo_config.language || 'zh-cn');
  const htmlLanguage = (language) => (language && language.startsWith('zh') ? 'zh-CN' : 'en');
  const languageManualKey = `${storageKey}:manual`;
  const hasManualSelection = (() => {
    try {
      return sessionStorage.getItem(languageManualKey) === '1';
    } catch (err) {
      return false;
    }
  })();

  const availableLanguages = [];
  if (configuredLanguages.length) {
    configuredLanguages.forEach((item) => {
      const normalized = normalizeLanguage(item);
      if (normalized && !availableLanguages.includes(normalized)) {
        availableLanguages.push(normalized);
      }
    });
  }

  [fallbackLanguage, 'zh-cn', 'en'].forEach((item) => {
    if (item && !availableLanguages.includes(item)) {
      availableLanguages.push(item);
    }
  });

  const isLanguageAvailable = (language) => availableLanguages.includes(normalizeLanguage(language));

  const translate = (dictionary, keyPath) => {
    if (!dictionary || !keyPath) return undefined;

    let value = dictionary;
    const keys = keyPath.split('.');
    for (const key of keys) {
      if (!value || typeof value !== 'object' || !(key in value)) return undefined;
      value = value[key];
    }

    return typeof value === 'string' ? value : undefined;
  };

  const getLanguageText = (language, keyPath) => {
    const primary = translate(getLanguageDictionary(language), keyPath);
    if (primary !== undefined) {
      return primary;
    }

    const fallback = translate(getLanguageDictionary(fallbackLanguage), keyPath);
    return fallback !== undefined ? fallback : null;
  };

  const applyTextTransform = (value, mode) => {
    if (!value) return value;
    if (mode === 'upper') return value.toUpperCase();
    if (mode === 'lower') return value.toLowerCase();
    if (mode === 'capitalize') return value.charAt(0).toUpperCase() + value.slice(1);
    return value;
  };

  let currentLanguage = normalizeLanguage(
    (hasManualSelection ? localStorage.getItem(storageKey) : null)
    || languageToggleConfig.default_language
    || KEEP.hexo_config.language
    || fallbackLanguage
  );

  if (!isLanguageAvailable(currentLanguage)) {
    currentLanguage = availableLanguages[0];
  }

  const getLanguageLabel = (language) => {
    const normalized = normalizeLanguage(language);
    return (
      getLanguageText(normalized, `language_names.${normalized}`)
      || normalized.toUpperCase()
    );
  };

  const getNextLanguage = () => {
    if (availableLanguages.length <= 1) return currentLanguage;
    const index = availableLanguages.indexOf(currentLanguage);
    return availableLanguages[(index + 1) % availableLanguages.length];
  };

  const shouldShowToggle = availableLanguages.length > 1;
  const toggleNodes = document.querySelectorAll('[data-language-toggle], [data-language-toggle-text]');
  if (!shouldShowToggle) {
    toggleNodes.forEach((node) => {
      node.style.display = 'none';
    });
    document.documentElement.lang = htmlLanguage(currentLanguage);
    document.body.dataset.lang = currentLanguage;
    return;
  }

  const updateI18nDom = () => {
    document.querySelectorAll('[data-i18n-placeholder]').forEach((item) => {
      const key = item.dataset.i18nPlaceholder;
      const value = getLanguageText(currentLanguage, key);
      if (typeof value === 'string') {
        item.setAttribute('placeholder', value);
      }
    });

    document.querySelectorAll('[data-i18n-title]').forEach((item) => {
      const key = item.dataset.i18nTitle;
      const value = getLanguageText(currentLanguage, key);
      if (typeof value === 'string') {
        item.setAttribute('title', value);
      }
    });

    document.querySelectorAll('[data-i18n-aria-label]').forEach((item) => {
      const key = item.dataset.i18nAriaLabel;
      const value = getLanguageText(currentLanguage, key);
      if (typeof value === 'string') {
        item.setAttribute('aria-label', value);
      }
    });

    document.querySelectorAll('[data-i18n]').forEach((item) => {
      const key = item.dataset.i18n;
      const caseType = item.dataset.i18nCase;
      const value = getLanguageText(currentLanguage, key);
      if (typeof value === 'string') {
        item.textContent = applyTextTransform(value, caseType);
      }
    });

    const nextLanguageText = getLanguageLabel(getNextLanguage());
    const nextLanguageAction = getLanguageText(currentLanguage, 'language_toggle_to');
    const languageTooltip = (
      typeof nextLanguageAction === 'string'
        ? nextLanguageAction.replace('%s', nextLanguageText)
        : `Switch to ${nextLanguageText}`
    );
    document.querySelectorAll('[data-language-toggle-text]').forEach((item) => {
      item.textContent = nextLanguageText;
    });
    document.querySelectorAll('[data-language-toggle]').forEach((button) => {
      button.setAttribute('title', languageTooltip);
    });

    const groupedSwitchNodes = {};
    document.querySelectorAll('[data-lang-group][data-lang]').forEach((item) => {
      const group = item.dataset.langGroup;
      const language = normalizeLanguage(item.dataset.lang);
      if (!group || !language) return;
      if (!groupedSwitchNodes[group]) {
        groupedSwitchNodes[group] = [];
      }
      groupedSwitchNodes[group].push({node: item, language});
    });

    Object.values(groupedSwitchNodes).forEach((nodes) => {
      if (!nodes.length) return;

      const match = nodes.find((item) => item.language === currentLanguage);
      const fallback = match;

      nodes.forEach((item) => {
        item.node.style.display = item === fallback ? '' : 'none';
      });
    });

    document.documentElement.lang = htmlLanguage(currentLanguage);
    document.body.dataset.lang = currentLanguage;
  };

  const setCurrentLanguage = (nextLanguage) => {
    const normalizedNext = normalizeLanguage(nextLanguage);
    if (!isLanguageAvailable(normalizedNext)) return;

    currentLanguage = normalizedNext;
    localStorage.setItem(storageKey, currentLanguage);
    try {
      sessionStorage.setItem(languageManualKey, '1');
    } catch (err) {
      // keep behavior if storage APIs are unavailable
    }
    updateI18nDom();
  };

  document.querySelectorAll('[data-language-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextLanguage = getNextLanguage();
      setCurrentLanguage(nextLanguage);
    });
  });

  if (KEEP.theme_config.pjax && KEEP.theme_config.pjax.enable === true) {
    window.addEventListener('pjax:success', () => {
      updateI18nDom();
    });
  }

  setCurrentLanguage(currentLanguage);
};
