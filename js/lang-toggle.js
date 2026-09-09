/* global KEEP */

KEEP.initLanguageToggle = () => {
  const languageToggleConfig = KEEP.theme_config.language_switch;

  if (!languageToggleConfig || languageToggleConfig.enable !== true) {
    return;
  }

  // KEEP.refresh and PJAX may initialize the same page more than once.
  if (KEEP.languageToggleController) {
    KEEP.languageToggleController.refresh();
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

  const fallbackLanguage = normalizeLanguage(KEEP.language_default || KEEP.hexo_config.language || 'zh-cn');
  const htmlLanguage = (language) => (language && language.startsWith('zh') ? 'zh-CN' : 'en');
  const languageManualKey = `${storageKey}:manual`;
  const readStorage = (storageName, key) => {
    try {
      return window[storageName].getItem(key);
    } catch (err) {
      return null;
    }
  };
  const writeStorage = (storageName, key, value) => {
    try {
      window[storageName].setItem(key, value);
    } catch (err) {
      // A blocked or full store must not prevent switching in this page.
    }
  };
  const savedLanguage = ['localStorage', 'sessionStorage'].reduce((saved, storageName) => (
    saved || (readStorage(storageName, languageManualKey) === '1'
      ? (readStorage(storageName, storageKey) || readStorage('localStorage', storageKey)) : null)
  ), null);

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

  // New visitors see the unchanged Chinese original; only a click saves a choice.
  let currentLanguage = normalizeLanguage(savedLanguage || 'zh-cn');

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

  const isVisible = (node) => node.isConnected && node.getClientRects().length > 0;
  const visibleLanguageContainers = () => {
    const nodes = Array.from(document.querySelectorAll('[data-lang-group][data-lang]'))
      .filter(isVisible);
    return nodes.filter((node) => !nodes.some((parent) => parent !== node && parent.contains(node)));
  };

  const getTOCTarget = (link) => {
    const href = link.getAttribute('href') || '';
    if (!href.startsWith('#')) return null;
    let id;
    try {
      id = decodeURIComponent(href.slice(1));
    } catch (err) {
      return null;
    }
    // Both translations can contain the same heading id. Resolve it in the
    // visible article first, rather than scrolling to a hidden Chinese heading.
    const content = Array.from(document.querySelectorAll('[data-lang-group="article-content-body"]'))
      .find(isVisible);
    if (content) {
      const localTarget = Array.from(content.querySelectorAll('[id]')).find((node) => node.id === id);
      if (localTarget) return localTarget;
    }
    const target = document.getElementById(id);
    return target && isVisible(target) ? target : null;
  };

  const updateActiveTOC = () => {
    const entries = Array.from(document.querySelectorAll('.post-toc a.nav-link'))
      .filter(isVisible).map((link) => ({link, target: getTOCTarget(link)}))
      .filter((entry) => entry.target);
    document.querySelectorAll('.post-toc .active, .post-toc .active-current').forEach((node) => {
      node.classList.remove('active', 'active-current');
    });
    if (KEEP.utils) {
      KEEP.utils.sections = entries.map((entry) => entry.target);
    }
    if (!entries.length) return;
    let index = entries.findIndex((entry) => entry.target.getBoundingClientRect().top > 20);
    if (index === -1) index = entries.length - 1;
    else if (index > 0) index--;
    const link = entries[index].link;
    link.classList.add('active', 'active-current');
    for (let parent = link.parentElement; parent && !parent.matches('.post-toc'); parent = parent.parentElement) {
      if (parent.matches('li')) parent.classList.add('active');
    }
  };

  const refreshTOC = () => {
    if (KEEP.utils) {
      KEEP.utils.findActiveIndexByTOC = updateActiveTOC;
    }
    updateActiveTOC();
  };

  let mathRevision = 0;
  let mathTimer = null;
  let mathRunning = false;
  let mathWaits = 0;

  const runMath = () => {
    mathTimer = null;
    if (mathRunning || !visibleLanguageContainers().length) return;
    const mathJax = window.MathJax;
    const hub = mathJax && mathJax.Hub;
    const hasV2 = hub && typeof hub.Queue === 'function';
    const hasV3 = mathJax && typeof mathJax.typesetPromise === 'function';
    if (!hasV2 && !hasV3) {
      // The CDN script loads asynchronously. Its load event also retries after
      // this bounded polling window, including when the fallback CDN is used.
      if (mathWaits++ < 80) mathTimer = window.setTimeout(runMath, 250);
      return;
    }
    const revision = mathRevision;
    mathRunning = true;
    const finish = () => {
      mathRunning = false;
      refreshTOC();
      if (revision !== mathRevision) mathTimer = window.setTimeout(runMath, 0);
    };
    const currentNodes = () => revision === mathRevision ? visibleLanguageContainers() : [];
    if (hasV2) {
      try {
        hub.Queue(
          () => {
            const nodes = currentNodes();
            if (nodes.length) return hub.Typeset(nodes);
          },
          () => {
            const nodes = currentNodes();
            // Typeset leaves existing output unchanged. Rerender recalculates
            // widths for formulas that MathJax first processed while hidden.
            if (nodes.length) return hub.Rerender(nodes);
          },
          finish
        );
      } catch (err) {
        finish();
      }
    } else {
      Promise.resolve(mathJax.startup && mathJax.startup.promise)
        .then(() => {
          const nodes = currentNodes();
          if (nodes.length) return mathJax.typesetPromise(nodes);
        })
        .then(finish, finish);
    }
  };

  const requestMathRender = () => {
    mathRevision++;
    mathWaits = 0;
    window.clearTimeout(mathTimer);
    // Let the newly visible translation acquire its normal layout first.
    mathTimer = window.setTimeout(runMath, 0);
  };

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

    const groupedSwitchNodes = Object.create(null);
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
        item.node.setAttribute('aria-hidden', item === fallback ? 'false' : 'true');
        item.node.setAttribute('lang', htmlLanguage(item.language));
      });
    });

    document.documentElement.lang = htmlLanguage(currentLanguage);
    document.body.dataset.lang = currentLanguage;
    const relativeDates = getLanguageDictionary(currentLanguage).ago;
    if (relativeDates) KEEP.language_ago = relativeDates;
    if (KEEP.utils && typeof KEEP.utils.setHowLongAgoInHome === 'function') {
      KEEP.utils.setHowLongAgoInHome();
    }
    requestMathRender();
    // main.js initializes KEEP.utils after this controller on the first load.
    window.setTimeout(refreshTOC, 0);
  };

  const setCurrentLanguage = (nextLanguage) => {
    const normalizedNext = normalizeLanguage(nextLanguage);
    if (!isLanguageAvailable(normalizedNext)) return;

    currentLanguage = normalizedNext;
    ['localStorage', 'sessionStorage'].forEach((storageName) => {
      writeStorage(storageName, storageKey, currentLanguage);
      writeStorage(storageName, languageManualKey, '1');
    });
    updateI18nDom();
  };

  KEEP.languageToggleController = {refresh: updateI18nDom};

  // Delegation handles replaced PJAX buttons without adding a second listener.
  document.addEventListener('click', (event) => {
    const target = event.target.nodeType === 1 ? event.target : event.target.parentElement;
    if (!target) return;
    const button = target.closest('[data-language-toggle]');
    if (button) {
      event.preventDefault();
      setCurrentLanguage(getNextLanguage());
      return;
    }
    const link = target.closest('.post-toc a.nav-link');
    if (!link || !isVisible(link)) return;
    const heading = getTOCTarget(link);
    if (!heading) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const top = heading.getBoundingClientRect().top + window.scrollY - 10;
    if (typeof window.anime === 'function') {
      window.anime({targets: document.scrollingElement, duration: 500, easing: 'linear', scrollTop: top});
    } else {
      window.scrollTo({top, behavior: 'smooth'});
    }
  }, true);

  window.addEventListener('scroll', refreshTOC, {capture: true, passive: true});
  window.addEventListener('load', requestMathRender);
  document.addEventListener('load', (event) => {
    if (event.target.tagName === 'SCRIPT' && /MathJax\.js(?:\?|$)/i.test(event.target.src || '')) {
      requestMathRender();
    }
  }, true);

  if (KEEP.theme_config.pjax && KEEP.theme_config.pjax.enable === true) {
    window.addEventListener('pjax:success', () => {
      updateI18nDom();
    });
  }

  updateI18nDom();
};
