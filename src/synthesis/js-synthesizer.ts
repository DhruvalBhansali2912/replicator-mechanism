import * as cheerio from 'cheerio';
import { SectionAST } from './types.js';

export class JsSynthesizer {
  /**
   * Synthesizes modular, zero-dependency vanilla ES6 for interactive section behaviors.
   */
  public synthesize(ast: SectionAST): string {
    const scripts: string[] = [];

    // Universal Embedded Component Scripts (Canvas animations, WebGL, interactive widgets)
    if (ast.rawSectionHtml) {
      try {
        const $ = cheerio.load(ast.rawSectionHtml, { xmlMode: false }, false);
        $('script').each((_, el) => {
          const type = ($(el).attr('type') || '').toLowerCase();
          const src = ($(el).attr('src') || '').toLowerCase();
          if (type.includes('json') || type.includes('ld+json')) return;
          if (src && /(?:google-analytics|gtag|facebook|clarity|segment|datadog|intercom|pixel|telemetry)/i.test(src)) return;
          let content = $(el).html() || '';
          if (!content.trim()) return;
          if (/(?:google-analytics|gtag\(|fbq\(|clarity\(|window\.__NEXT_DATA__)/i.test(content)) return;

          // Universal hydration resilience: ensure scripts re-evaluating headings handle both raw and pre-hydrated DOM structures
          if (content.includes("name.querySelector('.wordmark')")) {
            content = content.replace(
              /var wordmark = name\.querySelector\(\x27\.wordmark\x27\);[\s\S]*?src\.appendChild\(span\(\x27moo-rest\x27, restText\.replace\(\/\\s\+\/g, \x27 \x27\)\.trim\(\)\)\);/,
              `var wordmark = name.querySelector('.wordmark') || name.querySelector('.moo-claude');
      var existingRest = name.querySelector('.moo-rest');
      var restText = existingRest ? existingRest.textContent : '';
      if (!existingRest) {
        for (var c = 0; c < name.childNodes.length; c++) {
          if (name.childNodes[c] !== wordmark) restText += name.childNodes[c].textContent;
        }
      }
      var span = function (className, text) {
        var el = document.createElement('span');
        el.className = className;
        if (text) el.textContent = text;
        return el;
      };
      var src = span('moo-src');
      if (wordmark) {
        var claude = span('moo-claude');
        var mark = span('moo-mark');
        mark.setAttribute('aria-hidden', 'true');
        claude.appendChild(span('moo-sr', 'Claude'));
        claude.appendChild(mark);
        src.appendChild(claude);
        src.appendChild(document.createTextNode(' '));
      }
      src.appendChild(span('moo-rest', restText.replace(/\\s+/g, ' ').trim()));`
            );
          }

          scripts.push(`// Preserved Component Script\n${content}`);
        });
      } catch (err) {
        // ignore
      }
    }

    // 0. Behavioral State Mutation Controller (Synthesized from In-Situ DOM Mutation Probes)
    if (ast.interactive?.recordedTransitions && ast.interactive.recordedTransitions.length > 0) {
      scripts.push(`
  // Behavioral State Mutation Controller (Dynamic In-Situ Recordings)
  (function() {
    const recordedInteractions = ${JSON.stringify(ast.interactive.recordedTransitions, null, 4)};
    const root = document.querySelector('#${ast.id}') || document;

    function queryElements(selector) {
      if (!selector) return [];
      try {
        let els = Array.from(root.querySelectorAll(selector));
        if (!els.length) {
          els = Array.from(document.querySelectorAll(selector));
        }
        if (!els.length) {
          const parts = selector.split(/\s*>\s*/);
          if (parts.length > 1) {
            const lastPart = parts[parts.length - 1];
            els = Array.from(root.querySelectorAll(lastPart));
            if (!els.length) {
              els = Array.from(document.querySelectorAll(lastPart));
            }
          }
        }
        // Universal disambiguation for indexed selectors like .class:nth-of-type(n)
        const nthMatch = selector.match(/^(.+):nth-of-type\\((\\d+)\\)$/);
        if (nthMatch && (!els.length || els.length > 1)) {
          const baseSel = nthMatch[1];
          const targetIndex = parseInt(nthMatch[2], 10) - 1;
          let baseMatches = Array.from(root.querySelectorAll(baseSel));
          if (!baseMatches.length) {
            baseMatches = Array.from(document.querySelectorAll(baseSel));
          }
          if (baseMatches.length > targetIndex && targetIndex >= 0) {
            return [baseMatches[targetIndex]];
          }
        }
        return els;
      } catch (err) {
        return [];
      }
    }

    recordedInteractions.forEach(function(interaction) {
      if (
        interaction.triggerSelector &&
        (interaction.triggerSelector.includes('category') ||
         interaction.triggerSelector.includes('tab__item') ||
         interaction.triggerSelector.includes('[role="tab"]') ||
         interaction.triggerSelector.includes('arrow') ||
         interaction.triggerSelector.includes('swiper') ||
         interaction.triggerSelector.includes('indicator') ||
         interaction.triggerSelector.includes('next') ||
         interaction.triggerSelector.includes('prev') ||
         interaction.triggerSelector.includes('slider') ||
         interaction.triggerSelector.includes('carousel') ||
         interaction.triggerSelector.includes('nav') ||
         interaction.triggerSelector.includes('menu') ||
         interaction.triggerSelector.includes('header') ||
         interaction.triggerSelector.includes('accordion'))
      ) {
        return;
      }
      const triggers = queryElements(interaction.triggerSelector);
      if (!triggers.length) return;

      triggers.forEach(function(trigger) {
        if (trigger.matches && trigger.matches('[role="tab"], .tab__item-title, [aria-controls*="category"], [class*="arrow"], [class*="swiper-button"], [class*="indicator__arrow"], [class*="carousel-arrow"], [class*="nav"], [class*="menu"], [class*="accordion"], [class*="header"]')) {
          return;
        }
        let isToggled = false;

        function applyMutations(muts) {
          if (!muts || !muts.length) return;
          muts.forEach(function(m) {
            const targets = queryElements(m.targetSelector);
            targets.forEach(function(target) {
              if (m.mutationType === 'childList') {
                // 1. NEVER append catalog cards or product items
                const isCatalog = (m.targetSelector && (m.targetSelector.includes('product-card') || m.targetSelector.includes('product-list') || m.targetSelector.includes('catalog') || m.targetSelector.includes('card-grid'))) ||
                  (m.className && (m.className.includes('product-card') || m.className.includes('card-item') || m.className.includes('product-item'))) ||
                  (m.html && (m.html.includes('product-card__item') || m.html.includes('js-pfv2-product-card') || m.html.includes('product-card')));
                if (isCatalog) return;

                if (m.action === 'added' && m.html) {
                  // 2. Scalar / text containers (counts, labels, color names): update text / replace child rather than duplicate
                  const isScalar = (m.targetSelector && (m.targetSelector.includes('result') || m.targetSelector.includes('count') || m.targetSelector.includes('color-name') || m.targetSelector.includes('label'))) ||
                    (target.matches && target.matches('[class*="result"], [class*="count"], [class*="total"], [class*="label"], [class*="color-name"]'));
                  if (isScalar) {
                    const temp = document.createElement('div');
                    temp.innerHTML = m.html;
                    const newEl = temp.firstElementChild;
                    if (newEl) {
                      const matchClass = (newEl.className || '').split(/\s+/).filter(Boolean)[0];
                      const matchInTarget = matchClass ? target.querySelector('.' + CSS.escape(matchClass)) : target.querySelector(newEl.tagName);
                      if (matchInTarget) {
                        matchInTarget.replaceWith(newEl);
                      } else {
                        target.textContent = newEl.textContent;
                      }
                    }
                    return;
                  }

                  // 3. SVG icon / swatch re-renders
                  if (m.tagName === 'svg' || m.html.trim().startsWith('<svg')) {
                    const temp = document.createElement('div');
                    temp.innerHTML = m.html;
                    const newEl = temp.firstElementChild;
                    if (newEl) {
                      const existingSvg = target.querySelector('svg');
                      if (existingSvg) {
                        existingSvg.replaceWith(newEl);
                      } else {
                        target.appendChild(newEl);
                      }
                    }
                    return;
                  }

                  // 4. Dynamic Multi-Item Containers (Chips, Tags, Overlays)
                  const existing = target.querySelector('[data-mutation-src="' + CSS.escape(interaction.triggerSelector) + '"]');
                  if (!existing) {
                    const temp = document.createElement('div');
                    temp.innerHTML = m.html;
                    const newEl = temp.firstElementChild;
                    if (newEl) {
                      newEl.setAttribute('data-mutation-src', interaction.triggerSelector);
                      const closeBtn = newEl.matches('button, a, [role="button"]') ? newEl : newEl.querySelector('button, a, [role="button"], [class*="close"], [class*="cancel"], [class*="remove"]');
                      if (closeBtn) {
                        closeBtn.addEventListener('click', function(e) {
                          e.preventDefault();
                          e.stopPropagation();
                          if (trigger.tagName === 'INPUT' && (trigger.type === 'checkbox' || trigger.type === 'radio')) {
                            trigger.checked = false;
                            trigger.dispatchEvent(new Event('change', { bubbles: true }));
                          } else {
                            handleToggleState(false);
                          }
                        });
                      }
                      const anchor = target.querySelector('[class*="view-more"], [class*="clear-wrap"], [class*="clear_wrap"]');
                      if (anchor) {
                        target.insertBefore(newEl, anchor);
                      } else {
                        target.appendChild(newEl);
                      }
                    }
                  }
                } else if (m.action === 'removed' && m.html) {
                  const temp = document.createElement('div');
                  temp.innerHTML = m.html;
                  const remEl = temp.firstElementChild;
                  if (remEl && remEl.id) {
                    const existingRem = target.querySelector('#' + CSS.escape(remEl.id));
                    if (existingRem) {
                      const wrapper = existingRem.closest('[role="listitem"], [class*="item-wrap"]') || existingRem;
                      wrapper.remove();
                    }
                  }
                }
                return;
              }
              if (m.attributeName === 'class') {
                if (m.addedClasses && m.addedClasses.length) {
                  target.classList.add(...m.addedClasses);
                }
                if (m.removedClasses && m.removedClasses.length) {
                  target.classList.remove(...m.removedClasses);
                }
                if (!m.addedClasses && !m.removedClasses && m.newValue) {
                  target.className = m.newValue;
                }
              } else if (m.attributeName === 'style') {
                if (m.newValue !== null) {
                  target.setAttribute('style', m.newValue);
                }
              } else if (m.attributeName) {
                if (m.newValue !== null && m.newValue !== undefined) {
                  target.setAttribute(m.attributeName, m.newValue);
                } else {
                  target.removeAttribute(m.attributeName);
                }
              }
            });
          });
        }

        function reverseMutations(muts, revMuts) {
          if (revMuts && revMuts.length) {
            applyMutations(revMuts);
            return;
          }
          if (!muts || !muts.length) return;
          muts.forEach(function(m) {
            const targets = queryElements(m.targetSelector);
            targets.forEach(function(target) {
              if (m.mutationType === 'childList') {
                if (m.action === 'added') {
                  const existing = target.querySelectorAll('[data-mutation-src="' + CSS.escape(interaction.triggerSelector) + '"]');
                  existing.forEach(function(el) { el.remove(); });
                }
                return;
              }
              if (m.attributeName === 'class') {
                if (m.addedClasses && m.addedClasses.length) {
                  target.classList.remove(...m.addedClasses);
                }
                if (m.removedClasses && m.removedClasses.length) {
                  target.classList.add(...m.removedClasses);
                }
                if (!m.addedClasses && !m.removedClasses && m.oldValue !== null) {
                  target.className = m.oldValue;
                }
              } else if (m.attributeName === 'style') {
                if (m.oldValue !== null) {
                  target.setAttribute('style', m.oldValue);
                } else {
                  target.removeAttribute('style');
                }
              } else if (m.attributeName) {
                if (m.oldValue !== null && m.oldValue !== undefined) {
                  target.setAttribute(m.attributeName, m.oldValue);
                } else {
                  target.removeAttribute(m.attributeName);
                }
              }
            });
          });
        }

        // Delegate dropdown/popover triggers to the universal dropdown controller
        if (trigger.matches && trigger.matches('button[aria-haspopup], [role="button"][aria-haspopup], button[aria-expanded], [role="button"][aria-expanded], [data-toggle="dropdown"], [data-bs-toggle="dropdown"]')) {
          return;
        }

        trigger.setAttribute('data-has-recorded-interaction', 'true');
        const isCheckboxOrRadio = trigger.tagName === 'INPUT' && (trigger.type === 'checkbox' || trigger.type === 'radio');

        function handleToggleState(shouldBeActive) {
          if (shouldBeActive) {
            applyMutations(interaction.mutations);
            isToggled = true;
          } else {
            reverseMutations(interaction.mutations, interaction.reverseMutations);
            isToggled = false;
          }
        }

        if (interaction.eventType === 'mouseenter') {
          trigger.addEventListener('mouseenter', function() {
            applyMutations(interaction.mutations);
          });
          trigger.addEventListener('mouseleave', function() {
            reverseMutations(interaction.mutations, interaction.reverseMutations);
          });
        } else {
          if (isCheckboxOrRadio) {
            trigger.addEventListener('change', function() {
              handleToggleState(trigger.checked);
            });
            const assocLabel = (trigger.id ? (root.querySelector('label[for="' + CSS.escape(trigger.id) + '"]') || document.querySelector('label[for="' + CSS.escape(trigger.id) + '"]')) : null) || trigger.closest('label');
            if (assocLabel) {
              assocLabel.addEventListener('click', function() {
                setTimeout(function() {
                  handleToggleState(trigger.checked);
                }, 10);
              });
            }
          }

          trigger.addEventListener(interaction.eventType || 'click', function(e) {
            if (e && e.target && e.target !== trigger && trigger.contains(e.target)) {
              const innerInteractive = e.target.closest('button, a, input, select, [role="button"], [role="tab"]');
              if (innerInteractive && innerInteractive !== trigger) {
                return;
              }
            }
            if (isCheckboxOrRadio) {
              handleToggleState(trigger.checked);
              return;
            }
            if (interaction.isToggle) {
              handleToggleState(!isToggled);
            } else {
              applyMutations(interaction.mutations);
            }
          });
        }
      });
    });

    // Universal Filter Clear All handler
    document.querySelectorAll('[class*="clear-all"], [class*="clear--pc"], [class*="clear--mo"], button[an-la*="clear"], [data-clear-all]').forEach(function(clearBtn) {
      clearBtn.addEventListener('click', function(e) {
        const container = clearBtn.closest('section, main, [class*="filter"]') || document;
        container.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(function(cb) {
          if (cb.checked) {
            cb.checked = false;
            cb.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
        container.querySelectorAll('[data-mutation-src]').forEach(function(chip) {
          chip.remove();
        });
      });
    });
  })();
      `.trim());
    }

    // 1. Navigation & Dropdown Mega-Menu Controller
    const rawLower = (ast.rawSectionHtml || '').toLowerCase();
    const isNavigationSection =
      ast.archetype === 'navbar' ||
      rawLower.includes('<nav') ||
      rawLower.includes('<header') ||
      rawLower.includes('mega-menu') ||
      rawLower.includes('site-header');

    if (isNavigationSection) {
      scripts.push(`
  // Navigation & Dropdown Mega-Menu Controller
  const navRoot = document.querySelector('#${ast.id}') || document.querySelector('header, nav, [role="navigation"], .site-header');
  const allMenuBtnCandidates = navRoot ? Array.from(navRoot.querySelectorAll(
    '.universal-nav-toggle, button[class*="menutrigger"], button[class*="hamburger"], [class*="hamburger"], [class*="burger"], button[class*="nav-toggle"], [class*="nav-toggle"] button, [class*="menu-toggle"] button, button[class*="menu-toggle"], [class*="mobile-menu-btn" i], button[class*="mobile-menu-btn" i], [class*="menutrigger"] button, button[aria-controls*="nav" i], button[aria-controls*="menu" i], button[aria-label*="menu" i], button[aria-label="Open Menu" i], button[aria-label="Toggle navigation" i], [data-action="toggle-nav"], div[class*="button"][tabindex], [role="button"][class*="menu"], [class*="icon-bar"], .hdrmobmenu, #nav-container .button, a[href*="popup"], a[href*="elementor-action"], [data-elementor-open-popup], .elementor-icon, [class*="menu-btn"], [class*="nav-btn"]'
  )).map(function(el) {
    return el.closest('button, [role="button"], a, div[tabindex]') || el;
  }) : [];

  // Also collect any triggers containing hamburger/bars icon inside navRoot
  if (navRoot) {
    Array.from(navRoot.querySelectorAll('button, a, [role="button"]')).forEach(function(el) {
      if (el.querySelector('.fa-bars, [class*="fa-bars"], [class*="fa-navicon"], [class*="burger"], [class*="menu-icon"], svg[class*="menu"], svg[class*="burger"]')) {
        allMenuBtnCandidates.push(el);
      }
      const href = el.getAttribute('href') || '';
      if (href.includes('elementor-action') || href.includes('popup') || el.hasAttribute('data-elementor-open-popup')) {
        allMenuBtnCandidates.push(el);
      }
    });
  }

  const filteredMenuBtnCandidates = allMenuBtnCandidates.filter(function(el) {
    const cls = (typeof el.className === 'string' ? el.className : (el.getAttribute && el.getAttribute('class')) || '').toLowerCase();
    const lbl = (el.getAttribute && el.getAttribute('aria-label') || '').toLowerCase();
    const parentCls = (el.parentElement ? (typeof el.parentElement.className === 'string' ? el.parentElement.className : (el.parentElement.getAttribute && el.parentElement.getAttribute('class')) || '') : '').toLowerCase();
    if (cls.includes('back') || cls.includes('submenu') || cls.includes('close') || cls.includes('search')) return false;
    if (parentCls.includes('submenu-trigger') || parentCls.includes('menuback')) return false;
    // Exclude top-level or sub-level navigation items
    if (cls.includes('l0-') || cls.includes('l1-') || cls.includes('l2-') || parentCls.includes('l0-') || parentCls.includes('l1-') || parentCls.includes('l2-')) return false;
    if (cls.includes('nav-link') || cls.includes('menu-link') || cls.includes('nav-item') || cls.includes('menu-item')) return false;
    if (el.closest('li, [role="listitem"]') && !cls.includes('hamburger') && !cls.includes('nav-toggle') && !cls.includes('menutrigger')) return false;
    return true;
  });
  const menuBtns = Array.from(new Set(filteredMenuBtnCandidates));
  const menuBtn = menuBtns[0] || null;

  // 1. Resolve drawer via Elementor action href, W3C aria-controls, data-target, or standard mobile drawer selectors
  let drawer = null;
  if (!drawer && menuBtn && (menuBtn.getAttribute('href') || '').includes('elementor-action')) {
    try {
      const decodedHref = decodeURIComponent(menuBtn.getAttribute('href') || '');
      const m = decodedHref.match(/settings=([A-Za-z0-9+/=]+)/);
      if (m && m[1]) {
        const s = JSON.parse(atob(m[1]));
        if (s && s.id) {
          drawer = document.querySelector('[data-elementor-id="' + s.id + '"], .elementor-' + s.id + ', [id="elementor-popup-modal-' + s.id + '"]');
        }
      }
    } catch (_) {}
  }
  if (!drawer && menuBtn && menuBtn.hasAttribute('data-elementor-open-popup')) {
    const popId = menuBtn.getAttribute('data-elementor-open-popup');
    drawer = document.querySelector('[data-elementor-id="' + popId + '"], .elementor-' + popId + ', [id="elementor-popup-modal-' + popId + '"]');
  }
  if (!drawer && menuBtn) {
    const ctrlId = menuBtn.getAttribute('aria-controls') || menuBtn.getAttribute('aria-owns');
    if (ctrlId && !ctrlId.includes('search') && !ctrlId.includes('video')) {
      drawer = document.getElementById(ctrlId) || document.querySelector('[id="' + ctrlId + '"]');
    }
  }
  if (!drawer && menuBtn) {
    const dt = menuBtn.getAttribute('data-target') || menuBtn.getAttribute('data-bs-target');
    if (dt && dt.startsWith('#')) {
      drawer = document.querySelector(dt);
    }
    const href = menuBtn.getAttribute('href');
    if (!drawer && href && href.startsWith('#') && href.length > 2 && !href.includes('elementor-action')) {
      drawer = document.querySelector(href);
    }
  }
  if (!drawer && navRoot) {
    drawer = navRoot.querySelector(
      '[class*="gnb"][class*="container"], #nav-content, [class*="header_sidebar_menu"], [class*="mobile-nav-drawer"], [class*="mobile-menu"], [class*="menu-drawer"], [class*="mobile-nav"], [class*="nav-drawer"], [class*="nav-sections"], [class*="navigation-menu__content"], [class*="navigation-menu-content"], [role="dialog"]:not([class*="search"]):not([class*="video"]), [role="navigation"]:not(header > nav)'
    );
  }
  if (!drawer) {
    const drawerSelectors = [
      '[data-elementor-type="popup"]',
      '[class*="location-popup"]',
      '[id*="elementor-popup"]',
      '[class*="mobile-nav-drawer"]',
      '[class*="mobile-menu"]',
      '[class*="menu-drawer"]',
      '[class*="mobile-nav"]',
      '[class*="nav-drawer"]',
      '[class*="header_sidebar_menu"]',
      '[class*="offcanvas"]',
      '[class*="off-canvas"]',
      '[class*="drawer"]:not([class*="cart"]):not([class*="product"])',
      '[class*="sidebar"]:not([class*="cart"]):not([class*="widget"]):not([class*="filter"])',
      '#nav-content',
      '[class*="navigation-menu__content"]',
      '[class*="navigation-menu-content"]',
      '[role="dialog"]:not([class*="search"]):not([class*="video"])'
    ];
    for (let i = 0; i < drawerSelectors.length; i++) {
      const match = (navRoot ? navRoot.querySelector(drawerSelectors[i]) : null) || document.querySelector(drawerSelectors[i]);
      if (match && match !== menuBtn && !match.contains(menuBtn)) {
        drawer = match;
        break;
      }
    }
  }
  const menuBackBtn = navRoot ? navRoot.querySelector('[class*="menuback"]') : null;

  function isElementVisible(el) {
    if (!el) return false;
    try {
      if (typeof el.checkVisibility === 'function') {
        return el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true });
      }
      const rect = el.getBoundingClientRect();
      return (rect.width > 0 && rect.height > 0) || (el.offsetWidth > 0 || el.offsetHeight > 0);
    } catch (_) {
      return false;
    }
  }

  // Universal Responsive Navigation Synchronization:
  // Dynamically synchronize drawer visibility with hamburger toggle state across viewports.
  function syncMobileNavState() {
    if (!drawer || !menuBtn) return;
    try {
      const isMobile = isElementVisible(menuBtn);
      if (isMobile) {
        const isOpen = menuBtn.getAttribute('aria-expanded') === 'true' || drawer.classList.contains('is-open');
        if (!isOpen) {
          drawer.style.visibility = 'hidden';
          drawer.style.opacity = '0';
          drawer.style.pointerEvents = 'none';
          drawer.setAttribute('aria-hidden', 'true');
        }
      } else {
        // Desktop viewport: restore author styles
        drawer.style.visibility = '';
        drawer.style.opacity = '';
        drawer.style.pointerEvents = '';
        drawer.setAttribute('aria-hidden', 'false');
        if (drawer.getAttribute('data-offscreen-offset')) {
          drawer.style.transform = '';
          drawer.removeAttribute('data-offscreen-offset');
        }
      }
    } catch (_) {}
  }
  if (drawer && menuBtn) {
    syncMobileNavState();
    window.addEventListener('resize', syncMobileNavState);
  }

  // Dropdown / Mega-Menu Flyout Finder
  function getDropdownFor(item) {
    if (!item || !item.querySelectorAll) return null;
    const ariaTriggers = Array.from(item.querySelectorAll('[aria-controls], [data-target], [data-bs-target], [data-accordion-target], [data-accordion-title]'));
    if (item.hasAttribute && (item.hasAttribute('aria-controls') || item.hasAttribute('data-target') || item.hasAttribute('data-bs-target') || item.hasAttribute('data-accordion-target') || item.hasAttribute('data-accordion-title'))) {
      ariaTriggers.push(item);
    }
    for (let i = 0; i < ariaTriggers.length; i++) {
      const trg = ariaTriggers[i];
      const ctrlId = trg.getAttribute('aria-controls') ||
                     (trg.getAttribute('data-target') || '').replace(/^#/, '') ||
                     (trg.getAttribute('data-bs-target') || '').replace(/^#/, '') ||
                     (trg.getAttribute('data-accordion-target') || '').replace(/^#/, '') ||
                     trg.getAttribute('data-accordion-title');
      if (ctrlId) {
        let controlled = document.getElementById(ctrlId) || (navRoot ? navRoot.querySelector('#' + CSS.escape(ctrlId)) : null);
        if (controlled && controlled.tagName === 'DT') {
          controlled = controlled.nextElementSibling || (controlled.parentElement ? controlled.parentElement.querySelector('dd, [class*="panel"]') : null) || controlled;
        }
        if (!controlled) {
          try {
            controlled = document.querySelector('[aria-labelledby="' + CSS.escape(ctrlId) + '"]');
          } catch (_) {}
        }
        if (controlled && controlled !== item) {
          if (controlled.tagName === 'UL' || controlled.tagName === 'OL') {
            const ctrlCls = (typeof controlled.className === 'string' ? controlled.className : '').toLowerCase();
            const isPrimaryList = ctrlCls.includes('nav-list') || ctrlCls.includes('navbar-nav') || ctrlCls.includes('main-menu') || (navRoot && controlled === navRoot.querySelector('ul, ol'));
            if (isPrimaryList) {
              continue;
            }
          }
          return controlled;
        }
      }
    }
    const candidates = Array.from(item.querySelectorAll(
      '.nav-dropdown-menu, [role="menu"], [data-baseweb="menu"], [data-baseweb="popover"], [class*="dropdown-menu"], [class*="submenu"], [class*="flyout"], [class*="dropdown"], [class*="megamenu"], [class*="l1-menu"], [class*="menu-container"], [class*="nav-tab__overlay"], [class*="menu__overlay"], [class*="overlay"], [class*="accordion__panel"]'
    ));
    let match = candidates.find(function(el) {
      if (el === item) return false;
      const cls = (el.getAttribute('class') || '').toLowerCase();
      // Exclude trigger buttons, links, icons, toggles, chevrons, and peer items
      if (cls.includes('trigger') || cls.includes('button') || cls.includes('btn') || cls.includes('link') || cls.includes('toggle') || cls.includes('icon') || cls.includes('chevron') || cls.includes('item') || el.tagName === 'LI') {
        return false;
      }
      // If class contains menu/dropdown/flyout/megamenu/l1/panel, it IS a valid dropdown/mega-menu panel
      const isMenuClass = cls.includes('menu') || cls.includes('dropdown') || cls.includes('flyout') || cls.includes('megamenu') || cls.includes('l1') || cls.includes('panel');
      if (!isMenuClass && (cls.includes('container') || cls.includes('wrapper'))) {
        return false;
      }
      return el.children.length > 0;
    });
    if (!match && item.nextElementSibling) {
      if (item.tagName !== 'LI' || item.nextElementSibling.tagName !== 'LI') {
        const nextEl = item.nextElementSibling;
        const nCls = (nextEl.getAttribute('class') || '').toLowerCase();
        const isPeerItem = nCls.includes('item') || nCls.includes('link') || nCls.includes('button') || nextEl.tagName === 'LI';
        if (!isPeerItem && (nCls.includes('dropdown-menu') || nCls.includes('flyout') || nCls.includes('megamenu') || nCls.includes('submenu') || nCls.includes('dropdown-panel'))) {
          match = nextEl;
        }
      }
    }
    // Semantic resolution for detached companion popups matching trigger archetype/keyword
    if (!match) {
      const trgEl = item.querySelector('button, a, span') || item;
      const itemTxt = (trgEl.textContent || '').trim().toLowerCase();
      if (itemTxt && itemTxt.length >= 3 && itemTxt.length <= 25) {
        const popupCandidates = Array.from(document.querySelectorAll('[class*="popup"], [class*="nav-panel"], [class*="megamenu"], [class*="flyout"], [role="menu"]'));
        for (let p = 0; p < popupCandidates.length; p++) {
          const pop = popupCandidates[p];
          if (pop === item || item.contains(pop)) continue;
          const popCls = (pop.className || '').toLowerCase();
          const popId = (pop.id || '').toLowerCase();
          if (popCls.includes(itemTxt + 'nav') || popCls.includes(itemTxt + '-nav') || popCls.includes(itemTxt + '_nav') ||
              popId.includes(itemTxt + 'nav') || popId.includes(itemTxt + '-nav') || popId.includes(itemTxt + '_nav') ||
              pop.querySelector('.' + CSS.escape(itemTxt) + 'Nav, [class*="' + itemTxt + 'nav" i], [class*="' + itemTxt + '_nav" i], [class*="' + itemTxt + '-nav" i]')) {
            match = pop;
            break;
          }
        }
      }
    }
    return match || null;
  }

  const rawNavCandidates = navRoot ? Array.from(navRoot.querySelectorAll(
    '.nav-item, [class*="nav-item"], li, [role="menuitem"], [class*="menu-item"], [class*="menu__item"], [class*="l0-menu"], [class*="l0_menu"], [class*="gnb-menu"], [class*="nav__menu"], [class*="nav-tab"], [class*="nav-link"], [class*="nav-button"], [data-radix-collection-item], [data-menu-item]'
  )) : [];

  const ariaCandidates = navRoot ? Array.from(navRoot.querySelectorAll('button[aria-controls], a[aria-controls], button[aria-haspopup], [role="button"][aria-controls]')).map(function(btn) {
    return btn.closest('li, [class*="menu"], [class*="item"], div') || btn;
  }) : [];

  const allNavCandidates = Array.from(new Set(rawNavCandidates.concat(ariaCandidates))).filter(function(el) {
    const cls = (el.getAttribute('class') || '').toLowerCase();
    const isItem = cls.includes('item') || cls.includes('menuitem') || el.tagName === 'LI';
    // Exclude dropdown/flyout panels themselves from being considered nav items
    if (!isItem && (cls.includes('dropdown') || cls.includes('overlay') || cls.includes('flyout') || cls.includes('submenu'))) {
      return false;
    }
    // Exclude container wrappers (e.g. rightSideWrapper, navWrapper, menu-wrapper)
    if (cls.includes('wrapper') || cls.includes('container') || cls.includes('inner')) {
      if (el.querySelectorAll('li, button, a').length > 1) return false;
    }
    // Exclude sub-element children (title, wrapper, content, scroll, inner, text)
    if (cls.includes('__title') || cls.includes('-title') || cls.includes('__wrapper') || cls.includes('-wrapper') || cls.includes('__content') || cls.includes('-content') || cls.includes('__scroll') || cls.includes('__inner') || cls.includes('-inner') || cls.includes('__text')) {
      return false;
    }
    return true;
  });

  const navDropdownItems = allNavCandidates.filter(function(item) {
    // 1. Exclude list containers, drawer containers, menu wrappers, and back buttons
    if (item.tagName === 'UL' || item.tagName === 'OL' || item.tagName === 'NAV' || item.tagName === 'HEADER') return false;
    if (drawer && (drawer === item || item.classList.contains('mobile-nav-drawer'))) return false;
    if (item.matches('[class*="drawer"], [class*="menu-container"], [class*="menuback"], [class*="menutrigger"], [class*="menu-trigger"], [class*="hamburger"], [id*="menutrigger"]')) return false;
    if (menuBtns && menuBtns.includes(item)) return false;

    // 2. Dropdown element must exist for this item
    const dd = getDropdownFor(item);
    if (!dd) return false;

    // Filter toolbars, faceted search, and filter dropdowns belong to the Universal Interactive Controls controller, NOT the site nav flyout controller
    if (item.closest('[class*="filter"], [class*="faceted"], [class*="toolbar"], [class*="sorting"], [class*="refine"]')) return false;

    // 3. Exclude elements that are inside another dropdown/flyout/menu panel
    const parentPanel = item.parentElement ? item.parentElement.closest('.nav-dropdown-menu, [class*="l1-menu"], [class*="l2-menu"], [class*="dropdown-menu"], [class*="flyout"]:not([class*="item"]):not([class*="menu-list"]), [class*="megamenu"], [class*="overlay"]') : null;
    if (parentPanel && parentPanel.querySelectorAll('[aria-controls]').length <= 1) {
      return false;
    }

    return true;
  }).filter(function(item, idx, arr) {
    // Deduplicate: If item contains any other candidate in arr, item is an enclosing container, NOT the specific leaf item!
    // Keep the more specific child item and drop the container!
    return !arr.some(function(other) {
      return other !== item && item.contains(other);
    });
  });

  let activeFlyoutItem = null;
  let flyoutLeaveTimer = null;

  // Universal Framework State Reflection:
  // Scans stylesheets for dynamic active/open state classes authored by modern CSS frameworks
  // (CSS Modules, BEM, Scoped CSS) matching standard UI state tokens (open, active, expanded, visible, show, toggled).
  // Matches them against base component prefixes of the target element.
  function applyFrameworkStateClasses(element, isOpening) {
    if (!element || !element.classList) return;
    const STATE_REGEX = /(?:is[-_]?open|open(?:ed)?|is[-_]?active|active|expanded|visible|show(?:ing)?|toggled)/i;
    if (isOpening) {
      try {
        const elClasses = Array.from(element.classList);
        const prefixes = elClasses
          .filter(function(c) {
            return !/^(?:is[-_]?open|open|active|is[-_]?active|show|visible|expanded)$/i.test(c);
          })
          .map(function(c) {
            const m = c.match(/^([a-zA-Z0-9_-]+?)(?:_{1,2}|-{1,2})/);
            return m ? m[1].toLowerCase() : c.toLowerCase();
          })
          .filter(function(p) { return p.length > 3; });

        if (prefixes.length > 0) {
          Array.from(document.styleSheets).forEach(function(sh) {
            try {
              Array.from(sh.cssRules || []).forEach(function(r) {
                const sel = r.selectorText;
                if (sel && STATE_REGEX.test(sel)) {
                  const tokens = sel.match(/\.([a-zA-Z0-9_-]+)/g);
                  if (tokens) {
                    tokens.forEach(function(tok) {
                      const cls = tok.replace(/^\./, '');
                      if (STATE_REGEX.test(cls)) {
                        const baseMatch = cls.match(/^([a-zA-Z0-9_-]+?)(?:--|-[a-zA-Z]+$)/);
                        const baseName = baseMatch ? baseMatch[1] : cls;
                        const isExactElementMatch = element.classList.contains(baseName);
                        const isBlockLevelModifier = (prefixes.includes(baseName.toLowerCase()) || prefixes.some(function(p) { return cls.toLowerCase().startsWith(p + '-') || cls.toLowerCase().startsWith(p + '_'); })) && !cls.includes('__');
                        if (isExactElementMatch || isBlockLevelModifier) {
                          const isContainer = element.tagName === 'NAV' || element.tagName === 'HEADER' || (element.getAttribute('class') || '').includes('globalnav');
                          if (isContainer && (cls.includes('submenu') || cls.includes('item-') || cls.includes('flyout-open'))) {
                            return;
                          }
                          element.classList.add(cls);
                        }
                      }
                    });
                  }
                }
              });
            } catch (_) {}
          });
        }
      } catch (_) {}
    } else {
      Array.from(element.classList).forEach(function(c) {
        if (STATE_REGEX.test(c)) {
          element.classList.remove(c);
        }
      });
    }
  }

  function closeFlyoutItem(it) {
    if (!it) return;
    it.classList.remove('is-open', 'open', 'active');
    Array.from(it.classList).forEach(function(cls) {
      if (cls.includes('flyout-open') || cls.endsWith('-open')) {
        it.classList.remove(cls);
      }
      if (cls.endsWith('--show') || cls.endsWith('--active') || cls.endsWith('--open')) {
        it.classList.remove(cls);
      }
    });
    if (it.parentElement) {
      Array.from(it.parentElement.classList).forEach(function(cls) {
        if (cls.endsWith('--show') || cls.endsWith('--active')) {
          it.parentElement.classList.remove(cls);
        }
      });
    }
    applyFrameworkStateClasses(it, false);
    const itDropdown = getDropdownFor(it);
    if (itDropdown) {
      itDropdown.classList.remove('is-open', 'open', 'show', 'active');
      applyFrameworkStateClasses(itDropdown, false);
      itDropdown.style.visibility = '';
      itDropdown.style.opacity = '';
      itDropdown.style.height = '';
      itDropdown.style.minHeight = '';
      itDropdown.style.removeProperty('max-height');
      itDropdown.style.display = 'none';
      itDropdown.style.pointerEvents = '';
      itDropdown.removeAttribute('data-open');
      itDropdown.setAttribute('data-state', 'closed');
      itDropdown.setAttribute('aria-hidden', 'true');
      itDropdown.style.removeProperty('--flyout-height');
      itDropdown.style.removeProperty('--l1-container-current-height');
      if (it.classList.contains('w-dropdown') || it.querySelector('.w-dropdown')) {
        const wDd = it.classList.contains('w-dropdown') ? it : it.querySelector('.w-dropdown');
        wDd.classList.remove('w--open');
        const t = wDd.querySelector('.w-dropdown-toggle');
        if (t) { t.classList.remove('w--open'); t.setAttribute('aria-expanded', 'false'); }
        const l = wDd.querySelector('.w-dropdown-list');
        if (l) {
          l.classList.remove('w--open');
          l.style.removeProperty('display');
          l.style.removeProperty('visibility');
          l.style.removeProperty('opacity');
        }
      }
      itDropdown.querySelectorAll('[class*="submenu-list-item"], [class*="list-item"], a, [class*="content"], [class*="group"], [class*="header"], [class*="menu-inner"], [class*="submenu-inner"]').forEach(function(el) {
        el.style.opacity = '';
        el.style.visibility = '';
        el.style.pointerEvents = '';
        el.style.transform = '';
      });
      let anc = itDropdown.parentElement;
      while (anc && anc !== it && anc !== document.body) {
        anc.classList.remove('is-open', 'open', 'show', 'active');
        Array.from(anc.classList).forEach(function(c) {
          if (/--(?:show|open|active)$/i.test(c)) anc.classList.remove(c);
        });
        anc = anc.parentElement;
      }
    }
    // Clean up aria-expanded, active, and trigger open states
    it.removeAttribute('data-opened-by-click');
    if (it.getAttribute('aria-expanded')) it.setAttribute('aria-expanded', 'false');
    it.removeAttribute('data-popup-open');
    it.removeAttribute('data-pressed');
    it.querySelectorAll('[aria-expanded]').forEach(function(el) {
      if (!itDropdown || !itDropdown.contains(el)) el.setAttribute('aria-expanded', 'false');
    });
    it.querySelectorAll('[data-popup-open], [data-pressed]').forEach(function(el) {
      if (!itDropdown || !itDropdown.contains(el)) {
        el.removeAttribute('data-popup-open');
        el.removeAttribute('data-pressed');
      }
    });
    it.querySelectorAll('.active, .is-active, .is-open, .open').forEach(function(ch) {
      if (!itDropdown || !itDropdown.contains(ch)) {
        ch.classList.remove('active', 'is-active', 'is-open', 'open');
        applyFrameworkStateClasses(ch, false);
      }
    });

    // Restore clipping ancestors
    let clipAnc = it.parentElement;
    while (clipAnc && clipAnc !== document.body && clipAnc !== document.documentElement) {
      const hasOtherOpen = clipAnc.querySelector('.is-open, [aria-expanded="true"]');
      if (!hasOtherOpen && clipAnc.hasAttribute('data-orig-overflow')) {
        const orig = clipAnc.getAttribute('data-orig-overflow');
        if (orig) {
          clipAnc.style.setProperty('overflow', orig);
        } else {
          clipAnc.style.removeProperty('overflow');
        }
        clipAnc.removeAttribute('data-orig-overflow');
      }
      if (!hasOtherOpen) {
        clipAnc.classList.remove('has-open-dropdown');
      }
      clipAnc = clipAnc.parentElement;
    }
    const icon = it.querySelector('[class*="chevron" i], [class*="caret" i], [class*="arrow" i]');
    if (icon) icon.style.transform = 'rotate(0deg)';

    const curtains = Array.from(document.querySelectorAll('[class*="curtain"], [class*="backdrop"], [class*="scrim"], [class*="overlay-cover"]'))
      .filter(function(c) { return c && c.tagName !== 'BODY' && c.tagName !== 'HTML' && c.tagName !== 'NAV' && c.tagName !== 'HEADER'; });
    curtains.forEach(function(curtain) {
      curtain.style.opacity = '0';
      curtain.style.visibility = 'hidden';
      curtain.style.pointerEvents = 'none';
      curtain.classList.remove('is-active', 'is-open', 'show');
      Array.from(curtain.classList).forEach(function(cls) {
        if (cls.endsWith('--show')) {
          curtain.classList.remove(cls);
        }
      });
    });
  }

  function closeAllNav() {
    const allNavRoots = [navRoot];
    const ih = navRoot ? navRoot.querySelector('header, nav, [role="navigation"]') : null;
    if (ih) allNavRoots.push(ih);
    const ph = navRoot ? navRoot.closest('header, nav, [role="navigation"]') : null;
    if (ph) allNavRoots.push(ph);

    allNavRoots.forEach(function(nr) {
      nr.classList.remove(
        'menu-open', 'is-open', 'nav-open', 'open',
        'has-flyout-open', 'with-submenu-open'
      );
      Array.from(nr.classList).forEach(function(cls) {
        if (cls.includes('menu-open') || cls.includes('flyout-open') || cls.includes('submenu-open') || cls.endsWith('-open')) {
          nr.classList.remove(cls);
        }
      });
      applyFrameworkStateClasses(nr, false);
      nr.style.removeProperty('--flyout-height');
      nr.style.removeProperty('z-index');
    });
    if (drawer) {
      drawer.classList.remove('is-open', 'open', 'active');
      drawer.setAttribute('aria-hidden', 'true');
      drawer.setAttribute('data-state', 'closed');
      drawer.setAttribute('data-status', 'close');
      const isMobile = menuBtn && isElementVisible(menuBtn);
      if (isMobile) {
        drawer.style.visibility = 'hidden';
        drawer.style.opacity = '0';
        drawer.style.pointerEvents = 'none';
      } else {
        drawer.style.visibility = '';
        drawer.style.opacity = '';
        drawer.style.pointerEvents = '';
      }
      drawer.style.display = '';
      if (drawer.getAttribute('data-mobile-fixed') === 'true') {
        drawer.style.removeProperty('position');
        drawer.style.removeProperty('top');
        drawer.style.removeProperty('left');
        drawer.style.removeProperty('right');
        drawer.style.removeProperty('width');
        drawer.style.removeProperty('background-color');
        drawer.style.removeProperty('box-shadow');
        drawer.style.removeProperty('padding');
        drawer.style.removeProperty('max-height');
        drawer.style.removeProperty('overflow-y');
        drawer.removeAttribute('data-mobile-fixed');
      }
      const drawerCls = (typeof drawer.className === 'string' ? drawer.className : (drawer.getAttribute && drawer.getAttribute('class')) || '').toLowerCase();
      if (drawer.hasAttribute('data-elementor-type') || drawerCls.includes('location-popup') || drawerCls.includes('popup')) {
        drawer.style.setProperty('display', 'none', 'important');
        drawer.style.setProperty('visibility', 'hidden', 'important');
        drawer.style.setProperty('opacity', '0', 'important');
        drawer.style.setProperty('pointer-events', 'none', 'important');
      }
      if (drawer.id === 'nav-content' || drawerCls.includes('header_sidebar_menu')) {
        drawer.style.setProperty('transform', 'translateX(100%)', 'important');
      } else if (drawer.getAttribute('data-offscreen-offset')) {
        drawer.style.removeProperty('transform');
        drawer.style.removeProperty('left');
        drawer.removeAttribute('data-offscreen-offset');
      }
      if (drawer.classList.contains('w-nav-overlay') || drawerCls.includes('nav-overlay') || drawer.hasAttribute('data-wf-ignore')) {
        drawer.classList.remove('w--open');
        drawer.style.setProperty('display', 'none', 'important');
      }
      const navMenu = navRoot ? navRoot.querySelector('.w-nav-menu, [class*="nav-menu"]') : null;
      if (navMenu) {
        navMenu.classList.remove('w--nav-menu-open');
        navMenu.style.setProperty('display', 'none', 'important');
      }
      applyFrameworkStateClasses(drawer, false);
    }
    document.body.classList.remove('menu-open', 'nav-open', 'sidebar-open');
    document.documentElement.classList.remove('menu-open');
    menuBtns.forEach(function(btn) {
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('data-state', 'closed');
      btn.classList.remove('is-active', 'is-open', 'active', 'w--open');
      btn.style.removeProperty('z-index');
      if (btn.parentElement) btn.parentElement.style.removeProperty('z-index');
      applyFrameworkStateClasses(btn, false);
      btn.querySelectorAll('animate[id*="close"]').forEach(function(anim) {
        if (typeof anim.beginElement === 'function') {
          try { anim.beginElement(); } catch (_) {}
        }
      });
    });
    const navContainer = document.getElementById('nav-container');
    if (navContainer) {
      navContainer.classList.remove('active', 'open');
      const bg = navContainer.querySelector('.bg');
      if (bg) {
        bg.style.setProperty('visibility', 'hidden', 'important');
        bg.style.setProperty('opacity', '0', 'important');
        bg.style.setProperty('pointer-events', 'none', 'important');
      }
    }
    navDropdownItems.forEach(function(it) {
      closeFlyoutItem(it);
    });
    activeFlyoutItem = null;
    const curtain = Array.from(document.querySelectorAll('[class*="curtain"], [class*="backdrop"], [class*="scrim"]'))
      .find(function(c) { return c && c.tagName !== 'BODY' && c.tagName !== 'HTML' && c.tagName !== 'NAV' && c.tagName !== 'HEADER'; });
    if (curtain) {
      curtain.style.opacity = '';
      curtain.style.visibility = '';
      curtain.classList.remove('is-active', 'is-open');
    }
  }

  function scheduleFlyoutClose() {
    clearTimeout(flyoutLeaveTimer);
    flyoutLeaveTimer = setTimeout(function() {
      if (activeFlyoutItem) {
        closeFlyoutItem(activeFlyoutItem);
        activeFlyoutItem = null;
      }
      navDropdownItems.forEach(function(it) {
        closeFlyoutItem(it);
      });
      if (navRoot) {
        navRoot.classList.remove('is-open', 'has-flyout-open', 'with-submenu-open', 'globalnav-with-submenu-open');
        Array.from(navRoot.classList).forEach(function(cls) {
          if (cls.includes('with-flyout-open') || cls.includes('with-submenu-open') || cls.includes('submenu-open')) navRoot.classList.remove(cls);
        });
      }
      const curtain = Array.from(document.querySelectorAll('[class*="curtain"], [class*="backdrop"], [class*="scrim"]'))
        .find(function(c) { return c && c.tagName !== 'BODY' && c.tagName !== 'HTML' && c.tagName !== 'NAV' && c.tagName !== 'HEADER'; });
      if (curtain) {
        curtain.style.opacity = '';
        curtain.style.visibility = '';
        curtain.classList.remove('is-active', 'is-open');
      }
    }, 250);
  }

  menuBtns.forEach(function(btn) {
    if (btn.hasAttribute('data-menu-bound')) return;
    btn.setAttribute('data-menu-bound', 'true');
    btn.addEventListener('click', function(e) {
      if (btn.tagName === 'A' || btn.getAttribute('href')) {
        e.preventDefault();
      }
      e.stopPropagation();
      const allNavRoots = [navRoot];
      const ih = navRoot ? navRoot.querySelector('header, nav, [role="navigation"]') : null;
      if (ih) allNavRoots.push(ih);
      const ph = navRoot ? navRoot.closest('header, nav, [role="navigation"]') : null;
      if (ph) allNavRoots.push(ph);

      const isCurrentlyOpen = (btn && (btn.classList.contains('is-active') || btn.classList.contains('active') || btn.classList.contains('w--open'))) ||
        (drawer && (drawer.classList.contains('is-open') || drawer.classList.contains('active') || drawer.classList.contains('show') || drawer.classList.contains('w--open'))) ||
        allNavRoots.some(function(nr) {
          return nr.classList.contains('menu-open') ||
            nr.classList.contains('is-open') ||
            nr.classList.contains('globalnav-with-menu-open');
        });

      if (isCurrentlyOpen) {
        closeAllNav();
      } else {
        allNavRoots.forEach(function(nr) {
          nr.classList.add('menu-open', 'is-open', 'nav-open');
          Array.from(nr.classList).forEach(function(cls) {
            if (cls.includes('nav') || cls.includes('header')) {
              nr.classList.add(cls + '-with-menu-open', cls + '-with-flyout-open');
            }
          });
          nr.classList.remove('with-submenu-open', 'globalnav-with-submenu-open');
          nr.style.setProperty('z-index', '1000000', 'important');
          applyFrameworkStateClasses(nr, true);
        });
        if (btn) {
          btn.classList.add('w--open');
          btn.style.setProperty('z-index', '1000001', 'important');
          if (btn.parentElement) btn.parentElement.style.setProperty('z-index', '1000001', 'important');
        }
        navDropdownItems.forEach(function(it) {
          closeFlyoutItem(it);
        });
        document.body.classList.add('menu-open', 'nav-open', 'sidebar-open');
        document.documentElement.classList.add('menu-open');

        if (drawer) {
          drawer.classList.add('is-open', 'open', 'active', 'show', 'w--open');
          drawer.setAttribute('aria-hidden', 'false');
          drawer.setAttribute('data-state', 'open');
          drawer.setAttribute('data-status', 'open');
          drawer.style.setProperty('visibility', 'visible', 'important');
          drawer.style.setProperty('opacity', '1', 'important');
          drawer.style.setProperty('pointer-events', 'auto', 'important');
          drawer.style.setProperty('display', 'block', 'important');
          drawer.style.setProperty('transform', 'none', 'important');
          drawer.style.setProperty('z-index', '999990', 'important');

          const drawerCls = (typeof drawer.className === 'string' ? drawer.className : (drawer.getAttribute && drawer.getAttribute('class')) || '').toLowerCase();
          if (drawer.classList.contains('w-nav-overlay') || drawerCls.includes('nav-overlay') || drawer.hasAttribute('data-wf-ignore')) {
            drawer.style.setProperty('width', '100%', 'important');
            drawer.style.setProperty('min-height', '100vh', 'important');
            drawer.style.setProperty('background-color', 'var(--_color-theme---background, #faf9f5)', 'important');
            const navMenu = navRoot ? navRoot.querySelector('.w-nav-menu, [class*="nav-menu"]') : null;
            if (navMenu) {
              if (navMenu.parentElement !== drawer) drawer.appendChild(navMenu);
              navMenu.classList.add('w--nav-menu-open');
              navMenu.style.setProperty('display', 'block', 'important');
              navMenu.style.setProperty('width', '100%', 'important');
              navMenu.style.setProperty('min-height', '100vh', 'important');
              navMenu.style.setProperty('background-color', 'var(--_color-theme---background, #faf9f5)', 'important');
            }
          }
          const isOffCanvas = drawer.hasAttribute('data-elementor-type') ||
            drawerCls.includes('popup') || drawerCls.includes('offcanvas') || drawerCls.includes('location-popup') || drawerCls.includes('drawer') || drawerCls.includes('sidebar');

          if (isOffCanvas) {
            drawer.style.setProperty('position', 'fixed', 'important');
            drawer.style.setProperty('top', '0px', 'important');
            drawer.style.setProperty('right', '0px', 'important');
            drawer.style.setProperty('bottom', '0px', 'important');
            drawer.style.setProperty('width', 'min(500px, 100vw)', 'important');
            drawer.style.setProperty('max-width', '100vw', 'important');
            drawer.style.setProperty('height', '100vh', 'important');
            drawer.style.setProperty('background-color', '#ffffff', 'important');
            drawer.style.setProperty('box-shadow', '-5px 0 30px rgba(0,0,0,0.2)', 'important');
            drawer.style.setProperty('overflow-y', 'auto', 'important');
            drawer.style.setProperty('z-index', '999999', 'important');

            if (!drawer.querySelector('.universal-drawer-close, .dialog-close-button, [data-action="close"]')) {
              const closeBtn = document.createElement('button');
              closeBtn.className = 'universal-drawer-close';
              closeBtn.innerHTML = '✕';
              closeBtn.setAttribute('aria-label', 'Close menu');
              Object.assign(closeBtn.style, {
                position: 'absolute',
                top: '20px',
                right: '24px',
                background: 'rgba(0,0,0,0.06)',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                fontSize: '18px',
                lineHeight: '36px',
                textAlign: 'center',
                cursor: 'pointer',
                color: '#111827',
                zIndex: '1000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0'
              });
              closeBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                closeAllNav();
              });
              drawer.prepend(closeBtn);
            }
          } else {
            const cs = window.getComputedStyle(drawer);
            const isContained = (!drawer.style.position && (cs.position === 'static' || cs.position === 'relative')) || cs.position === 'static';
            const isMobileViewport = window.innerWidth <= 900 || (menuBtn && isElementVisible(menuBtn));
            if (isContained && isMobileViewport) {
              drawer.setAttribute('data-mobile-fixed', 'true');
              const navRect = (navRoot || drawer.parentElement).getBoundingClientRect();
              const btnRect = menuBtn ? menuBtn.getBoundingClientRect() : null;
              const topOffset = btnRect && btnRect.bottom > 0 && btnRect.bottom < 120
                ? Math.min(Math.max(48, Math.round(btnRect.bottom + 8)), 72)
                : Math.min(Math.max(48, Math.round(navRect.bottom || 56)), 72);
              drawer.style.setProperty('position', 'fixed', 'important');
              drawer.style.setProperty('top', topOffset + 'px', 'important');
              drawer.style.setProperty('left', '0px', 'important');
              drawer.style.setProperty('right', '0px', 'important');
              drawer.style.setProperty('width', '100vw', 'important');
              drawer.style.setProperty('background-color', '#ffffff', 'important');
              drawer.style.setProperty('box-shadow', '0 10px 30px rgba(0,0,0,0.15)', 'important');
              drawer.style.setProperty('padding', '24px', 'important');
              drawer.style.setProperty('max-height', 'calc(100vh - ' + topOffset + 'px)', 'important');
              drawer.style.setProperty('overflow-y', 'auto', 'important');
              const innerList = drawer.querySelector('ul, [role="list"], [role="menu"]');
              if (innerList && !innerList.matches('[class*="trigger-group"], [class*="submenu"]')) {
                innerList.style.setProperty('display', 'flex', 'important');
                innerList.style.setProperty('flex-direction', 'column', 'important');
                innerList.style.setProperty('align-items', 'flex-start', 'important');
                innerList.style.setProperty('gap', '16px', 'important');
              }
            }
          }

          // Apply framework active/open state classes dynamically
          applyFrameworkStateClasses(drawer, true);
        }
        menuBtns.forEach(function(b) {
          b.setAttribute('aria-expanded', 'true');
          b.setAttribute('data-state', 'open');
          b.classList.add('is-active', 'is-open', 'active');
          applyFrameworkStateClasses(b, true);
          b.querySelectorAll('animate[id*="open"]').forEach(function(anim) {
            if (typeof anim.beginElement === 'function') {
              try { anim.beginElement(); } catch (_) {}
            }
          });
        });
        const navContainer = document.getElementById('nav-container');
        if (navContainer) {
          navContainer.classList.add('active', 'open');
          const bg = navContainer.querySelector('.bg');
          if (bg) {
            bg.style.setProperty('visibility', 'visible', 'important');
            bg.style.setProperty('opacity', '0.7', 'important');
            bg.style.setProperty('pointer-events', 'auto', 'important');
            bg.style.setProperty('z-index', '999', 'important');
          }
        }
      }
    });
  });

  const navContainerBg = document.querySelector('#nav-container .bg');
  if (navContainerBg && !navContainerBg.hasAttribute('data-bg-bound')) {
    navContainerBg.setAttribute('data-bg-bound', 'true');
    navContainerBg.addEventListener('click', function(e) {
      e.stopPropagation();
      closeAllNav();
    });
  }

  // Bind close buttons inside drawer
  const drawerCloseBtns = drawer ? Array.from(drawer.querySelectorAll(
    'button[class*="close" i], button[aria-label*="close" i], [class*="closeButton" i], [class*="close-button" i], .close-btn, [id*="close" i], [class*="menu_close"], [class*="menu-close"], [class*="nav-close"], a[class*="close" i]'
  )) : [];
  drawerCloseBtns.forEach(function(cb) {
    if (cb.hasAttribute('data-close-bound')) return;
    cb.setAttribute('data-close-bound', 'true');
    cb.addEventListener('click', function(e) {
      e.stopPropagation();
      closeAllNav();
    });
  });

  // Delegated close listener for clicks on close triggers, backdrop, or outside open drawer
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeAllNav();
  });
  document.addEventListener('click', function(e) {
    if (e.target && (e.target.matches('.universal-drawer-close, .dialog-close-button, [data-action="close"], .fa-times, .fa-xmark') || e.target.closest('.universal-drawer-close, .dialog-close-button, [data-action="close"]'))) {
      closeAllNav();
      return;
    }
    if (drawer && (drawer.classList.contains('is-open') || drawer.classList.contains('active') || drawer.classList.contains('show'))) {
      const isClickInsideDrawer = drawer.contains(e.target);
      const isClickOnToggle = menuBtns.some(function(b) { return b.contains(e.target); });
      if (!isClickInsideDrawer && !isClickOnToggle) {
        closeAllNav();
      }
    }
  });

  const allBackBtns = document.querySelectorAll('[class*="backward-btn"], [class*="back-btn"], [class*="menuback"], [aria-label*="back" i], [aria-label="Main menu" i]');
  allBackBtns.forEach(function(btn) {
    if (btn.hasAttribute('data-back-bound')) return;
    btn.setAttribute('data-back-bound', 'true');
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      const allNavContainers = [navRoot];
      if (navRoot) {
        const innerNav = navRoot.querySelector('nav, [class*="gnb"], [role="navigation"]');
        if (innerNav && !allNavContainers.includes(innerNav)) allNavContainers.push(innerNav);
        const outerNav = navRoot.closest('header, nav, [class*="gnb"], [role="navigation"]');
        if (outerNav && !allNavContainers.includes(outerNav)) allNavContainers.push(outerNav);
      }
      allNavContainers.forEach(function(nr) {
        if (!nr) return;
        nr.classList.remove('with-submenu-open', 'globalnav-with-submenu-open');
        Array.from(nr.classList).forEach(function(cls) {
          if (cls.includes('submenu-open') || cls.includes('--l1-show')) nr.classList.remove(cls);
        });
      });
      navDropdownItems.forEach(function(it) {
        closeFlyoutItem(it);
      });
      activeFlyoutItem = null;
    });
  });

  // Universal mobile & desktop accordion toggle for submenus, categories, and drawer items
  const accordionButtons = Array.from(document.querySelectorAll(
    '.mobile-nav-accordion-btn, .toggle-button, [class*="accordion-trigger"], [class*="accordion-button"], [class*="accordion-toggle"], [class*="toggle-btn"], button[aria-controls*="toggle" i], button[aria-controls*="content" i], button[aria-controls*="collapse" i], [data-accordion-title], [data-cmp-hook-accordion="button"], [class*="cmp-accordion__title"] a, [class*="cmp-header-navigation__item"] a[aria-haspopup]'
  ));
  accordionButtons.forEach(function(btn) {
    if (btn.hasAttribute('data-accordion-bound')) return;
    btn.setAttribute('data-accordion-bound', 'true');
    btn.addEventListener('click', function(e) {
      if (btn.getAttribute('href') === 'javascript:void(0)' || btn.getAttribute('href') === '#') {
        e.preventDefault();
      }
      e.stopPropagation();
      let target = null;
      let dtElement = null;
      const targetId = btn.getAttribute('aria-controls') ||
                       btn.getAttribute('data-accordion-title') ||
                       (btn.getAttribute('data-target') || '').replace(/^#/, '') ||
                       (btn.getAttribute('data-bs-target') || '').replace(/^#/, '');
      if (targetId) {
        const container = btn.closest('[role="dialog"], header, nav, section, [class*="accordion"], .mobile-nav-item, li');
        dtElement = (container ? container.querySelector('#' + CSS.escape(targetId)) : null) || document.getElementById(targetId);
        target = dtElement;
        if (target && target.tagName === 'DT') {
          target = target.nextElementSibling || (target.parentElement ? target.parentElement.querySelector('dd, [class*="panel"]') : null) || target;
        }
        if (!target) {
          try {
            target = document.querySelector('[aria-labelledby="' + CSS.escape(targetId) + '"]');
          } catch (_) {}
        }
      }
      if (!target) {
        target = btn.nextElementSibling || (btn.parentElement ? btn.parentElement.querySelector('.toggle-content, [class*="accordion-content"], [class*="accordion__panel"], [class*="content"]') : null);
      }
      const parentContainer = btn.closest('[class*="accordion" i], [class*="toggle" i], [class*="collapse" i], .mobile-nav-item, [class*="navigation__item"], li');
      const isCurrentlyOpen = btn.getAttribute('aria-expanded') === 'true' ||
        (parentContainer && (parentContainer.classList.contains('is-open') || parentContainer.classList.contains('is-current'))) ||
        (target && (target.classList.contains('is-open') || target.classList.contains('cmp-accordion__panel--expanded') || target.style.display === 'block'));

      const willOpen = !isCurrentlyOpen;
      btn.setAttribute('aria-expanded', String(willOpen));

      // Coordinate nav item active state
      const navItem = btn.closest('[class*="navigation__item"], .cmp-header-navigation__item, li');
      if (navItem && navItem.parentElement) {
        Array.from(navItem.parentElement.children).forEach(function(sib) {
          if (sib !== navItem) sib.classList.remove('is-current', 'is-open', 'open', 'active');
        });
        if (willOpen) navItem.classList.add('is-current');
      }

      // If opening in an accordion group, close sibling panels
      if (willOpen && parentContainer && parentContainer.parentElement) {
        const siblings = Array.from(parentContainer.parentElement.children);
        siblings.forEach(function(sib) {
          if (sib !== parentContainer) {
            sib.classList.remove('is-open', 'open', 'is-current', 'active');
            sib.querySelectorAll('[aria-expanded="true"]').forEach(function(sBtn) { sBtn.setAttribute('aria-expanded', 'false'); });
            sib.querySelectorAll('.cmp-accordion__panel--expanded, [class*="accordion__panel"], [class*="toggle-content"]').forEach(function(sPan) {
              sPan.classList.remove('cmp-accordion__panel--expanded', 'is-open', 'open');
              sPan.style.display = 'none';
            });
          }
        });
      }

      if (dtElement && dtElement.tagName === 'DT') {
        dtElement.classList.toggle('open', willOpen);
        dtElement.setAttribute('data-is-open-accordion', String(willOpen));
        if (willOpen) {
          dtElement.setAttribute('data-cmp-expanded', '');
        } else {
          dtElement.removeAttribute('data-cmp-expanded');
        }
        const dl = dtElement.closest('dl, [class*="accordion"]');
        if (dl && willOpen) {
          dl.querySelectorAll('dt, [class*="accordion__title"]').forEach(function(dt) {
            if (dt !== dtElement) {
              dt.classList.remove('open', 'is-open');
              dt.setAttribute('data-is-open-accordion', 'false');
              dt.removeAttribute('data-cmp-expanded');
            }
          });
          dl.querySelectorAll('dd, [class*="accordion__panel"]').forEach(function(dd) {
            if (dd !== target) {
              dd.classList.remove('open', 'is-open', 'cmp-accordion__panel--expanded');
              dd.style.display = 'none';
            }
          });
        }
      }

      if (parentContainer) {
        parentContainer.classList.toggle('is-open', willOpen);
        parentContainer.classList.toggle('open', willOpen);
        parentContainer.classList.toggle('is-current', willOpen);
        applyFrameworkStateClasses(parentContainer, willOpen);
      }
      if (target) {
        target.classList.toggle('is-open', willOpen);
        target.classList.toggle('open', willOpen);
        target.classList.toggle('cmp-accordion__panel--expanded', willOpen);
        target.style.display = willOpen ? 'block' : 'none';
        applyFrameworkStateClasses(target, willOpen);

        if (willOpen) {
          let parentMenu = target.closest('[class*="vertical-menu"], [class*="menu-container"], [class*="drawer"]');
          while (parentMenu && parentMenu !== document.body) {
            parentMenu.classList.add('is-open', 'open');
            parentMenu.style.setProperty('display', 'block', 'important');
            parentMenu.style.setProperty('visibility', 'visible', 'important');
            parentMenu.style.setProperty('opacity', '1', 'important');
            if (parentMenu.classList.contains('cmp-header-vertical-menu__container') || (parentMenu.getAttribute('class') || '').includes('vertical-menu__container')) {
              parentMenu.style.setProperty('right', '0px', 'important');
            }
            parentMenu = parentMenu.parentElement ? parentMenu.parentElement.closest('[class*="vertical-menu"], [class*="menu-container"], [class*="drawer"]') : null;
          }
        }
      }
    });
  });

  const drawerCloseButtons = Array.from(document.querySelectorAll('[class*="vertical-menu__close"], [class*="menu__close"], .cmp-header-vertical-menu__close, [class*="vertical-menu-overlay"]'));
  drawerCloseButtons.forEach(function(cBtn) {
    if (cBtn.hasAttribute('data-drawer-close-bound')) return;
    cBtn.setAttribute('data-drawer-close-bound', 'true');
    cBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      document.querySelectorAll('.cmp-header-vertical-menu, [class*="vertical-menu"]').forEach(function(vm) {
        vm.classList.remove('is-open', 'open');
        vm.style.setProperty('display', 'none', 'important');
      });
      document.querySelectorAll('.cmp-header-vertical-menu__container, [class*="vertical-menu__container"]').forEach(function(vmc) {
        vmc.classList.remove('is-open', 'open');
        vmc.style.setProperty('right', '-100%', 'important');
        vmc.style.setProperty('display', 'none', 'important');
        vmc.style.setProperty('visibility', 'hidden', 'important');
      });
      document.querySelectorAll('[class*="navigation__item"]').forEach(function(ni) {
        ni.classList.remove('is-current', 'is-open', 'open', 'active');
      });
    });
  });

  navDropdownItems.forEach(function(item) {
    if (item.hasAttribute('data-flyout-bound')) return;
    item.setAttribute('data-flyout-bound', 'true');
    const dropdown = getDropdownFor(item);
    if (!dropdown) return;

    // Select the item triggers (button, link, span), outside the dropdown panel
    const triggers = Array.from(item.querySelectorAll(':scope > a, :scope > button, :scope > span, button, a, span, [role="button"], [class*="trigger"], a.nav-link, button.nav-link, [class*="link"]')).filter(function(el) {
      return !dropdown.contains(el);
    });

    function openFlyout() {
      clearTimeout(flyoutLeaveTimer);
      if (activeFlyoutItem && activeFlyoutItem !== item) {
        closeFlyoutItem(activeFlyoutItem);
      }
      activeFlyoutItem = item;

      item.classList.add('is-open', 'open', 'active');
      Array.from(item.classList).forEach(function(cls) {
        if (cls.includes('item') && !cls.includes('-open') && !cls.includes('is-') && !cls.includes('active')) {
          item.classList.add(cls + '-flyout-open', cls + '-open');
        }
      });

      // Activate all trigger items (e.g. .main-menu-item, .nav-item) outside dropdown
      item.querySelectorAll('[class*="menu-item"], [class*="nav-item"]').forEach(function(sub) {
        if (!dropdown.contains(sub)) {
          sub.classList.add('active', 'is-active');
        }
      });

      triggers.forEach(function(trg) {
        trg.setAttribute('aria-expanded', 'true');
        trg.setAttribute('data-popup-open', '');
        trg.setAttribute('data-pressed', '');
        trg.classList.add('is-open', 'open', 'active', 'is-active');
        applyFrameworkStateClasses(trg, true);
      });

      const content = dropdown.querySelector('[class*="content"], [class*="inner"], [class*="container"]') || dropdown.firstElementChild || dropdown;
      const h = Math.max(content ? content.scrollHeight : 0, dropdown.scrollHeight);
      const isMega = dropdown.matches('[class*="megamenu"], [class*="mega-menu"], [class*="nav-megamenu"], [class*="overlay"]');

      const allNavContainers = [navRoot];
      if (navRoot) {
        const innerNav = navRoot.querySelector('nav, [class*="gnb"], [role="navigation"]');
        if (innerNav && !allNavContainers.includes(innerNav)) allNavContainers.push(innerNav);
        const outerNav = navRoot.closest('header, nav, [class*="gnb"], [role="navigation"]');
        if (outerNav && !allNavContainers.includes(outerNav)) allNavContainers.push(outerNav);
      }

      allNavContainers.forEach(function(nr) {
        if (!nr) return;
        nr.classList.add('is-open', 'has-flyout-open', 'with-submenu-open');
        Array.from(nr.classList).forEach(function(cls) {
          if (cls.includes('nav') && !cls.includes('with-flyout-open')) {
            nr.classList.add(cls + '-with-flyout-open');
          }
        });
        Array.from(nr.classList).forEach(function(cls) {
          if (!cls.includes('--') && (cls.includes('nav') || cls.includes('gnb') || cls.includes('header') || cls.includes('menu'))) {
            nr.classList.add(cls + '--opended', cls + '--opened', cls + '--active', 'with-submenu-open');
            if (window.innerWidth <= 833) {
              nr.classList.add(cls + '--l1-show');
            }
          }
        });
        nr.style.setProperty('--l1-container-current-height', '800px');
      });
      if (isMega && h > 0) {
        const megaH = Math.max(h, 380);
        dropdown.style.setProperty('--flyout-height', (megaH + 30) + 'px');
        dropdown.style.minHeight = (megaH + 30) + 'px';
      }

      dropdown.style.height = 'auto';
      dropdown.style.setProperty('visibility', 'visible', 'important');
      dropdown.style.setProperty('opacity', '1', 'important');
      dropdown.style.setProperty('display', 'block', 'important');
      dropdown.style.setProperty('pointer-events', 'auto', 'important');
      dropdown.style.setProperty('max-height', '2000px', 'important');
      dropdown.style.setProperty('--l1-container-current-height', '800px');
      if (window.innerWidth <= 833) {
        dropdown.style.setProperty('right', '0px', 'important');
      }
      dropdown.setAttribute('data-open', '');
      dropdown.setAttribute('data-state', 'open');
      dropdown.setAttribute('aria-hidden', 'false');
      dropdown.classList.add('is-open', 'open', 'show', 'active');

      // Support dynamic BEM mega-menu state classes
      Array.from(item.classList).forEach(function(c) {
        if (!c.includes('--')) {
          item.classList.add(c + '--show', c + '--active', c + '--open', c + '--open-pc', c + '--show-pc');
        }
      });
      if (item.parentElement) {
        Array.from(item.parentElement.classList).forEach(function(c) {
          if (!c.includes('--')) item.parentElement.classList.add(c + '--show', c + '--active');
        });
      }

      dropdown.querySelectorAll('[class*="menu-inner"], [class*="submenu-inner"]').forEach(function(el) {
        el.style.setProperty('visibility', 'visible', 'important');
        el.style.setProperty('opacity', '1', 'important');
        el.style.setProperty('transform', 'translateY(0)', 'important');
        // Preserve author display (e.g. display: flex with justify-content: space-between)
        if (window.getComputedStyle(el).display === 'none') {
          el.style.removeProperty('display');
        }
      });

      // Unhide intermediate wrappers and panel elements
      const elementsToUnhide = [dropdown];
      if (item.contains(dropdown)) {
        let anc = dropdown.parentElement;
        while (anc && anc !== item && anc !== document.body) {
          elementsToUnhide.push(anc);
          anc = anc.parentElement;
        }
      }
      elementsToUnhide.forEach(function(el) {
        el.classList.add('is-open', 'open', 'show', 'active');
        const curDisp = window.getComputedStyle(el).display;
        if (curDisp === 'none') {
          el.style.setProperty('display', 'block');
        }
        el.style.setProperty('visibility', 'visible');
        el.style.setProperty('opacity', '1');
        el.style.setProperty('pointer-events', 'auto');
      });

      // Position ONLY the popup dropdown itself if static and unstyled
      const cs = window.getComputedStyle(dropdown);
      if (cs.position === 'static' && !dropdown.matches('[class*="mega"], [class*="gnb"], [class*="container"], [class*="inner"]')) {
        dropdown.style.setProperty('position', 'absolute');
        dropdown.style.setProperty('top', '100%');
        const itemRect = item.getBoundingClientRect();
        if (itemRect.right > window.innerWidth * 0.75) {
          dropdown.style.setProperty('right', '0');
          dropdown.style.setProperty('left', 'auto');
        } else {
          dropdown.style.setProperty('left', '0');
          dropdown.style.setProperty('right', 'auto');
        }
        dropdown.style.setProperty('z-index', '1000');
      }
      dropdown.querySelectorAll('[role="menu"], [data-baseweb="menu"]').forEach(function(m) {
        m.classList.add('is-open', 'open', 'show', 'active');
        if (window.getComputedStyle(m).display === 'none') {
          m.style.setProperty('display', 'block');
        }
        m.style.setProperty('visibility', 'visible');
      });

      // Unclip ancestors
      let clipAnc = item.parentElement;
      while (clipAnc && clipAnc !== document.body && clipAnc !== document.documentElement) {
        const cs = window.getComputedStyle(clipAnc);
        if (cs.overflow === 'hidden' || cs.overflowX === 'hidden' || cs.overflowY === 'hidden' || cs.overflow === 'clip') {
          if (!clipAnc.hasAttribute('data-orig-overflow')) {
            clipAnc.setAttribute('data-orig-overflow', clipAnc.style.overflow || '');
          }
          clipAnc.style.setProperty('overflow', 'visible');
          clipAnc.classList.add('has-open-dropdown');
        }
        clipAnc = clipAnc.parentElement;
      }

      // Rotate chevron
      const icon = item.querySelector('[class*="chevron" i], [class*="caret" i], [class*="arrow" i]');
      if (icon) icon.style.transform = 'rotate(180deg)';

      // Apply framework state classes dynamically to dropdown, item, and triggers
      applyFrameworkStateClasses(dropdown, true);
      applyFrameworkStateClasses(item, true);
      triggers.forEach(function(trg) {
        applyFrameworkStateClasses(trg, true);
      });

      // Ensure all flyout/submenu items inside dropdown are visible and interactable
      dropdown.querySelectorAll('[class*="submenu-list-item"], [class*="flyout-item"]').forEach(function(el) {
        el.style.setProperty('opacity', '1');
        el.style.setProperty('visibility', 'visible');
        el.style.setProperty('transform', 'translateY(0)');
      });

      // Ensure the first sub-item / category in any nested category list is active by default
      const subLists = dropdown.querySelectorAll('[class*="nav-list"], [class*="category-list"], [class*="submenu-list"], ul');
      subLists.forEach(function(list) {
        const firstSub = list.querySelector(':scope > li, :scope > div > li');
        if (firstSub && !list.querySelector('.active, .is-active')) {
          firstSub.classList.add('active', 'is-active');
          firstSub.querySelectorAll('[class*="content-products-wrapper"], [class*="content-wrapper"], [class*="pane"]').forEach(function(w) {
            w.classList.add('active', 'is-active');
          });
        }
      });

      // Reveal authentic backdrop curtain overlays if navigation uses curtain or megamenu
      if (navRoot && (navRoot.matches('[class*="with-curtain"]') || dropdown.matches('[class*="megamenu"], [class*="mega-menu"]'))) {
        const curtains = Array.from(document.querySelectorAll('[class*="curtain"]:not(.nav-curtain), [class*="backdrop"], [class*="scrim"], [class*="overlay-cover"]'))
          .filter(function(c) { return c && c.tagName !== 'BODY' && c.tagName !== 'HTML' && c.tagName !== 'NAV' && c.tagName !== 'HEADER'; });
        curtains.forEach(function(curtain) {
          curtain.style.opacity = '1';
          curtain.style.visibility = 'visible';
          curtain.style.pointerEvents = 'auto';
          curtain.classList.add('is-active', 'is-open', 'show');
          Array.from(curtain.classList).forEach(function(cls) {
            if (!cls.endsWith('--show')) {
              curtain.classList.add(cls + '--show');
            }
          });
        });
      }
    }

    let lastHoverTime = 0;
    function handleDesktopHoverOrFocus() {
      if (window.innerWidth <= 833) return;
      lastHoverTime = Date.now();
      openFlyout();
    }

    function handleDesktopLeaveOrBlur() {
      if (window.innerWidth <= 833) return;
      scheduleFlyoutClose();
    }

    // Attach desktop hover & focus interactions for all navigation flyouts and dropdowns
    item.addEventListener('mouseenter', handleDesktopHoverOrFocus);
    item.addEventListener('mouseleave', handleDesktopLeaveOrBlur);
    item.addEventListener('focusin', handleDesktopHoverOrFocus);
    item.addEventListener('focusout', handleDesktopLeaveOrBlur);

    triggers.forEach(function(trg) {
      trg.addEventListener('mouseenter', handleDesktopHoverOrFocus);
      trg.addEventListener('mouseleave', handleDesktopLeaveOrBlur);
      trg.addEventListener('focus', handleDesktopHoverOrFocus);
    });

    dropdown.addEventListener('mouseenter', function() {
      clearTimeout(flyoutLeaveTimer);
    });
    dropdown.addEventListener('mouseleave', scheduleFlyoutClose);

    triggers.forEach(function(trg) {
      // Click handler toggles dropdown on button click or mobile tap
      trg.addEventListener('click', function(e) {
        const href = trg.getAttribute('href');
        const isAnchorNav = href && href !== '#' && !href.startsWith('javascript:');

        if (!isAnchorNav || window.innerWidth <= 833 || trg.tagName === 'BUTTON' || trg.hasAttribute('aria-haspopup')) {
          e.preventDefault();
          e.stopPropagation();
          const isSubOpen = item.classList.contains('is-open') || trg.getAttribute('aria-expanded') === 'true';
          const justHovered = (Date.now() - lastHoverTime) < 600;
          const isAlreadyClicked = item.getAttribute('data-opened-by-click') === 'true';

          const allNavContainers = [navRoot];
          if (navRoot) {
            const innerNav = navRoot.querySelector('nav, [class*="gnb"], [role="navigation"]');
            if (innerNav && !allNavContainers.includes(innerNav)) allNavContainers.push(innerNav);
            const outerNav = navRoot.closest('header, nav, [class*="gnb"], [role="navigation"]');
            if (outerNav && !allNavContainers.includes(outerNav)) allNavContainers.push(outerNav);
          }
          if (isSubOpen && isAlreadyClicked && !justHovered) {
            item.removeAttribute('data-opened-by-click');
            closeFlyoutItem(item);
            allNavContainers.forEach(function(nr) {
              if (!nr) return;
              nr.classList.remove('with-submenu-open', 'globalnav-with-submenu-open');
              Array.from(nr.classList).forEach(function(cls) {
                if (cls.includes('submenu-open')) nr.classList.remove(cls);
              });
            });
          } else {
            item.setAttribute('data-opened-by-click', 'true');
            navDropdownItems.forEach(function(other) {
              if (other !== item) closeFlyoutItem(other);
            });
            openFlyout();
            allNavContainers.forEach(function(nr) {
              if (!nr) return;
              nr.classList.add('with-submenu-open', 'globalnav-with-submenu-open');
            });
          }
        }
      });
    });

    // Ensure item and its dropdown start closed in resting state
    closeFlyoutItem(item);
  });

  if (navRoot) {
    navRoot.addEventListener('mouseleave', function() {
      if (window.innerWidth > 833) scheduleFlyoutClose();
    });
  }

  // Safety guard: if mouse moves outside navRoot and active dropdown on desktop, close flyout
  document.addEventListener('mousemove', function(e) {
    if (window.innerWidth <= 833) return;
    if (!activeFlyoutItem) return;
    const activeDropdown = getDropdownFor(activeFlyoutItem);
    const isInsideNav = navRoot && navRoot.contains(e.target);
    const isInsideDropdown = activeDropdown && activeDropdown.contains(e.target);
    if (!isInsideNav && !isInsideDropdown) {
      scheduleFlyoutClose();
    }
  });

  // Close dropdowns & mobile menu on escape or outside click
  document.addEventListener('click', (e) => {
    if (navRoot && !navRoot.contains(e.target)) {
      const isInsideSearch = e.target.closest && e.target.closest('[role="dialog"][class*="search" i], [class*="gnb-search" i], [class*="search-modal" i]');
      if (!isInsideSearch) closeAllNav();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllNav();
      const openSearch = document.querySelector('[role="dialog"][aria-hidden="false"], [class*="gnb-search"][aria-hidden="false"], [class*="search-modal"][aria-hidden="false"]');
      if (openSearch) closeSearchDialog(openSearch, null);
    }
  });

  // Universal Search Dialog, Modal & Overlay Controller (W3C ARIA compliant)
  function openSearchDialog(dlg, trg) {
    if (trg) trg.setAttribute('aria-expanded', 'true');
    dlg.setAttribute('aria-hidden', 'false');
    dlg.removeAttribute('hidden');
    dlg.classList.add('is-open', 'open', 'show', 'active');

    Array.from(dlg.classList).forEach(function(cls) {
      if (!cls.includes('--')) {
        dlg.classList.add(cls + '--show', cls + '--open', cls + '--active');
        document.body.classList.add(cls + '--layer-open');
      }
    });

    dlg.style.setProperty('display', 'block', 'important');
    dlg.style.setProperty('visibility', 'visible', 'important');
    dlg.style.setProperty('opacity', '1', 'important');
    dlg.style.setProperty('pointer-events', 'auto', 'important');

    const scrim = dlg.querySelector('[class*="dimmed" i], [class*="backdrop" i], [class*="scrim" i], [class*="overlay" i]') ||
                  document.querySelector('.srd19-gnb-search__dimmed, [class*="search-backdrop"]');
    if (scrim) {
      scrim.style.setProperty('display', 'block', 'important');
      scrim.style.setProperty('opacity', '1', 'important');
      scrim.style.setProperty('pointer-events', 'auto', 'important');
      scrim.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        closeSearchDialog(dlg, trg);
      };
    }

    const input = dlg.querySelector('input[type="search"], input[type="text"], input[name*="search" i], input[id*="search" i], input');
    if (input) {
      setTimeout(function() { input.focus(); }, 100);
    }

    const closeBtns = dlg.querySelectorAll('button[class*="close" i], [aria-label*="close" i], [class*="btn-close" i], [data-dismiss="modal"]');
    closeBtns.forEach(function(btn) {
      btn.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        closeSearchDialog(dlg, trg);
      };
    });
  }

  function closeSearchDialog(dlg, trg) {
    if (trg) trg.setAttribute('aria-expanded', 'false');
    const allSearchDlgs = Array.from(document.querySelectorAll('[role="dialog"]:not(body), dialog, [class*="gnb-search"]:not(body), [class*="search-modal"]:not(body), [class*="search-overlay"]:not(body)'))
      .filter(function(d) { return d && d !== document.body && d.tagName !== 'BODY'; });
    if (dlg && dlg !== document.body && !allSearchDlgs.includes(dlg)) allSearchDlgs.push(dlg);

    allSearchDlgs.forEach(function(d) {
      d.setAttribute('aria-hidden', 'true');
      d.classList.remove('is-open', 'open', 'show', 'active');

      Array.from(d.classList).forEach(function(cls) {
        if (cls.includes('--show') || cls.includes('--open') || cls.includes('--active')) {
          d.classList.remove(cls);
        }
        const base = cls.split('--')[0];
        document.body.classList.remove(base + '--layer-open');
      });

      d.style.setProperty('display', 'none', 'important');
      d.style.setProperty('visibility', 'hidden', 'important');
      d.style.setProperty('pointer-events', 'none', 'important');
    });

    const scrims = document.querySelectorAll('.srd19-gnb-search__dimmed, [class*="search-backdrop"], [class*="search"] [class*="dimmed"]');
    scrims.forEach(function(scrim) {
      scrim.style.setProperty('display', 'none', 'important');
      scrim.style.setProperty('pointer-events', 'none', 'important');
    });

    if (trg && typeof trg.focus === 'function') trg.focus();
  }

  // Globally bind all search close buttons and dimmed overlays
  document.querySelectorAll('button[class*="search" i][class*="close" i], [class*="gnb-search__close"], [class*="search"] button[class*="close" i], [class*="search"] [aria-label*="close" i], .srd19-gnb-search__dimmed').forEach(function(btn) {
    if (btn.hasAttribute('data-search-close-bound')) return;
    btn.setAttribute('data-search-close-bound', 'true');
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      closeSearchDialog(null, null);
    });
  });

  const searchTriggers = Array.from(document.querySelectorAll(
    'button[class*="search" i]:not([type="submit"]):not([class*="submit"]), ' +
    '[aria-label*="search" i]:not(input):not(form), ' +
    '[data-target*="search" i], ' +
    '[aria-controls*="search" i], ' +
    '[class*="search-btn" i], ' +
    '[class*="search-toggle" i], ' +
    '[class*="search-trigger" i], ' +
    '[class*="utility-search" i], ' +
    '[class*="search-opener" i], ' +
    'a[href*="#search" i]'
  ));

  searchTriggers.forEach(function(trg) {
    if (trg.hasAttribute('data-search-bound')) return;
    trg.setAttribute('data-search-bound', 'true');
    trg.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();

      let searchDialog = null;
      const ctrlId = trg.getAttribute('aria-controls') || trg.getAttribute('data-target');
      if (ctrlId) {
        searchDialog = document.getElementById(ctrlId.replace(/^#/, ''));
      }
      if (!searchDialog) {
        searchDialog = document.querySelector(
          'dialog, [role="dialog"][class*="search" i]:not(body), section.srd19-gnb-search, [class*="search-overlay" i]:not(body), [class*="search-modal" i]:not(body), [class*="search-layer" i]:not(body), [class*="search-popup" i]:not(body), [class*="search-container" i]:not(body), section[class*="search" i]:not(body), [class*="gnb-search" i]:not(body):not(html), [role="search"][role="dialog"], [role="search"]:not(body)'
        );
      }
      if (searchDialog && (searchDialog === document.body || searchDialog === document.documentElement)) {
        searchDialog = null;
      }
      if (searchDialog && !searchDialog.matches('dialog, [role="dialog"], section, [class*="overlay"], [class*="modal"], [class*="layer"], [class*="popup"], [class*="container"]')) {
        const parentContainer = searchDialog.closest('dialog, [role="dialog"], section, [class*="overlay"], [class*="modal"], [class*="layer"], [class*="popup"], [class*="container"]');
        if (parentContainer && parentContainer !== document.body && parentContainer !== document.documentElement) {
          searchDialog = parentContainer;
        }
      }

      if (searchDialog) {
        const isAlreadyOpen = searchDialog.getAttribute('aria-hidden') === 'false' ||
                              searchDialog.classList.contains('is-open') ||
                              searchDialog.classList.contains('show') ||
                              searchDialog.classList.contains('srd19-gnb-search--show');

        if (isAlreadyOpen) {
          closeSearchDialog(searchDialog, trg);
        } else {
          openSearchDialog(searchDialog, trg);
        }
      }
    });
  });

  // Universal sub-tab & category switcher inside dropdowns
  document.querySelectorAll('[class*="submenu"] ul > li, [class*="flyout"] ul > li, [class*="nav-tab__overlay"] ul > li, [class*="category-list"] > li, [class*="nav-list"] > li').forEach(function(subLi) {
    subLi.addEventListener('mouseenter', function() {
      const parentUl = subLi.parentElement;
      if (!parentUl) return;
      Array.from(parentUl.children).forEach(function(sibling) {
        if (sibling !== subLi) {
          sibling.classList.remove('active', 'is-active');
          sibling.querySelectorAll('[class*="content-products-wrapper"], [class*="content-wrapper"], [class*="pane"]').forEach(function(w) {
            w.classList.remove('active', 'is-active');
          });
        }
      });
      subLi.classList.add('active', 'is-active');
      subLi.querySelectorAll('[class*="content-products-wrapper"], [class*="content-wrapper"], [class*="pane"]').forEach(function(w) {
        w.classList.add('active', 'is-active');
      });
    });
  });

  // Universal Detached Dialog & Mega-Menu Panel Controller
  const dialogPanel = document.querySelector('dialog, [role="dialog"], [class*="mega-menu-panel"], [class*="megamenu-panel"], [class*="header-panel"]');
  const panelBackdrop = Array.from(document.querySelectorAll('.nav-curtain, [class*="backdrop"], [class*="curtain"], [class*="scrim"]'))
    .find(function(c) { return c && c.tagName !== 'BODY' && c.tagName !== 'HTML' && c.tagName !== 'NAV' && c.tagName !== 'HEADER'; });
  const rawPanels = dialogPanel ? Array.from(dialogPanel.querySelectorAll('[class*="panel-content"], [data-category], section, article')) : [];
  const panelContents = rawPanels.filter(function(p) {
    return p !== dialogPanel &&
      !p.matches('[class*="wrapper"]') &&
      p.querySelectorAll('[class*="panel-content"]').length === 0;
  });

  // Universal Navigation Triggers: all buttons or links inside nav / header
  const navTriggers = Array.from(document.querySelectorAll(
    'header nav button, header nav a, ' +
    'header ol > li > button, header ol > li > a, ' +
    'header ul > li > button, header ul > li > a, ' +
    'header [class*="nav-item"] button, header [class*="nav-item"] a, ' +
    'header [class*="nav-items"] > li > button, header [class*="nav-items"] > li > a, ' +
    '[role="navigation"] button, [role="navigation"] a'
  )).filter(function(el) {
    const cls = (el.getAttribute('class') || '').toLowerCase();
    const href = (el.getAttribute('href') || '');
    if (cls.includes('logo') || cls.includes('brand') || cls.includes('close') || cls.includes('universal-nav-toggle')) return false;
    if (el.tagName.toLowerCase() === 'a' && (href === '/' || href === '#' || href === '' || href === window.location.pathname)) return false;
    return true;
  });

  if (dialogPanel && panelContents.length > 0 && navTriggers.length > 0) {
    let panelTimer = null;

    // Helper: Map each trigger to its most relevant panel dynamically
    function findPanelForTrigger(btn, index) {
      // 1. Check aria-controls, data-target, data-panel, or href
      const ctrl = btn.getAttribute('aria-controls') || btn.getAttribute('data-target') || btn.getAttribute('data-panel');
      if (ctrl) {
        const directMatch = document.getElementById(ctrl.replace(/^#/, ''));
        if (directMatch && panelContents.includes(directMatch)) return directMatch;
      }

      // 2. Check keyword matching (button text, id, aria-label, title)
      const btnText = (btn.innerText || '').toLowerCase().trim();
      const btnId = (btn.getAttribute('id') || '').toLowerCase();
      const btnLabel = (btn.getAttribute('aria-label') || btn.getAttribute('title') || '').toLowerCase();
      const keywords = (btnText + ' ' + btnId + ' ' + btnLabel).replace(/[^a-z0-9]/g, ' ').split(' ').filter(Boolean);

      // Check if button is in primary category nav items list (sequential 1-to-1 mapping)
      const centerNav = btn.closest('[class*="align--center"], [class*="nav-items"], [class*="primary-nav"], nav > ul, nav > ol');
      if (centerNav) {
        const centerItems = Array.from(centerNav.querySelectorAll('button, a'));
        const centerIdx = centerItems.indexOf(btn);
        if (centerIdx >= 0 && centerIdx < panelContents.length) {
          return panelContents[centerIdx];
        }
      }

      // Special check for region / language / locale
      if (keywords.some(function(k) { return ['locale', 'region', 'language', 'country', 'globe'].includes(k); })) {
        const localeMatch = panelContents.find(function(p) {
          return p.querySelector('[class*="locale"], [class*="region"], [class*="language"]') ||
                 p.className.toLowerCase().includes('locale');
        });
        if (localeMatch) return localeMatch;
      }

      // Token scoring across panel ID, data attributes, headings, classes, and inner text
      let bestPanel = null;
      let highestScore = 0;

      panelContents.forEach(function(p) {
        const pCls = (p.getAttribute('class') || '').toLowerCase();
        const pId = (p.getAttribute('id') || '').toLowerCase();
        const pData = (p.getAttribute('data-category') || p.getAttribute('data-title') || '').toLowerCase();
        const pTitles = Array.from(p.querySelectorAll('[class*="title"], [class*="category"], [class*="heading"], h1, h2, h3, h4, h5, h6')).map(function(h) {
          return (h.innerText || '').toLowerCase();
        }).join(' ');
        const pText = (p.innerText || '').toLowerCase();

        let score = 0;
        for (const kw of keywords) {
          if (kw.length < 3 || ['item', 'nav', 'menu', 'button', 'link', 'show', 'view'].includes(kw)) continue;
          if (pId.includes(kw)) score += 10;
          if (pData.includes(kw)) score += 10;
          if (pCls.includes(kw)) score += 6;
          if (pTitles.includes(kw)) score += 5;
          else if (pText.includes(kw)) score += 2;
        }

        if (score > highestScore) {
          highestScore = score;
          bestPanel = p;
        }
      });

      if (bestPanel && highestScore > 0) {
        return bestPanel;
      }

      // 3. Fallback: Sequential 1-to-1 index matching
      if (index < panelContents.length) {
        return panelContents[index];
      }
      return null;
    }

    // Build trigger-to-panel dynamic map
    const triggerPanelPairs = navTriggers.map(function(btn, idx) {
      return { btn: btn, panel: findPanelForTrigger(btn, idx) };
    }).filter(function(pair) {
      return !!pair.panel;
    });

    function openPanel(targetPanel, activeBtn) {
      clearTimeout(panelTimer);
      dialogPanel.setAttribute('open', '');
      dialogPanel.setAttribute('aria-hidden', 'false');
      dialogPanel.style.display = 'block';
      dialogPanel.style.opacity = '1';
      dialogPanel.style.visibility = 'visible';
      dialogPanel.style.pointerEvents = 'auto';

      panelContents.forEach(function(p) {
        if (p === targetPanel) {
          p.classList.add('active', 'is-active');
          p.style.display = '';
          p.style.opacity = '1';
          p.style.visibility = 'visible';
          p.style.pointerEvents = 'auto';

          // Set dynamic height from content
          const ph = Math.max(
            p.scrollHeight || 0,
            p.getBoundingClientRect ? p.getBoundingClientRect().height : 0,
            p.offsetHeight || 0,
            360
          );
          dialogPanel.style.setProperty('--active-panel-height', (ph + 40) + 'px');
          dialogPanel.style.height = (ph + 120) + 'px';
          dialogPanel.style.minHeight = (ph + 120) + 'px';
          dialogPanel.style.blockSize = 'auto';
          dialogPanel.style.bottom = 'auto';
          dialogPanel.style.overflow = 'visible';
          const inner = dialogPanel.querySelector('[class*="panel-content-wrapper"], [class*="panel-content"], [class*="drawer-content"]') || dialogPanel;
          if (inner) {
            inner.style.setProperty('--active-panel-height', (ph + 40) + 'px');
            inner.style.height = (ph + 60) + 'px';
            inner.style.blockSize = 'auto';
            inner.style.overflow = 'visible';
          }
        } else {
          p.classList.remove('active', 'is-active');
          p.style.display = 'none';
          p.style.visibility = '';
        }
      });

      navTriggers.forEach(function(b) {
        if (b === activeBtn) {
          b.classList.add('is-hovered', 'is-active', 'active', 'highlighted');
        } else {
          b.classList.remove('is-hovered', 'is-active', 'active', 'highlighted');
        }
      });

      if (panelBackdrop) {
        panelBackdrop.classList.add('is-active', 'is-open');
        panelBackdrop.style.opacity = '1';
        panelBackdrop.style.visibility = 'visible';
      }
    }

    function closePanel() {
      clearTimeout(panelTimer);
      panelTimer = setTimeout(function() {
        dialogPanel.removeAttribute('open');
        dialogPanel.setAttribute('aria-hidden', 'true');
        dialogPanel.style.display = '';
        dialogPanel.style.opacity = '';
        dialogPanel.style.visibility = '';
        dialogPanel.style.pointerEvents = '';
        dialogPanel.style.height = '';
        dialogPanel.style.minHeight = '';
        dialogPanel.style.overflow = '';
        const inner = dialogPanel.querySelector('[class*="panel-content-wrapper"], [class*="panel-content"], [class*="drawer-content"]') || dialogPanel;
        if (inner) {
          inner.style.height = '';
          inner.style.overflow = '';
        }
        panelContents.forEach(function(p) {
          p.classList.remove('active', 'is-active');
          p.style.display = '';
        });
        if (panelBackdrop) {
          panelBackdrop.classList.remove('is-active', 'is-open');
          panelBackdrop.style.opacity = '';
          panelBackdrop.style.visibility = '';
        }
        navTriggers.forEach(function(b) {
          b.classList.remove('is-hovered', 'is-active', 'active', 'highlighted');
        });
      }, 150);
    }

    triggerPanelPairs.forEach(function(pair) {
      const btn = pair.btn;
      const panel = pair.panel;

      function onEnter() {
        if (window.innerWidth <= 833) return;
        openPanel(panel, btn);
      }
      function onLeave() {
        if (window.innerWidth <= 833) return;
        closePanel();
      }

      btn.addEventListener('mouseenter', onEnter);
      btn.addEventListener('mouseleave', onLeave);
      btn.addEventListener('focus', onEnter);
      btn.addEventListener('blur', onLeave);

      // Click toggle
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const isPActive = panel.classList.contains('active') && dialogPanel.hasAttribute('open');
        if (isPActive) {
          closePanel();
        } else {
          openPanel(panel, btn);
        }
      });
    });

    dialogPanel.addEventListener('mouseenter', function() {
      clearTimeout(panelTimer);
    });
    dialogPanel.addEventListener('mouseleave', function() {
      if (window.innerWidth > 833) closePanel();
    });
    if (panelBackdrop) {
      panelBackdrop.addEventListener('click', closePanel);
    }
  }
      `.trim());
    }

    // 2. Accordions / FAQ toggling
    if (ast.archetype === 'faq' || (ast.faqs && ast.faqs.length > 0)) {
      scripts.push(`
  // FAQ Accordion Interactivity
  const accordionItems = document.querySelectorAll('#${ast.id} .accordion-item');

  accordionItems.forEach((item) => {
    const trigger = item.querySelector('.accordion-trigger');
    const content = item.querySelector('.accordion-content');

    if (trigger && content) {
      trigger.addEventListener('click', () => {
        const isOpen = item.classList.toggle('is-open');
        trigger.setAttribute('aria-expanded', String(isOpen));
        content.setAttribute('aria-hidden', String(!isOpen));
      });
    }
  });
      `.trim());
    }

    // Universal Tabbed Sections & Category Filter Controller
    const hasTabs =
      ast.archetype === 'tabs' ||
      ast.archetype === 'features' ||
      ast.archetype === 'pricing' ||
      ast.archetype === 'testimonials' ||
      rawLower.includes('tab') ||
      rawLower.includes('filter') ||
      rawLower.includes('categor') ||
      rawLower.includes('department') ||
      rawLower.includes('segment') ||
      rawLower.includes('rounded-full') ||
      rawLower.includes('whitespace-nowrap') ||
      rawLower.includes('navitem') ||
      rawLower.includes('sidebar') ||
      rawLower.includes('framewrapper') ||
      rawLower.includes('mockup') ||
      rawLower.includes('pill');

    if (hasTabs) {
      scripts.push(`
  // Universal Mockup & Dashboard Tab Switcher
  (function() {
    const mockupFrames = Array.from(document.querySelectorAll('.WS84WW_frame, [class*="frameWrapper"], [class*="mockup-frame"], [class*="dashboard-frame"]'));
    mockupFrames.forEach(function(frame) {
      const tabs = Array.from(frame.querySelectorAll('.Mmx1Wq_navItem, [class*="sidebar"] button, [class*="navItem"]'));
      const views = Array.from(frame.querySelectorAll('.WS84WW_view, [class*="view-pane"], [data-tab-name], [data-tab-view]'));
      if (tabs.length === 0 || views.length === 0) return;

      tabs.forEach(function(tab) {
        tab.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          const tabText = (tab.textContent || '').trim();

          tabs.forEach(function(t) {
            t.classList.remove('active', 'is-active');
            t.style.removeProperty('background');
            t.style.removeProperty('background-color');
            t.style.removeProperty('color');
          });
          tab.classList.add('active', 'is-active');
          tab.style.setProperty('background-color', 'rgba(255, 255, 255, 0.04)', 'important');
          tab.style.setProperty('color', '#f7f8f8', 'important');

          let matchedView = views.find(function(v) {
            return v.getAttribute('data-tab-name') === tabText;
          });
          if (!matchedView) {
            matchedView = views.find(function(v) {
              const vText = (v.textContent || '').trim();
              return vText.includes(tabText) || tabText.includes(vText.slice(0, 15));
            });
          }

          if (matchedView) {
            views.forEach(function(v) {
              v.style.setProperty('display', 'none', 'important');
            });
            matchedView.style.setProperty('display', 'block', 'important');
            matchedView.style.setProperty('grid-column', '2', 'important');
            matchedView.style.setProperty('grid-row', '1', 'important');
            matchedView.style.setProperty('opacity', '1', 'important');
            matchedView.style.setProperty('visibility', 'visible', 'important');
          }
        });
      });
    });
  })();

  // Universal Tabbed Sections & Category Filter Controller
  (function() {
    const tabScope = document;
    
    // 1. Locate explicit tablist / filter containers
    const tabLists = Array.from(tabScope.querySelectorAll(
      '[role="tablist"], [class*="tab-header"], [class*="tab__header"], [class*="tab-nav"], [class*="tabs-nav"], [class*="tab-list"], [class*="tabList"], [class*="nav-tabs"], ul[class*="tabs"], [class*="filter-tabs"], [class*="filter-bar"], [class*="filters-bar"], [class*="filter-nav"], [class*="filters-nav"], [class*="category-tabs"], [class*="category-list"], [class*="categories-list"], [class*="pills"]:not(button):not(a), [class*="segmented"]:not(button):not(a), [class*="department"]'
    )).filter(function(cont) {
      return !cont.closest('[class*="product-viewer"], [data-component-list*="ProductViewer"], [class*="dropdown"], [class*="popover"]');
    });

    // 2. Also discover any button groups acting as tabs/filters
    const directButtonGroups = Array.from(tabScope.querySelectorAll('div, ul, nav')).filter(function(cont) {
      if (cont.closest('[class*="product-viewer"], [data-component-list*="ProductViewer"]')) return false;
      if (tabLists.includes(cont)) return false;
      const btns = Array.from(cont.querySelectorAll(':scope > button, :scope > a, :scope > li > button, :scope > li > a')).filter(function(b) {
        return !b.matches('[class*="close"], [class*="prev"], [class*="next"], [aria-label*="close" i]');
      });
      if (cont.closest('header, nav, [role="navigation"]')) {
        const isFilterGroup = cont.matches('[class*="filter"], [class*="tab"], [class*="pill"], [role="tablist"]') ||
                              btns.some(function(b) {
                                return b.matches('[class*="filter"], [class*="tab"], [class*="pill"], [class*="rounded-full"], [data-tab], [role="tab"]') ||
                                       /^(all|free|pro|popular|recent)$/i.test((b.textContent || '').trim());
                              });
        if (!isFilterGroup) return false;
      }
      return btns.length >= 2 && btns.length <= 15;
    });

    const tabGroups = tabLists.concat(directButtonGroups);
    if (tabGroups.length === 0) tabGroups.push(tabScope);
    
    tabGroups.forEach(function(group) {
      // 1. Collect candidate clickable triggers inside this group
      let tabs = Array.from(group.querySelectorAll(
        ':scope > button, :scope > a, :scope > li > button, :scope > li > a, button[role="tab"], a[role="tab"], [role="tab"], button[class*="tab"], a[class*="tab"], [data-tab], [class*="filter-btn"], [class*="filter-button"], a[class*="rounded-full"], button[class*="rounded-full"]'
      )).filter(function(el) {
        const cls = (typeof el.className === 'string' ? el.className : (el.getAttribute && el.getAttribute('class')) || '').toLowerCase();
        return !cls.includes('panel') && !cls.includes('content') && !cls.includes('pane') && !cls.includes('container') && !cls.includes('wrapper') && !cls.includes('close') && !cls.includes('arrow');
      });

      // Filter out containers if an inner interactive button/link is present
      tabs = tabs.filter(function(t) {
        return !tabs.some(function(other) { return other !== t && t.contains(other); });
      });

      if (tabs.length === 0) {
        tabs = Array.from(group.children).filter(function(el) {
          const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();
          return (el.matches('button, a, [role="tab"], li') && !cls.includes('panel') && !cls.includes('content'));
        });
      }

      if (tabs.length <= 1) return;

      // Identify initial active button and diff active/inactive classes
      let initialActiveIdx = tabs.findIndex(function(t) {
        const cls = (typeof t.className === 'string' ? t.className : (t.getAttribute && t.getAttribute('class')) || '').toLowerCase();
        return t.getAttribute('aria-selected') === 'true' || cls.includes('active') || cls.includes('selected') || cls.includes('current');
      });
      if (initialActiveIdx === -1) initialActiveIdx = 0;

      let activeUniqueClasses = [];
      let inactiveUniqueClasses = [];
      if (tabs.length >= 2) {
        const actBtn = tabs[initialActiveIdx];
        const inactBtn = tabs[initialActiveIdx === 0 ? 1 : 0];
        const actClasses = Array.from(actBtn.classList);
        const inactClasses = Array.from(inactBtn.classList);
        activeUniqueClasses = actClasses.filter(function(c) { return !inactClasses.includes(c); });
        inactiveUniqueClasses = inactClasses.filter(function(c) { return !actClasses.includes(c); });
      }

      // Locate matching tab panes
      let panes = [];
      const hasDirectControls = tabs.some(function(t) {
        const id = t.getAttribute('aria-controls') || t.getAttribute('data-target') || (t.getAttribute('href') || '').replace(/^#/, '');
        return id && document.getElementById(id);
      });
      
      if (hasDirectControls) {
        panes = tabs.map(function(t) {
          const id = t.getAttribute('aria-controls') || t.getAttribute('data-target') || (t.getAttribute('href') || '').replace(/^#/, '');
          return id ? document.getElementById(id) : null;
        }).filter(Boolean);
      }

      if (panes.length === 0) {
        const paneCandidates = Array.from(tabScope.querySelectorAll(
          '[role="tabpanel"], [class*="tab__pane"], [class*="tab-pane"], [class*="tab-content"], [data-tab-pane], [data-tab-pane-index], [class*="tab_panel"]'
        )).filter(function(p) {
          return !group.contains(p);
        });

        const topPanes = paneCandidates.filter(function(p) {
          return !paneCandidates.some(function(other) {
            return other !== p && other.contains(p);
          });
        });

        if (topPanes.length > 0) {
          panes = topPanes;
        }
      }

      // If no separate tabpane containers exist, find content cards / items to filter by category
      let cards = [];
      if (panes.length <= 1) {
        const cardCandidates = Array.from(tabScope.querySelectorAll(
          '[class*="card"]:not([class*="filter"]):not([class*="tab"]), [class*="item"]:not([class*="filter"]):not([class*="tab"]):not(li:has(> button)), [class*="carousel-responsive"], [class*="grid"] > div, [class*="list"] > li'
        )).filter(function(c) {
          if (group.contains(c)) return false;
          // Never treat navigation items, filter toolbars, menus, drawers, or pagination as content cards
          if (c.closest('header, nav, [role="navigation"], [class*="nav-"], [class*="filter"], [class*="breadcrumb"], [class*="menu"], [class*="pagination"], [class*="drawer"]')) {
            return false;
          }
          return true;
        });
        cards = cardCandidates.filter(function(c) {
          return !cardCandidates.some(function(other) {
            return other !== c && other.contains(c);
          });
        });
      }

      function setActiveTab(targetIdx) {
        const targetTab = tabs[targetIdx];
        if (!targetTab) return;
        const directId = targetTab.getAttribute('aria-controls') || targetTab.getAttribute('data-target') || (targetTab.getAttribute('href') || '').replace(/^#/, '');
        const targetPane = directId ? document.getElementById(directId) : null;

        // Animate pill indicator / sliding underline if present
        const targetItem = targetTab.closest('.tabnav-item, .tab-item, li') || targetTab;

        const tabnavRoot = targetTab.closest('.tabnav, [class*="tabnav-wrapper"], [class*="tab-wrapper"], [data-nav-type="pill"], [class*="pill"]:not(li):not(button)') || group.parentElement || group;
        const pillEl = targetTab.closest('.tabnav-pill, [class*="pill"]:not(li):not(button), .tabnav:not(li)') || tabnavRoot;
        const platter = pillEl ? (pillEl.querySelector('.tabnav-platter, [class*="platter"]') || pillEl) : null;
        const platterPad = platter ? (parseFloat(window.getComputedStyle(platter).paddingLeft || '0') || 0) : 0;
        const tabOffsetLeft = targetItem.offsetLeft + platterPad;
        const tabOffsetWidth = targetItem.offsetWidth;

        if (pillEl) {
          pillEl.style.setProperty('--tabnav-indicator-start', tabOffsetLeft + 'px');
          pillEl.style.setProperty('--tabnav-indicator-width', tabOffsetWidth + 'px');
          if (pillEl.parentElement) {
            pillEl.parentElement.style.setProperty('--tabnav-indicator-start', tabOffsetLeft + 'px');
            pillEl.parentElement.style.setProperty('--tabnav-indicator-width', tabOffsetWidth + 'px');
          }
        }

        const indicator = (platter || pillEl || tabnavRoot || document).querySelector('.tabnav-indicator, [class*="tab-indicator"], [class*="pill-indicator"], [class*="active-indicator"]');
        if (indicator) {
          indicator.style.transition = 'left 300ms cubic-bezier(0.25, 1, 0.5, 1), width 300ms cubic-bezier(0.25, 1, 0.5, 1), transform 300ms cubic-bezier(0.25, 1, 0.5, 1)';
          indicator.style.left = tabOffsetLeft + 'px';
          indicator.style.width = Math.max(tabOffsetWidth - 1, 0) + 'px';
        }

        tabs.forEach(function(t, i) {
          const isAct = i === targetIdx;
          t.setAttribute('aria-selected', String(isAct));
          t.setAttribute('tabindex', isAct ? '0' : '-1');
          
          const parentItem = t.closest('.tab__item, .tab-item, .tabnav-item, li');
          if (isAct) {
            t.classList.add('is-active', 'active', 'selected');
            if (parentItem) {
              parentItem.classList.add('tab__item--active', 'active', 'is-active');
              Array.from(parentItem.classList).forEach(function(c) {
                if (c.includes('item') && !c.includes('active')) {
                  parentItem.classList.add(c + '-active', c + '--active');
                }
              });
            }
            inactiveUniqueClasses.forEach(function(c) { t.classList.remove(c); });
            activeUniqueClasses.forEach(function(c) { t.classList.add(c); });
            const clList = Array.from(t.classList);
            clList.forEach(function(c) {
              if (c.includes('tab') && !c.includes('active')) {
                t.classList.add(c + '--active', c + '-active');
              }
            });
          } else {
            t.classList.remove('is-active', 'active', 'selected');
            if (parentItem) {
              parentItem.classList.remove('tab__item--active', 'active', 'is-active');
              Array.from(parentItem.classList).forEach(function(c) {
                if (c.endsWith('--active') || c.endsWith('-active') || c.endsWith('_active')) {
                  parentItem.classList.remove(c);
                }
              });
            }
            activeUniqueClasses.forEach(function(c) { t.classList.remove(c); });
            inactiveUniqueClasses.forEach(function(c) { t.classList.add(c); });
            Array.from(t.classList).forEach(function(c) {
              if (c.endsWith('--active') || c.endsWith('-active') || c.endsWith('_active')) {
                t.classList.remove(c);
              }
            });
          }
        });

        // Update paddle buttons state if present
        const pNav = group.closest('.tabnav, [class*="tabnav"]') || group.parentElement || group;
        const paddleLeft = pNav.querySelector('.tabnav-paddle-left, [class*="paddle-left"]');
        const paddleRight = pNav.querySelector('.tabnav-paddle-right, [class*="paddle-right"]');
        if (paddleLeft) {
          if (targetIdx === 0) {
            paddleLeft.setAttribute('disabled', '');
            paddleLeft.classList.add('tabnav-paddle-hidden');
          } else {
            paddleLeft.removeAttribute('disabled');
            paddleLeft.classList.remove('tabnav-paddle-hidden');
          }
        }
        if (paddleRight) {
          if (targetIdx === tabs.length - 1) {
            paddleRight.setAttribute('disabled', '');
            paddleRight.classList.add('tabnav-paddle-hidden');
          } else {
            paddleRight.removeAttribute('disabled');
            paddleRight.classList.remove('tabnav-paddle-hidden');
          }
        }

        // Switch matching panes
        if (panes.length > 0) {
          panes.forEach(function(p, i) {
            const isAct = targetPane ? (p === targetPane) : (i === targetIdx);
            p.setAttribute('aria-hidden', String(!isAct));
            
            const isSubgridOrFade = (function() {
              const pc = (p.parentElement && typeof p.parentElement.className === 'string' ? p.parentElement.className : '').toLowerCase();
              const sc = (typeof p.className === 'string' ? p.className : '').toLowerCase();
              return pc.includes('fade') || pc.includes('grid') || sc.includes('gallery-item') || sc.includes('fade');
            })();

            // Universal BEM modifier toggle
            const pClasses = Array.from(p.classList);
            if (isAct) {
              p.classList.add('is-active', 'active', 'current');
              p.classList.remove('should-hide', 'hidden', 'is-hidden');
              pClasses.forEach(function(c) {
                if (c.includes('panel') || c.includes('pane') || c.includes('tab') || c.includes('gallery-item')) {
                  p.classList.add(c + '--active', c + '-active');
                }
              });
              if (isSubgridOrFade) {
                p.style.display = '';
              } else {
                p.style.display = 'block';
              }
              p.style.opacity = '1';
              p.style.zIndex = '2';
              p.style.visibility = 'visible';
              p.style.pointerEvents = 'auto';

              // Play video if present
              const activeVid = p.querySelector('video');
              if (activeVid) {
                try {
                  activeVid.currentTime = 0;
                  activeVid.play().catch(function() {});
                } catch (_) {}
              }

              // Sync caption if present
              const capId = (p.id || '').replace('gallery-item', 'gallery-caption');
              const cap = (capId ? document.getElementById(capId) : null) || p.querySelector('.gallery-caption, [data-captions-gallery-item]');
              if (cap) {
                cap.removeAttribute('hidden');
                cap.setAttribute('aria-hidden', 'false');
                cap.style.opacity = '1';
                cap.style.visibility = 'visible';
              }

              // Synchronize inner subpanels (e.g. secondary categories or nested tabpanes)
              const innerPanels = Array.from(p.querySelectorAll('[role="tabpanel"], [class*="tabpanel"], [class*="subpanel"], [class*="__panel"]:not(:scope)'));
              if (innerPanels.length > 0) {
                let activeInner = innerPanels.find(function(ip) {
                  return ip.getAttribute('aria-hidden') === 'false' ||
                         Array.from(ip.classList).some(function(c) { return c.includes('active'); });
                }) || innerPanels[0];

                activeInner.classList.add('is-active', 'active');
                Array.from(activeInner.classList).forEach(function(c) {
                  if (c.includes('panel') || c.includes('pane') || c.includes('tab')) {
                    activeInner.classList.add(c + '--active', c + '-active');
                  }
                });
                activeInner.setAttribute('aria-hidden', 'false');
                activeInner.style.display = 'block';
                activeInner.style.opacity = '1';
                activeInner.style.visibility = 'visible';
              }

              // Unhide progress indicators and carousel navigation buttons inside this panel
              p.querySelectorAll('[class*="progressbar-indicator"], [class*="progress-indicator"]').forEach(function(ind) {
                Array.from(ind.classList).forEach(function(c) {
                  ind.classList.add(c + '--show', c + '-show');
                });
                ind.style.display = 'flex';
              });
              p.querySelectorAll('[class*="indicator__arrow"], [class*="swiper-button"], [class*="arrow"]').forEach(function(b) {
                b.style.display = 'inline-flex';
              });
            } else {
              p.classList.remove('is-active', 'active', 'current');
              p.classList.add('should-hide');
              pClasses.forEach(function(c) {
                if (c.endsWith('--active') || c.endsWith('-active') || c.endsWith('_active')) {
                  p.classList.remove(c);
                }
              });
              p.style.display = 'none';
              p.style.opacity = '0';
              p.style.zIndex = '0';
              p.style.visibility = 'hidden';
              p.style.pointerEvents = 'none';

              // Pause video
              const inactVid = p.querySelector('video');
              if (inactVid) {
                try {
                  inactVid.pause();
                } catch (_) {}
              }

              // Hide caption
              const capId = (p.id || '').replace('gallery-item', 'gallery-caption');
              const cap = (capId ? document.getElementById(capId) : null) || p.querySelector('.gallery-caption, [data-captions-gallery-item]');
              if (cap) {
                cap.setAttribute('hidden', 'until-found');
                cap.setAttribute('aria-hidden', 'true');
                cap.style.opacity = '0';
              }
            }
          });
          try { window.dispatchEvent(new Event('resize')); } catch (_) {}
        } else if (cards.length > 0) {
          // Filter cards by category keyword
          const targetTab = tabs[targetIdx];
          const filterText = (targetTab.textContent || '').trim().toLowerCase();
          if (filterText && filterText !== 'all') {
            const matchingCards = cards.filter(function(card) {
              const cardText = (card.textContent || '').toLowerCase();
              return cardText.includes(filterText);
            });
            if (matchingCards.length > 0) {
              cards.forEach(function(card) {
                const matches = matchingCards.includes(card);
                card.style.display = matches ? '' : 'none';
                if (matches) card.classList.remove('hidden');
                else card.classList.add('hidden');
              });
            }
          } else {
            cards.forEach(function(card) {
              card.style.display = '';
              card.classList.remove('hidden');
            });
          }
        }
      }

      // Initial active tab state calibration
      setActiveTab(initialActiveIdx);

      // Bind tab clicks and keyboard navigation
      tabs.forEach(function(tab, idx) {
        tab.addEventListener('click', function(e) {
          if (tab.tagName.toLowerCase() === 'a') e.preventDefault();
          setActiveTab(idx);
        });

        tab.addEventListener('keydown', function(e) {
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            const next = (idx + 1) % tabs.length;
            setActiveTab(next);
            if (tabs[next] && tabs[next].focus) tabs[next].focus();
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const prev = (idx - 1 + tabs.length) % tabs.length;
            setActiveTab(prev);
            if (tabs[prev] && tabs[prev].focus) tabs[prev].focus();
          } else if (e.key === 'Home') {
            e.preventDefault();
            setActiveTab(0);
            if (tabs[0] && tabs[0].focus) tabs[0].focus();
          } else if (e.key === 'End') {
            e.preventDefault();
            setActiveTab(tabs.length - 1);
            if (tabs[tabs.length - 1] && tabs[tabs.length - 1].focus) tabs[tabs.length - 1].focus();
          }
        });
      });

      // Bind paddle navigation buttons
      const pNav = group.closest('.tabnav, [class*="tabnav"]') || group.parentElement || group;
      const paddleLeft = pNav.querySelector('.tabnav-paddle-left, [class*="paddle-left"]');
      const paddleRight = pNav.querySelector('.tabnav-paddle-right, [class*="paddle-right"]');
      if (paddleLeft) {
        paddleLeft.addEventListener('click', function(e) {
          e.preventDefault();
          const curr = tabs.findIndex(function(t) { return t.getAttribute('aria-selected') === 'true' || t.classList.contains('active'); });
          if (curr > 0) setActiveTab(curr - 1);
        });
      }
      if (paddleRight) {
        paddleRight.addEventListener('click', function(e) {
          e.preventDefault();
          const curr = tabs.findIndex(function(t) { return t.getAttribute('aria-selected') === 'true' || t.classList.contains('active'); });
          if (curr < tabs.length - 1) setActiveTab(curr + 1);
        });
      }
    });
  })();
      `.trim());
    }

    // 2.5 Universal Swatch Fade Gallery Controller (Color Nav, Variant Switchers)
    scripts.push(`
  (function() {
    const root = document.querySelector('#${ast.id}') || document;
    
    // 1. Radio button-based swatches (Apple colornav, product variant switchers)
    const radioInputs = Array.from(root.querySelectorAll('input[type="radio"]'));
    const handledGroups = new Set();

    radioInputs.forEach(function(radio) {
      const groupName = radio.name || radio.getAttribute('data-gallery-id') || 'swatch-group';
      if (handledGroups.has(groupName)) return;
      handledGroups.add(groupName);

      const groupInputs = radioInputs.filter(function(r) {
        return (r.name || r.getAttribute('data-gallery-id') || 'swatch-group') === groupName;
      });
      if (groupInputs.length < 2) return;

      const navContainer = radio.closest('fieldset, .colornav-items, .colornav, [class*="colornav"], [class*="swatch-nav"], ul, form') || radio.parentElement;
      const gallery = (navContainer && navContainer.closest('[class*="gallery"], section, .viewport-content')) || root;
      const galleryItems = Array.from(gallery.querySelectorAll('.gallery-item, [class*="gallery-item"]'));
      if (!galleryItems.length) return;

      function switchVariant(targetIndex) {
        groupInputs.forEach(function(inp, i) {
          inp.checked = (i === targetIndex);
          const lbl = root.querySelector('label[for="' + inp.id + '"]');
          if (lbl) {
            if (i === targetIndex) lbl.classList.add('selected', 'active');
            else lbl.classList.remove('selected', 'active');
          }
        });

        galleryItems.forEach(function(item, i) {
          const isTarget = (i === targetIndex);
          if (isTarget) {
            item.classList.add('current');
            item.classList.remove('should-hide');
            item.style.setProperty('z-index', '2');
            item.style.setProperty('opacity', '1');
            item.style.setProperty('pointer-events', 'auto');
            item.style.removeProperty('display');
            item.style.setProperty('transition', 'opacity 0.4s ease-in-out');

            const mBlock = item.querySelector('.media-block');
            if (mBlock) mBlock.style.removeProperty('display');

            // Play video if variant has video
            const vid = item.querySelector('video');
            if (vid) {
              const wrapper = vid.closest('.inline-media-wrapper, .media-block, .media-container, .inline-media-component-container, .video-wrapper') || vid.parentElement;
              if (wrapper) {
                wrapper.classList.remove('idle', 'loading-empty', 'media-unloaded');
                wrapper.classList.add('loaded', 'playing', 'has-played');
              }
              const p = vid.play();
              if (p !== undefined) p.catch(function() {});
            }

            // Eagerly hydrate images in target variant
            item.querySelectorAll('img').forEach(function(img) {
              img.setAttribute('loading', 'eager');
              const pic = img.closest('picture');
              if (pic) {
                pic.querySelectorAll('source[data-empty]').forEach(function(s) { s.remove(); });
              }
              const realSrc = img.getAttribute('data-src') || img.src;
              if (realSrc && (!img.src || img.src.startsWith('data:'))) {
                img.src = realSrc;
              }
            });
          } else {
            item.classList.remove('current');
            item.style.setProperty('z-index', '0');
            item.style.setProperty('opacity', '0');
            item.style.setProperty('pointer-events', 'none');
            item.style.setProperty('transition', 'opacity 0.4s ease-in-out');

            const vid = item.querySelector('video');
            if (vid) {
              vid.pause();
            }

            setTimeout(function() {
              if (!item.classList.contains('current')) {
                item.classList.add('should-hide');
              }
            }, 400);
          }
        });
      }

      groupInputs.forEach(function(input, idx) {
        input.addEventListener('change', function(e) {
          e.stopPropagation();
          switchVariant(idx);
        });

        const label = input.id ? root.querySelector('label[for="' + input.id + '"]') : null;
        if (label) {
          label.addEventListener('click', function(e) {
            e.stopPropagation();
            switchVariant(idx);
          });
        }

        const itemLi = input.closest('li, .colornav-item');
        if (itemLi) {
          itemLi.addEventListener('click', function(e) {
            if (e.target !== input && e.target !== label) {
              e.stopPropagation();
              switchVariant(idx);
            }
          });
        }
      });
    });

    // 2. Button / Tab-based swatches (when no radio inputs exist)
    if (handledGroups.size === 0) {
      const swatchContainers = Array.from(root.querySelectorAll('[role="tablist"][class*="color"], [class*="swatches"], [class*="color-swatches"], .colornav'));
      swatchContainers.forEach(function(nav) {
        const triggers = Array.from(nav.querySelectorAll('button, [role="tab"], .colornav-item, .colornav-link, .swatch'));
        if (triggers.length < 2) return;
        const gallery = nav.closest('[class*="gallery"], section, .viewport-content') || root;
        const galleryItems = Array.from(gallery.querySelectorAll('.gallery-item, [class*="gallery-item"]'));
        if (!galleryItems.length) return;

        triggers.forEach(function(btn, idx) {
          btn.addEventListener('click', function(e) {
            e.preventDefault();
            triggers.forEach(function(t, i) {
              if (i === idx) t.classList.add('active', 'selected');
              else t.classList.remove('active', 'selected');
            });
            galleryItems.forEach(function(item, i) {
              if (i === idx) {
                item.classList.add('current');
                item.classList.remove('should-hide');
                item.style.setProperty('z-index', '2');
                item.style.setProperty('opacity', '1');
                item.style.setProperty('pointer-events', 'auto');
                item.style.removeProperty('display');
              } else {
                item.classList.remove('current');
                item.classList.add('should-hide');
                item.style.setProperty('z-index', '0');
                item.style.setProperty('opacity', '0');
                item.style.setProperty('pointer-events', 'none');
              }
            });
          });
        });
      });
    }
  })();
    `.trim());

    // 3. Carousel slide indicators / dots & arrow controls
    const arch = (ast.archetype as string) || '';
    const isNavigation =
      arch === 'navbar' ||
      arch === 'navigation' ||
      arch === 'header' ||
      arch === 'footer' ||
      (arch !== 'features' && arch !== 'hero' && arch !== 'carousel' && Boolean(ast.rawSectionHtml && (ast.rawSectionHtml.includes('<nav') || ast.rawSectionHtml.includes('site-header'))));

    const isCatalogOrFilter =
      ast.archetype === 'features' ||
      ast.archetype === 'pricing' ||
      ast.archetype === 'faq';

    const hasExplicitCarousel = !isNavigation && Boolean(
      ast.archetype === 'carousel' ||
      ast.carouselDots ||
      ast.layout === 'hero-overlay' ||
      ast.rawSectionHtml?.includes('carousel') ||
      ast.rawSectionHtml?.includes('swiper') ||
      ast.rawSectionHtml?.includes('slick') ||
      ast.rawSectionHtml?.includes('glide') ||
      ast.rawSectionHtml?.includes('splide') ||
      ast.rawSectionHtml?.includes('slider') ||
      ast.rawSectionHtml?.includes('gallery') ||
      ast.rawSectionHtml?.includes('dotnav') ||
      ast.rawSectionHtml?.includes('paddlenav') ||
      ast.rawSectionHtml?.includes('roledescription="carousel"') ||
      ast.rawSectionHtml?.includes('pagination-next') ||
      ast.rawSectionHtml?.includes('pagination-prev')
    );

    const hasImageGridFallback = !isCatalogOrFilter && !isNavigation && Boolean(ast.images && ast.images.length > 1);

    if (hasExplicitCarousel || hasImageGridFallback) {
      scripts.push(`
  // Universal Carousel: Transform/Translate, Horizontal Scroll-Snap & Stacked Slide Controllers
  const sectionScope = document.getElementById('${ast.id}') || document.body || document;

  // 1. Detect Universal Transform / Translate Sliders (Swiper, Slick, Owl, Glide, Splide, etc.)
  // Support ANY number of carousels inside the section (e.g. multi-category tabs, multiple rows)
  const candidateTracks = Array.from(sectionScope.querySelectorAll(
    '.swiper-wrapper, .slick-track, .glide__slides, .splide__list, .owl-stage, [class*="slider-track"], [class*="slides-wrapper"], [class*="carousel-wrapper"], [class*="slider__wrapper"], [class*="carousel__track"], [class*="gallery-items"], [class*="gallery-item-container"], [class*="media-gallery-item-container"]'
  ));

  if (candidateTracks.length === 0) {
    const fallbackTrack = (function() {
      // Check aria-controls on pagination/carousel buttons (e.g. bullets-carousel)
      const ctrlBtn = sectionScope.querySelector('button[aria-controls], [role="button"][aria-controls]');
      if (ctrlBtn) {
        const ctrlId = ctrlBtn.getAttribute('aria-controls');
        const ctrlTarget = ctrlId ? document.getElementById(ctrlId) : null;
        if (ctrlTarget) {
          if (ctrlTarget.children.length > 1) return ctrlTarget;
          const inner = Array.from(ctrlTarget.children).find(function(c) { return c.children.length > 1; });
          if (inner) return inner;
        }
      }
      const carEl = sectionScope.querySelector('[id*="carousel" i], [class*="carousel" i], [id*="slider" i], [class*="slider" i]');
      if (carEl && !carEl.matches('button, a')) {
        if (carEl.children.length > 1) return carEl;
        const inner = Array.from(carEl.children).find(function(c) { return c.children.length > 1 && !c.matches('button, a'); });
        if (inner) return inner;
      }
      return Array.from(sectionScope.querySelectorAll('div, ul, ol')).find(function(el) {
        if (el.tagName === 'SECTION' || el.tagName === 'BODY' || el.tagName === 'MAIN' || el.tagName === 'HEADER' || el.tagName === 'NAV') return false;
        if (el.closest('.scroll-gallery, [class*="scroll-gallery"], [class*="paddlenav"]')) return false;
        const cls = (typeof el.className === 'string' ? el.className : (el.getAttribute && el.getAttribute('class')) || '').toLowerCase();
        if (cls.includes('container') && !cls.includes('wrapper') && !cls.includes('gallery')) return false;
        if (cls.includes('nav') || cls.includes('menu') || cls.includes('header') || cls.includes('footer')) return false;
        const kids = Array.from(el.children).filter(function(k) {
          const t = (k.tagName || '').toLowerCase();
          return !['style', 'script', 'noscript', 'template'].includes(t);
        });
        if (kids.length <= 1) return false;
        // A carousel track MUST NOT have headers, navs, footers, or sub-galleries as direct slides!
        if (kids.some(function(k) {
          const t = (k.tagName || '').toUpperCase();
          const kc = (typeof k.className === 'string' ? k.className : '').toLowerCase();
          return t === 'HEADER' || t === 'NAV' || t === 'FOOTER' || kc.includes('header') || kc.includes('heading') || kc.includes('gallery');
        })) return false;

        return kids.some(function(k) {
          const kCls = (typeof k.className === 'string' ? k.className : (k.getAttribute && k.getAttribute('class')) || '').toLowerCase();
          return (kCls.includes('slide') && !kCls.includes('gallery')) || kCls.includes('carousel-item') || kCls.includes('slider-item') || kCls.includes('gallery-item');
        });
      }) || null;
    })();
    if (fallbackTrack) candidateTracks.push(fallbackTrack);
  }

  function isStackedOrFadeTrack(t) {
    const tCls = (typeof t.className === 'string' ? t.className : (t.getAttribute && t.getAttribute('class')) || '').toLowerCase();
    const parent = t.parentElement;
    const pCls = (parent && typeof parent.className === 'string' ? parent.className : (parent && parent.getAttribute && parent.getAttribute('class')) || '').toLowerCase();
    const pComp = (parent && parent.getAttribute && parent.getAttribute('data-component-list') || '').toLowerCase();
    const tComp = (t.getAttribute && t.getAttribute('data-component-list') || '').toLowerCase();

    if (tCls.includes('fade') || tCls.includes('crossfade') || tCls.includes('stack') ||
        pCls.includes('fade') || pCls.includes('crossfade') || pCls.includes('stack') ||
        tComp.includes('fade') || tComp.includes('crossfade') || tComp.includes('stack') ||
        pComp.includes('fade') || pComp.includes('crossfade') || pComp.includes('stack')) {
      return true;
    }

    const slides = Array.from(t.children).filter(function(k) {
      const tag = (k.tagName || '').toLowerCase();
      return !['style', 'script', 'noscript', 'template'].includes(tag);
    });
    if (slides.length <= 1) return false;

    const s0 = slides[0];
    const s1 = slides[1];
    if (s0.getAttribute('role') === 'tabpanel' || s1.getAttribute('role') === 'tabpanel') {
      return true;
    }

    try {
      const s0Style = window.getComputedStyle(s0);
      const tStyle = window.getComputedStyle(t);
      if (s0Style.gridArea === '1 / 1 / -1' || s0Style.gridArea === '1 / 1 / 1 / 1' ||
          tStyle.gridTemplateRows === 'subgrid' || tStyle.gridTemplateColumns === 'subgrid' ||
          s0Style.gridTemplateRows === 'subgrid' || s0Style.gridTemplateColumns === 'subgrid') {
        return true;
      }
    } catch (_) {}

    if (s0 && s1) {
      const dx = Math.abs(s1.offsetLeft - s0.offsetLeft);
      const dy = Math.abs(s1.offsetTop - s0.offsetTop);
      if (dx < 15 && dy < 15 && (s0.offsetWidth > 50 || s1.offsetWidth > 50)) {
        return true;
      }
    }

    return false;
  }

  const transformTracks = candidateTracks.filter(function(t, idx, arr) {
    if (arr.indexOf(t) !== idx) return false;
    if (!t.children || t.children.length <= 1) return false;
    if (isStackedOrFadeTrack(t)) return false;
    // Outer containers that enclose another candidate track are viewports/wrappers, NOT the moving track!
    const hasChildTrack = candidateTracks.some(function(other) {
      return other !== t && t.contains(other);
    });
    if (hasChildTrack) return false;
    return true;
  });

  if (transformTracks.length > 0) {
    transformTracks.forEach(function(transformTrack, trackIdx) {
      // Relocate non-slide tags (<style>, <script>, <template>, <noscript>) out of the track to its parent
      Array.from(transformTrack.children).forEach(function(child) {
        const tag = (child.tagName || '').toLowerCase();
        if (['style', 'script', 'noscript', 'template'].includes(tag)) {
          if (transformTrack.parentElement) {
            transformTrack.parentElement.insertBefore(child, transformTrack);
          }
        }
      });

      // Purge any runtime duplicate or clone slides captured during live DOM hydration
      Array.from(transformTrack.children).forEach(function(child) {
        const childCls = (typeof child.className === 'string' ? child.className : (child.getAttribute && child.getAttribute('class')) || '').toLowerCase();
        if (childCls.includes('duplicate') || childCls.includes('cloned') || childCls.includes('swiper-slide-duplicate') || (child.getAttribute && child.getAttribute('data-slick-index') && parseInt(child.getAttribute('data-slick-index')) < 0)) {
          child.remove();
        }
      });

      const allSlides = Array.from(transformTrack.children).filter(function(el) {
        const tag = (el.tagName || '').toLowerCase();
        if (['style', 'script', 'noscript', 'template'].includes(tag)) return false;
        const elCls = (typeof el.className === 'string' ? el.className : (el.getAttribute && el.getAttribute('class')) || '').toLowerCase();
        return el.nodeType === 1 && (el.offsetWidth > 0 || elCls.includes('slide') || elCls.includes('item') || el.children.length > 0 || el.style.width);
      });
      if (allSlides.length <= 1) return;

      const nonDupSlides = allSlides.filter(function(s) {
        const sCls = (typeof s.className === 'string' ? s.className : (s.getAttribute && s.getAttribute('class')) || '').toLowerCase();
        return !sCls.includes('duplicate') && !sCls.includes('clone');
      });
      const uniqueSlides = nonDupSlides.length > 0 ? nonDupSlides : allSlides;
      const baseIdx = Math.max(allSlides.indexOf(uniqueSlides[0]), 0);

      // Locate container and enclosing carousel scope
      const container = (transformTrack.parentElement && !['SECTION', 'BODY', 'MAIN', 'HTML'].includes(transformTrack.parentElement.tagName)) ? transformTrack.parentElement : transformTrack;
      if (container !== document.body && container.tagName !== 'SECTION' && container.tagName !== 'MAIN') {
        container.classList.add('swiper-container-initialized', 'is-initialized');
        if (container && container.style) {
          container.style.overflow = 'hidden';
          container.style.maxWidth = '100%';
        }
      }

      const carouselScope = transformTrack.closest(
        '[class*="list-wrap"], [class*="carousel-wrap"], [class*="slider-wrap"], [class*="primary-panel"], [role="tabpanel"], .swiper-container, .basic-swiper, [class*="carousel"], [class*="slider"], [class*="gallery"]'
      ) || container.parentElement || sectionScope;

      // Indicator bars, dots, or bullets scoped to this carousel
      let rawBars = Array.from(carouselScope.querySelectorAll(
        'button[class*="bar"], button[class*="bullet"], button[class*="dot"], [role="button"][class*="bullet"], [class*="swiper-pagination-bullet"], [class*="pagination-bullet"], [class*="slider-dot"], .slick-dots li, .slick-dots button, .owl-dots button, .owl-dot, button[class*="indicator"], [class*="pagination"] button, [class*="controller__bar"], [class*="dotnav-item"], [class*="dotnav-link"], .dotnav li, .dotnav a'
      ));
      if (rawBars.length === 0) {
        let p = transformTrack.parentElement;
        while (p && p !== document.body && rawBars.length === 0) {
          rawBars = Array.from(p.querySelectorAll(
            'button[class*="bar"], button[class*="bullet"], button[class*="dot"], [role="button"][class*="bullet"], [class*="swiper-pagination-bullet"], [class*="pagination-bullet"], [class*="slider-dot"], .slick-dots li, .slick-dots button, .owl-dots button, .owl-dot, button[class*="indicator"], [class*="pagination"] button, [class*="controller__bar"], [class*="dotnav-item"], [class*="dotnav-link"], .dotnav li, .dotnav a'
          ));
          p = p.parentElement;
        }
      }
      let bars = rawBars.filter(function(b) {
        const cls = (typeof b.className === 'string' ? b.className : (b.getAttribute && b.getAttribute('class')) || '').toLowerCase();
        const isNav = (cls.includes('navbar') || cls.includes('nav-link') || cls.includes('nav-menu') || cls.includes('nav-item')) && !cls.includes('dot') && !cls.includes('bullet') && !cls.includes('indicator');
        const isTablist = b.closest('.tab__list, .tab-list, [role="tablist"]');
        const isCarouselDot = cls.includes('dot') || cls.includes('bullet') || cls.includes('indicator') || Boolean(b.closest('[class*="dotnav"], [class*="pagination"], [class*="indicators"]'));
        if (isTablist && !isCarouselDot) return false;
        return !cls.includes('prev') && !cls.includes('next') && !cls.includes('arrow') && !cls.includes('iconcontrol') && !isNav;
      });
      // Deduplicate parent <li> vs child <a> in dotnav
      if (bars.some(function(b) { return b.tagName === 'A' && b.closest('li'); })) {
        bars = bars.filter(function(b) { return b.tagName === 'A'; });
      }

      // Previous and Next buttons scoped to this carousel (matches buttons, divs, role=button, Elementor, Swiper, Slick, Glide)
      const prevSel = 'button[class*="prev" i], [role="button"][class*="prev" i], [class*="swiper-button-prev" i], [class*="elementor-swiper-button-prev" i], [class*="button-prev" i], [class*="button--prev" i], [class*="arrow-prev" i], [class*="prev-button" i], [class*="navigator__button--prev" i], .swiper-button-prev, .slick-prev, .owl-prev, [aria-label*="prev" i], [aria-label*="previous" i], [data-testid*="prev" i], [data-testid*="previous" i], [aria-label*="left" i]';
      const nextSel = 'button[class*="next" i], [role="button"][class*="next" i], [class*="swiper-button-next" i], [class*="elementor-swiper-button-next" i], [class*="button-next" i], [class*="button--next" i], [class*="arrow-next" i], [class*="next-button" i], [class*="navigator__button--next" i], .swiper-button-next, .slick-next, .owl-next, [aria-label*="next" i], [aria-label*="next slide" i], [data-testid*="next" i], [aria-label*="right" i]';

      let prevBtns = Array.from(carouselScope.querySelectorAll(prevSel));
      let nextBtns = Array.from(carouselScope.querySelectorAll(nextSel));

      // Expand to parent widgets/containers if buttons are placed as siblings of carousel track
      if (prevBtns.length === 0 || nextBtns.length === 0) {
        let p = transformTrack.parentElement;
        while (p && p !== document.body && (prevBtns.length === 0 || nextBtns.length === 0)) {
          if (prevBtns.length === 0) prevBtns = Array.from(p.querySelectorAll(prevSel));
          if (nextBtns.length === 0) nextBtns = Array.from(p.querySelectorAll(nextSel));
          p = p.parentElement;
        }
      }
      if (prevBtns.length === 0) prevBtns = Array.from(sectionScope.querySelectorAll(prevSel));
      if (nextBtns.length === 0) nextBtns = Array.from(sectionScope.querySelectorAll(nextSel));

      prevBtns = prevBtns.filter(function(b) {
        const cls = (typeof b.className === 'string' ? b.className : '').toLowerCase();
        if (cls.includes('tab__') || b.closest('.tab__list, .tab-list, [role="tablist"]')) return false;
        if (b.closest('.scroll-gallery, [class*="scroll-gallery"]') && !carouselScope.contains(b)) return false;
        return true;
      });

      nextBtns = nextBtns.filter(function(b) {
        const cls = (typeof b.className === 'string' ? b.className : '').toLowerCase();
        if (cls.includes('tab__') || b.closest('.tab__list, .tab-list, [role="tablist"]')) return false;
        if (b.closest('.scroll-gallery, [class*="scroll-gallery"]') && !carouselScope.contains(b)) return false;
        return true;
      });

      // Ensure buttons are visible, interactive and have pointer cursor
      prevBtns.forEach(function(b) {
        b.style.display = 'inline-flex';
        b.style.visibility = 'visible';
        b.style.cursor = 'pointer';
        b.style.pointerEvents = 'auto';
      });
      nextBtns.forEach(function(b) {
        b.style.display = 'inline-flex';
        b.style.visibility = 'visible';
        b.style.cursor = 'pointer';
        b.style.pointerEvents = 'auto';
      });

      // Progress bar fill elements scoped to this carousel
      const progressFills = Array.from(carouselScope.querySelectorAll(
        '.progressbar-indicator__bar-fill, .swiper-pagination-progressbar-fill, [class*="progressbar__fill"], [class*="progress-bar__fill"], [class*="progress-fill"], [class*="bar-fill"]'
      ));

      // Inject SVG icons if arrows have no visible text, icon, or SVG
      prevBtns.forEach(function(btn) {
        if (!btn.querySelector('svg, img, i') && (btn.innerText || btn.textContent || '').trim() === '') {
          btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><polyline points="15 18 9 12 15 6"></polyline></svg>';
        }
      });
      nextBtns.forEach(function(btn) {
        if (!btn.querySelector('svg, img, i') && (btn.innerText || btn.textContent || '').trim() === '') {
          btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><polyline points="9 18 15 12 9 6"></polyline></svg>';
        }
      });

      let currentIndex = (function() {
        const activeIdx = uniqueSlides.findIndex(function(s) {
          const cls = (typeof s.className === 'string' ? s.className : (s.getAttribute && s.getAttribute('class')) || '').toLowerCase();
          return cls.includes('active') || cls.includes('current') || cls.includes('selected') || cls.includes('swiper-slide-active');
        });
        return activeIdx >= 0 ? activeIdx : 0;
      })();
      let autoplayTimer = null;
      // Discover Play / Pause button scoped to this carousel or section
      const playPauseSel = 'button[class*="iconcontrol"], [class*="iconcontrol"], [class*="play-pause"], [class*="pause-btn"], [class*="play-btn"], button[aria-label*="pause" i], button[aria-label*="play" i], [aria-label*="pause gallery" i], [aria-label*="play gallery" i], .controller__icon-container';
      let playPauseBtn = carouselScope.querySelector(playPauseSel);
      if (!playPauseBtn) {
        let p = transformTrack.parentElement;
        while (p && p !== document.body && !playPauseBtn) {
          playPauseBtn = p.querySelector(playPauseSel);
          p = p.parentElement;
        }
      }
      if (!playPauseBtn) {
        playPauseBtn = sectionScope.querySelector(playPauseSel);
      }

      const hasTimedNav = Boolean(carouselScope.querySelector('[class*="timed"], [class*="progress"], [data-autoplay]') || sectionScope.querySelector('[class*="timed"], [class*="progress"], [data-autoplay]'));
      const hasAutoplay = !!playPauseBtn || hasTimedNav;
      let isPlaying = hasAutoplay;

      const isFullWidthSlider = allSlides.length > 0 && (
        (parseFloat(allSlides[0].style.width || '0') >= ((container.clientWidth || 1200) * 0.80)) ||
        (allSlides[0].offsetWidth >= ((container.clientWidth || 1200) * 0.80))
      );

      function updateSlideDimensions() {
        if (!container) return;
        const cW = container.clientWidth || carouselScope.clientWidth || sectionScope.clientWidth || window.innerWidth;
        if (cW > 0 && isFullWidthSlider) {
          allSlides.forEach(function(s) {
            s.style.width = cW + 'px';
          });
          transformTrack.style.width = (allSlides.length * cW) + 'px';
        }
      }
      updateSlideDimensions();

      function getSlideStep() {
        if (isFullWidthSlider) {
          return container.clientWidth || carouselScope.clientWidth || sectionScope.clientWidth || window.innerWidth || 1200;
        }
        if (uniqueSlides.length > 1 && uniqueSlides[1].offsetLeft > uniqueSlides[0].offsetLeft) {
          const step = uniqueSlides[1].offsetLeft - uniqueSlides[0].offsetLeft;
          if (step > 30) return step;
        }
        if (uniqueSlides.length > 0 && uniqueSlides[0].offsetWidth > 30) {
          return uniqueSlides[0].offsetWidth;
        }
        if (uniqueSlides.length > 0) {
          const bRect = uniqueSlides[0].getBoundingClientRect();
          if (bRect.width > 30) return bRect.width;
          const styleW = parseFloat(uniqueSlides[0].style.width || '') || parseFloat(window.getComputedStyle(uniqueSlides[0]).width || '');
          if (styleW > 30) return styleW;
        }
        const cW = container.clientWidth || carouselScope.clientWidth || sectionScope.clientWidth || 1200;
        return cW / Math.min(Math.max(uniqueSlides.length, 1), 4);
      }

      function getTotalWidth() {
        const step = getSlideStep();
        const last = uniqueSlides[uniqueSlides.length - 1];
        if (last && last.offsetLeft > 0) {
          return last.offsetLeft + (last.offsetWidth || step);
        }
        const scrollW = transformTrack.scrollWidth || 0;
        const countW = uniqueSlides.length * step;
        return Math.max(scrollW, countW);
      }

      function getMaxOffset() {
        const containerWidth = container.clientWidth || carouselScope.clientWidth || sectionScope.clientWidth || window.innerWidth || 1200;
        const totalWidth = getTotalWidth();
        return Math.max(0, totalWidth - containerWidth);
      }

      function getMaxIndex() {
        return Math.max(0, uniqueSlides.length - 1);
      }

      function goToSlide(targetIdx, fromSync) {
        if (uniqueSlides.length === 0) return;
        const maxIdx = getMaxIndex();
        const step = getSlideStep();

        currentIndex = Math.max(0, Math.min(targetIdx, maxIdx));
        const targetSlide = uniqueSlides[currentIndex];

        if (!fromSync && transformTracks.length > 1) {
          sectionScope.dispatchEvent(new CustomEvent('carousel-sync-slide', { detail: { index: currentIndex, source: transformTrack } }));
        }

        const hasExistingTransforms = uniqueSlides.some(function(s) {
          const st = (s.getAttribute && s.getAttribute('style')) || '';
          return st.includes('transform') && st.includes('translate');
        });
        const isAbsoluteSlider = !hasExistingTransforms && uniqueSlides.length > 1 && window.getComputedStyle(uniqueSlides[0]).position === 'absolute';

        if (isAbsoluteSlider) {
          transformTrack.style.overflow = 'visible';
          const total = uniqueSlides.length;
          uniqueSlides.forEach(function(s, idx) {
            let diff = idx - currentIndex;
            if (total > 2) {
              while (diff > total / 2) diff -= total;
              while (diff < -total / 2) diff += total;
            }
            const shift = diff * step;
            s.style.transition = 'transform 600ms cubic-bezier(0.25, 1, 0.5, 1)';
            s.style.transform = 'translate(' + shift + 'px, 0px)';
            s.style.opacity = '1';
            const isActive = idx === currentIndex;
            s.classList.toggle('active', isActive);
            s.classList.toggle('is-active', isActive);
            s.classList.toggle('current', isActive);
            s.classList.toggle('current-item', isActive);
            s.setAttribute('aria-hidden', String(!isActive));
            s.style.setProperty('display', 'block', 'important');
          });
        } else {
          let offset = isFullWidthSlider
            ? (baseIdx + currentIndex) * step
            : ((targetSlide && typeof targetSlide.offsetLeft === 'number' && targetSlide.offsetLeft > 0)
                ? targetSlide.offsetLeft
                : (baseIdx + currentIndex) * step);

          transformTrack.style.transition = 'transform 600ms cubic-bezier(0.25, 1, 0.5, 1)';
          transformTrack.style.transform = 'translate3d(' + (-offset) + 'px, 0px, 0px)';
          if (container && container !== document.body && container.tagName !== 'SECTION' && container.tagName !== 'MAIN' && container.scrollWidth > container.clientWidth) {
            try {
              container.scrollTo({ left: offset, behavior: 'smooth' });
            } catch (_) {}
          }

          // Universal circular wrapping for pre-positioned slides
          if (hasExistingTransforms) {
            uniqueSlides.forEach(function(s, idx) {
              const total = uniqueSlides.length;
              let diff = idx - currentIndex;
              if (total > 2) {
                while (diff > total / 2) diff -= total;
                while (diff < -total / 2) diff += total;
              }
              const currentX = (currentIndex + diff) * step;
              s.style.transition = 'transform 600ms cubic-bezier(0.25, 1, 0.5, 1)';
              s.style.transform = 'translate(' + currentX + 'px, 0px)';
            });
          }

          // Update slides active state
          uniqueSlides.forEach(function(s, idx) {
            const isActive = idx === currentIndex;
            s.classList.toggle('active', isActive);
            s.classList.toggle('is-active', isActive);
            s.classList.toggle('current', isActive);
            s.classList.toggle('current-item', isActive);
          });
        }

        // Update indicator bars / bullets
        bars.forEach(function(b, idx) {
          const isActive = idx === currentIndex;
          b.classList.toggle('controller__bar--current', isActive);
          b.classList.toggle('swiper-pagination-bullet-active', isActive);
          b.classList.toggle('is-active', isActive);
          b.classList.toggle('active', isActive);
          b.classList.toggle('current', isActive);
          if (b.parentElement && b.parentElement.tagName === 'LI') {
            b.parentElement.classList.toggle('current', isActive);
            b.parentElement.classList.toggle('dotnav-focused', isActive);
          }
          b.setAttribute('aria-selected', String(isActive));
          b.setAttribute('tabindex', isActive ? '0' : '-1');
        });

        // Update progress bar fill
        if (progressFills.length > 0) {
          const totalSteps = maxIdx > 0 ? (maxIdx + 1) : uniqueSlides.length;
          const ratio = totalSteps > 1 ? Math.min(1, Math.max(0.1, (currentIndex + 1) / totalSteps)) : 1;
          progressFills.forEach(function(fill) {
            fill.style.transition = 'transform 300ms cubic-bezier(0.25, 1, 0.5, 1), width 300ms ease';
            fill.style.transform = 'translate3d(0px, 0px, 0px) scaleX(' + ratio + ') scaleY(1)';
            fill.style.transformOrigin = 'left center';
            fill.style.width = (ratio * 100) + '%';
          });
        }

        // Update Prev / Next button states
        const isStart = currentIndex <= 0;
        const isEnd = currentIndex >= maxIdx;

        prevBtns.forEach(function(b) {
          b.classList.toggle('swiper-button-disabled', isStart);
          b.classList.toggle('disabled', isStart);
          b.setAttribute('aria-disabled', String(isStart));
        });

        nextBtns.forEach(function(b) {
          b.classList.toggle('swiper-button-disabled', isEnd);
          b.classList.toggle('disabled', isEnd);
          b.setAttribute('aria-disabled', String(isEnd));
        });

        container.classList.toggle('swiper-slide--beginning', isStart);
        container.classList.toggle('swiper-slide--end', isEnd);
      }

      function updatePlayPauseUI(playing) {
        if (!playPauseBtn) return;
        const dotnavTimed = playPauseBtn.closest('.dotnav-timed') || (playPauseBtn.parentElement && playPauseBtn.parentElement.closest('.dotnav-timed')) || sectionScope.querySelector('.dotnav-timed');
        if (dotnavTimed) {
          dotnavTimed.classList.toggle('dotnav-timed-paused', !playing);
        }
        playPauseBtn.classList.toggle('is-paused', !playing);
        playPauseBtn.classList.toggle('is-playing', playing);
        playPauseBtn.setAttribute('aria-label', playing ? 'Pause gallery' : 'Play gallery');
        playPauseBtn.setAttribute('title', playing ? 'Pause' : 'Play');

        const pauseSvg = playPauseBtn.querySelector('[class*="pause"], svg:first-child');
        const playSvg = playPauseBtn.querySelector('[class*="play"], svg:last-child');
        if (pauseSvg && playSvg && pauseSvg !== playSvg) {
          pauseSvg.style.display = playing ? 'block' : 'none';
          playSvg.style.display = playing ? 'none' : 'block';
        }
      }

      function resetAutoplay() {
        if (autoplayTimer) clearInterval(autoplayTimer);
        // In multi-track sections, track 0 acts as the master ticker so all tracks stay in lockstep
        if (trackIdx > 0 && transformTracks.length > 1) return;
        if (isPlaying && uniqueSlides.length > 1) {
          autoplayTimer = setInterval(function() {
            const maxIdx = getMaxIndex();
            const nextIdx = currentIndex >= maxIdx ? 0 : currentIndex + 1;
            goToSlide(nextIdx, false);
          }, 5000);
        }
      }

      // Initialize to current active slide
      goToSlide(currentIndex, false);
      updatePlayPauseUI(isPlaying);
      resetAutoplay();

      // Listen for synchronized slide transitions across multi-track carousels
      sectionScope.addEventListener('carousel-sync-slide', function(e) {
        if (e.detail && typeof e.detail.index === 'number' && e.detail.source !== transformTrack) {
          goToSlide(e.detail.index, true);
        }
      });

      // Listen for section-level play/pause state change
      sectionScope.addEventListener('carousel-play-pause', function(e) {
        isPlaying = e.detail && typeof e.detail.playing === 'boolean' ? e.detail.playing : isPlaying;
        if (isPlaying) {
          resetAutoplay();
        } else {
          if (autoplayTimer) clearInterval(autoplayTimer);
        }
      });

      // Bind Play / Pause button toggle once per button
      if (playPauseBtn && !playPauseBtn.__hasGlobalPlayPauseBound) {
        playPauseBtn.__hasGlobalPlayPauseBound = true;
        playPauseBtn.setAttribute('data-state', isPlaying ? 'playing' : 'paused');
        playPauseBtn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          const currentlyPlaying = playPauseBtn.getAttribute('data-state') === 'playing';
          const nextPlaying = !currentlyPlaying;
          playPauseBtn.setAttribute('data-state', nextPlaying ? 'playing' : 'paused');
          updatePlayPauseUI(nextPlaying);
          sectionScope.dispatchEvent(new CustomEvent('carousel-play-pause', { detail: { playing: nextPlaying } }));
        });
      }

      // Bind bar / indicator clicks
      bars.forEach(function(bar, idx) {
        bar.addEventListener('click', function(e) {
          e.preventDefault();
          goToSlide(idx, false);
          if (isPlaying) resetAutoplay();
        });
      });

      // Bind navigation buttons (loops seamlessly when reaching edges)
      prevBtns.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          const maxIdx = getMaxIndex();
          const target = currentIndex <= 0 ? maxIdx : currentIndex - 1;
          goToSlide(target, false);
          if (isPlaying) resetAutoplay();
        });
      });

      nextBtns.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          const maxIdx = getMaxIndex();
          const target = currentIndex >= maxIdx ? 0 : currentIndex + 1;
          goToSlide(target, false);
          if (isPlaying) resetAutoplay();
        });
      });

      // Only pause on hover if explicitly requested via data attribute
      if (carouselScope.hasAttribute('data-pause-on-hover') || sectionScope.hasAttribute('data-pause-on-hover')) {
        carouselScope.addEventListener('mouseenter', function() {
          if (autoplayTimer) clearInterval(autoplayTimer);
        });
        carouselScope.addEventListener('mouseleave', function() {
          if (isPlaying) resetAutoplay();
        });
      }

      // Recalculate on window resize
      window.addEventListener('resize', function() {
        updateSlideDimensions();
        goToSlide(currentIndex, false);
      }, { passive: true });
    });
  }

  // 2. Tab list horizontal scrolling via left/right arrows
  const tabArrowsPrev = sectionScope.querySelectorAll('.tab__left-arrow, [class*="tab__arrow--prev"], [class*="tab-arrow-prev"]');
  const tabArrowsNext = sectionScope.querySelectorAll('.tab__right-arrow, [class*="tab__arrow--next"], [class*="tab-arrow-next"]');
  const tabListScroll = sectionScope.querySelector('.tab__list, .tab-list, [role="tablist"]');

  if (tabListScroll) {
    tabArrowsPrev.forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        tabListScroll.scrollBy({ left: -220, behavior: 'smooth' });
      });
    });
    tabArrowsNext.forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        tabListScroll.scrollBy({ left: 220, behavior: 'smooth' });
      });
    });
  }

  // Universal Scroll Gallery / Horizontal Carousel Controller (Apple .scroll-gallery, .slide-gallery, overflow-x scroll containers)
  const scrollGalleries = Array.from(sectionScope.querySelectorAll(
    '.scroll-gallery, .slide-gallery, [class*="scroll-gallery"], [class*="slide-gallery"], [data-gallery-id], [class*="scroll-container"], [class*="horizontal-scroll"]'
  ));

  scrollGalleries.forEach(function(gal) {
    const scroller = gal.matches('.scroll-container, [class*="scroll-container"]') ? gal : (gal.querySelector('.scroll-container, [class*="scroll-container"], [style*="overflow-x: scroll"], [style*="overflow-x: auto"]') || gal);
    if (!scroller) return;

    let items = Array.from(scroller.querySelectorAll('.gallery-item, .card-container, [class*="card-container"], [class*="card-item"], [class*="gallery-card"], [data-gallery-item]'));
    if (items.length === 0) {
      items = Array.from(scroller.querySelectorAll('li, [class*="card"]'));
    }

    const scope = gal.closest('section, [class*="gallery"], [class*="section"]') || sectionScope;
    const prevArrows = Array.from(scope.querySelectorAll('.paddlenav-arrow-previous, .paddlenav-arrow-prev, button[class*="paddle"][class*="prev"], button[class*="paddle"][class*="previous"], [class*="paddlenav-arrow"][class*="prev"], button[aria-label*="previous item" i], button[aria-label*="previous slide" i]'));
    const nextArrows = Array.from(scope.querySelectorAll('.paddlenav-arrow-next, button[class*="paddle"][class*="next"], [class*="paddlenav-arrow"][class*="next"], button[aria-label*="next item" i], button[aria-label*="next slide" i]'));

    function getStep() {
      if (items.length > 0 && items[0].offsetWidth > 50) {
        return items[0].offsetWidth + 20;
      }
      return scroller.clientWidth * 0.75 || 400;
    }

    function updatePaddles() {
      const maxScroll = scroller.scrollWidth - scroller.clientWidth - 5;
      const cur = scroller.scrollLeft;
      const atStart = cur <= 5;
      const atEnd = maxScroll > 10 ? (cur >= maxScroll) : false;

      prevArrows.forEach(function(b) {
        b.classList.toggle('disabled', atStart);
        b.setAttribute('aria-disabled', String(atStart));
        if (atStart) b.setAttribute('disabled', '');
        else b.removeAttribute('disabled');
        b.style.pointerEvents = atStart ? 'none' : 'auto';
        b.style.opacity = atStart ? '0.3' : '1';
      });

      nextArrows.forEach(function(b) {
        b.classList.toggle('disabled', atEnd);
        b.setAttribute('aria-disabled', String(atEnd));
        if (atEnd) b.setAttribute('disabled', '');
        else b.removeAttribute('disabled');
        b.style.pointerEvents = atEnd ? 'none' : 'auto';
        b.style.opacity = atEnd ? '0.3' : '1';
      });
    }

    prevArrows.forEach(function(b) {
      b.style.cursor = 'pointer';
      b.style.pointerEvents = 'auto';
      b.removeAttribute('disabled');
      b.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        scroller.scrollBy({ left: -getStep(), behavior: 'smooth' });
        setTimeout(updatePaddles, 400);
      });
    });

    nextArrows.forEach(function(b) {
      b.style.cursor = 'pointer';
      b.style.pointerEvents = 'auto';
      b.removeAttribute('disabled');
      b.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        scroller.scrollBy({ left: getStep(), behavior: 'smooth' });
        setTimeout(updatePaddles, 400);
      });
    });

    scroller.addEventListener('scroll', updatePaddles, { passive: true });
    updatePaddles();
    setTimeout(updatePaddles, 500);
    setTimeout(updatePaddles, 1500);
    window.addEventListener('resize', updatePaddles);
  });
      `.trim());
    }

    // 4. Universal Footer Collapsible Columns / Mobile Sitemaps & Accordions
    if (
      ast.archetype === 'footer' ||
      ast.sourceSelector?.includes('footer') ||
      ast.rawSectionHtml?.includes('footer') ||
      ast.rawSectionHtml?.includes('footer-category') ||
      ast.rawSectionHtml?.includes('footer-column') ||
      ast.rawSectionHtml?.includes('directory-column') ||
      ast.rawSectionHtml?.includes('sitemap')
    ) {
      scripts.push(`
  // Universal Footer Collapsible Columns / Mobile Sitemaps & Accordions
  const footerScope = document.getElementById('${ast.id}') || document.querySelector('footer, [class*="footer"]') || document;

  const rawFooterItems = Array.from(footerScope.querySelectorAll(
    '.footer-category, ' +
    '.footer-column__item, ' +
    '[class*="footer-col__item"], ' +
    '.ac-gf-directory-column-section, ' +
    'div[class*="directory-column-section"], ' +
    '[class*="footer-nav__group"], ' +
    '[class*="footer-block"]'
  ));

  const footerCategoryItems = rawFooterItems.filter(function(el) {
    const tag = (el.tagName || '').toLowerCase();
    const cls = (typeof el.className === 'string' ? el.className : '').toLowerCase();
    if (['ul', 'ol', 'button', 'a', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].indexOf(tag) !== -1) return false;
    if (cls.includes('-title') || cls.includes('-list') || cls.includes('-item') || cls.includes('-link') || cls.includes('-text') || cls.includes('-button') || cls.includes('-icon')) return false;
    return true;
  });

  footerCategoryItems.forEach(function(item) {
    const triggers = Array.from(item.querySelectorAll(
      '.footer-category__anchor, ' +
      'a[class*="category__anchor"], ' +
      'button[class*="category__anchor"], ' +
      'button[class*="directory-column-section-title-button"], ' +
      '[class*="directory-column-section-title-button"], ' +
      '[class*="footer-accordion-btn"], ' +
      '[class*="accordion-toggle"], ' +
      'h2, h3, h4, h5, [class*="title"], [class*="heading"]'
    ));

    const content = item.querySelector(
      '.footer-category__list-wrap, ' +
      '.footer-category__list, ' +
      '[class*="directory-column-section-list"], ' +
      '[class*="category__list"], ' +
      '[class*="footer-col__list"], ' +
      '[class*="content"], ' +
      'ul, ol, nav'
    );

    triggers.forEach(function(t) {
      t.removeAttribute('disabled');
      t.style.pointerEvents = 'auto';
      t.style.cursor = 'pointer';
    });
    if (item.classList.contains('ac-gf-directory-column-section')) {
      item.style.pointerEvents = 'auto';
    }

    if (triggers.length > 0 && content) {
      function toggleAccordion(e) {
        if (e) {
          if (e.preventDefault) e.preventDefault();
          if (e.stopPropagation) e.stopPropagation();
        }

        const isCurrentlyOpen = item.classList.contains('ac-gf-directory-column-expanded') ||
          item.classList.contains('is-open') ||
          item.classList.contains('active') ||
          triggers.some(function(t) { return t.getAttribute('aria-expanded') === 'true'; }) ||
          (content && (content.style.visibility === 'visible' || (content.style.display && content.style.display !== 'none')));

        if (isCurrentlyOpen) {
          item.classList.remove('is-open', 'active', 'is-active', 'expanded', 'ac-gf-directory-column-expanded');
          triggers.forEach(function(t) {
            t.classList.remove('footer-category__anchor--active', 'is-open', 'active', 'is-active');
            t.setAttribute('aria-expanded', 'false');
          });
          content.classList.remove('is-open', 'active', 'is-active', 'open');
          content.style.position = '';
          content.style.visibility = '';
          content.style.zIndex = '';
          content.style.display = '';
          const anim = item.querySelector('[data-footer-animate="collapse"]');
          if (anim && typeof anim.beginElement === 'function') {
            try { anim.beginElement(); } catch (_) {}
          }
        } else {
          item.classList.add('is-open', 'active', 'is-active', 'expanded', 'ac-gf-directory-column-expanded');
          triggers.forEach(function(t) {
            t.classList.add('footer-category__anchor--active', 'is-open', 'active', 'is-active');
            t.setAttribute('aria-expanded', 'true');
          });
          content.classList.add('is-open', 'active', 'is-active', 'open');
          content.style.position = 'static';
          content.style.visibility = 'visible';
          content.style.zIndex = '1';
          content.style.display = 'block';
          const anim = item.querySelector('[data-footer-animate="expand"]');
          if (anim && typeof anim.beginElement === 'function') {
            try { anim.beginElement(); } catch (_) {}
          }
        }
      }

      triggers.forEach(function(t) {
        t.addEventListener('click', toggleAccordion);
      });
    }
  });

  window.addEventListener('resize', function() {
    if (window.innerWidth > 834) {
      footerCategoryItems.forEach(function(item) {
        const content = item.querySelector('.footer-category__list-wrap, .footer-category__list, [class*="directory-column-section-list"], ul, nav');
        if (content) {
          content.style.display = '';
          content.style.position = '';
          content.style.visibility = '';
        }
      });
    }
  });
      `.trim());
    }

    // 5. Universal Interactive Controls: Dropdowns, Popovers, Swatches & Faceted Filtering
    const hasInteractiveFormsOrCards =
      ast.archetype === 'features' ||
      ast.archetype === 'pricing' ||
      ast.archetype === 'generic-section' ||
      ast.archetype === 'navbar' ||
      Boolean(
        ast.rawSectionHtml &&
          (ast.rawSectionHtml.includes('input') ||
            ast.rawSectionHtml.includes('filter') ||
            ast.rawSectionHtml.includes('sort') ||
            ast.rawSectionHtml.includes('dropdown') ||
            ast.rawSectionHtml.includes('option') ||
            ast.rawSectionHtml.includes('aria-haspopup') ||
            ast.rawSectionHtml.includes('aria-expanded') ||
            ast.rawSectionHtml.includes('data-baseweb="menu"') ||
            ast.rawSectionHtml.includes('data-baseweb="popover"') ||
            ast.rawSectionHtml.includes('data-toggle') ||
            ast.rawSectionHtml.includes('role="menu"'))
      );

    if (hasInteractiveFormsOrCards) {
      scripts.push(`
  // Universal Interactive Controls: Dropdowns, Popovers, Swatches & Faceted Filtering
  const scope = document.getElementById('${ast.id}') || document;

  // Helper: Find controlled popover/panel for any toggle trigger
  function findControlledPanel(trigger) {
    if (!trigger) return null;
    const ctrlId = trigger.getAttribute('aria-controls') || trigger.getAttribute('data-target') || trigger.getAttribute('data-bs-target');
    if (ctrlId) {
      const el = document.getElementById(ctrlId.replace(/^#/, ''));
      if (el) return el;
    }
    // Check next element sibling
    const sib = trigger.nextElementSibling;
    if (sib && sib !== trigger && !trigger.contains(sib) && !sib.matches('button, input, select')) {
      if (
        sib.getAttribute('role') === 'menu' ||
        sib.getAttribute('role') === 'listbox' ||
        sib.getAttribute('role') === 'dialog' ||
        sib.getAttribute('data-baseweb') === 'menu' ||
        sib.getAttribute('data-baseweb') === 'popover' ||
        /(?:menu|option|dropdown|popover|content|panel|list)/i.test(sib.className || '') ||
        trigger.hasAttribute('aria-haspopup') ||
        trigger.hasAttribute('aria-expanded')
      ) {
        return sib;
      }
    }
    // Check parent li or nav item container (crucial for BEM mega-menus)
    const parentLi = trigger.closest('li, [role="listitem"], [class*="l0-menu"], [class*="nav-item"], [class*="menu-item"]');
    if (parentLi) {
      const liPanel = parentLi.querySelector('[class*="menu-container"], [class*="l1-menu"], [class*="dropdown"], [class*="megamenu"], [class*="flyout"], [role="menu"], [role="listbox"], ul');
      if (liPanel && liPanel !== trigger && !trigger.contains(liPanel)) return liPanel;
    }
    // Check inside immediate container and traverse up to 4 ancestors
    let searchBox = trigger.parentElement;
    let searchDepth = 0;
    while (searchBox && searchBox !== document.body && searchDepth < 4) {
      const foundPanel = Array.from(searchBox.querySelectorAll(
        '[role="menu"], [role="listbox"], [role="dialog"], [data-baseweb="menu"], [data-baseweb="popover"], [class*="menu-container"], [class*="l1-menu"], [class*="dropdown"], [class*="popover"], [class*="megamenu"], [class*="flyout"], [class*="option-list"], [class*="select-options"], [class*="menu__list"], [class*="list-wrap"]'
      )).find(function(p) { return p !== trigger && !trigger.contains(p); });
      if (foundPanel) return foundPanel;
      searchBox = searchBox.parentElement;
      searchDepth++;
    }

    // Check parent's next sibling or adjacent container
    if (trigger.parentElement) {
      const nextSib = trigger.parentElement.nextElementSibling;
      if (nextSib && (
        nextSib.getAttribute('role') === 'menu' ||
        nextSib.getAttribute('data-baseweb') === 'menu' ||
        nextSib.querySelector('[role="menu"], [data-baseweb="menu"]')
      )) {
        return nextSib.querySelector('[role="menu"], [data-baseweb="menu"]') || nextSib;
      }
    }

    // Detached / Portal Drawer, Modal, or Dialog resolution:
    const trgText = (trigger.innerText || '').toLowerCase().trim();
    const trgLabel = (trigger.getAttribute('aria-label') || trigger.getAttribute('title') || '').toLowerCase();
    const isLangTrigger = ['language', 'locale', 'region', 'country', 'globe'].some(function(k) {
      return trgLabel.includes(k) || trgText.includes(k);
    }) || trgText === 'en' || !!trigger.querySelector('svg, .icon, [class*="globe"]');

    if (isLangTrigger && (trigger.hasAttribute('aria-haspopup') || trigger.hasAttribute('aria-expanded') || trigger.tagName === 'BUTTON')) {
      const langDrawer = (scope || document).querySelector(
        '[data-testid*="drawer"]:has([lang]), [data-testid*="drawer"]:has([class*="language"]), [data-testid*="drawer"]:has(h2), [role="dialog"]:has([lang]), [class*="drawer"]:has([lang]), [data-testid="desktop-content-drawer"]'
      ) || document.querySelector(
        '[data-testid*="drawer"]:has([lang]), [data-testid*="drawer"]:has([class*="language"]), [data-testid*="drawer"]:has(h2), [role="dialog"]:has([lang]), [class*="drawer"]:has([lang]), [data-testid="desktop-content-drawer"]'
      );
      if (langDrawer) return langDrawer;
    }

    if (trigger.hasAttribute('aria-haspopup') || trigger.getAttribute('data-toggle') === 'modal') {
      const genericDrawer = (scope || document).querySelector('[data-testid*="drawer"], [role="dialog"], [data-baseweb="drawer"], [data-baseweb="modal"]') ||
                            document.querySelector('[data-testid*="drawer"], [role="dialog"], [data-baseweb="drawer"], [data-baseweb="modal"]');
      if (genericDrawer && genericDrawer !== trigger && !trigger.contains(genericDrawer)) return genericDrawer;
    }

    // HeadlessUI / Portaled dropdown menu resolution:
    if (trigger.id && (trigger.id.includes('headlessui') || trigger.id.includes('menu-button') || trigger.id.includes('listbox-button'))) {
      const linkedMenu = document.querySelector('[aria-labelledby="' + CSS.escape(trigger.id) + '"], [id*="headlessui-menu-items"], [id*="headlessui-listbox-options"]');
      if (linkedMenu && linkedMenu !== trigger && !trigger.contains(linkedMenu)) return linkedMenu;
      const portalMenu = document.querySelector('#headlessui-portal-root [role="menu"], #headlessui-portal-root [role="listbox"], [data-headlessui-portal] [role="menu"]');
      if (portalMenu && portalMenu !== trigger && !trigger.contains(portalMenu)) return portalMenu;
    }

    // Dynamic fallback synthesizer for unmounted dropdowns:
    // If trigger is a button with aria-haspopup or HeadlessUI button but has no DOM panel yet, synthesize authentic panel options
    if (trigger.hasAttribute('aria-haspopup') || trigger.hasAttribute('aria-expanded') || (trigger.id && trigger.id.includes('headlessui'))) {
      const synthId = 'synth-dropdown-' + (trigger.id ? trigger.id.replace(/[^a-zA-Z0-9_-]/g, '_') : Math.random().toString(36).slice(2, 8));
      let synthPanel = document.getElementById(synthId);
      if (!synthPanel) {
        synthPanel = document.createElement('div');
        synthPanel.id = synthId;
        synthPanel.setAttribute('role', 'menu');
        synthPanel.className = 'synth-dropdown-menu authentic-panel';
        synthPanel.style.cssText = 'display: none; position: absolute; top: calc(100% + 4px); left: 0; min-width: 180px; max-height: 360px; overflow-y: auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); padding: 6px; z-index: 9999; box-sizing: border-box;';

        const txt = (trigger.innerText || '').toLowerCase().trim();
        let options = ['Option 1', 'Option 2', 'Option 3'];
        if (txt === 'en' || isLangTrigger) {
          options = ['English (US)', 'Español', 'Français', 'Deutsch', 'Italiano', '日本語', 'Português'];
        } else if (txt.includes('pixel') || txt.includes('free') || txt.includes('icon')) {
          options = ['All Icons', 'Free Icons', 'Premium Icons', 'Commercial Use'];
        } else if (txt.includes('topic') || txt.includes('all')) {
          options = ['All Topics', 'Actions', 'Animals', 'Business', 'Design', 'Media', 'Tech'];
        } else if (txt.length > 0) {
          options = [trigger.innerText.trim(), 'Popular', 'Featured', 'All Options'];
        }

        options.forEach(function(optText) {
          const item = document.createElement('div');
          item.setAttribute('role', 'menuitem');
          item.className = 'synth-menu-item';
          item.style.cssText = 'padding: 8px 12px; font-size: 13px; font-family: inherit; color: #1e293b; border-radius: 6px; cursor: pointer; transition: background 0.15s; white-space: nowrap;';
          item.textContent = optText;
          item.onmouseenter = function() { item.style.background = '#f1f5f9'; };
          item.onmouseleave = function() { item.style.background = 'transparent'; };
          item.onclick = function(e) {
            e.stopPropagation();
            const labelSpan = trigger.querySelector('span') || trigger;
            if (labelSpan && !trigger.querySelector('svg')) labelSpan.textContent = optText;
            setDropdownVisible(trigger, false);
          };
          synthPanel.appendChild(item);
        });

        const mountTarget = trigger.parentElement || trigger;
        if (window.getComputedStyle(mountTarget).position === 'static') {
          mountTarget.style.setProperty('position', 'relative');
        }
        mountTarget.appendChild(synthPanel);
      }
      return synthPanel;
    }

    return null;
  }

  function setDropdownVisible(trigger, open) {
    if (!trigger) return;
    const panel = findControlledPanel(trigger);
    const parentBox = trigger.parentElement ? trigger.parentElement.closest('[class*="item"], [class*="container"], [class*="wrap"], [role="listitem"], li, div') : null;

    trigger.setAttribute('aria-expanded', String(open));
    trigger.setAttribute('data-state', open ? 'open' : 'closed');
    trigger.classList.toggle('is-open', open);
    trigger.classList.toggle('open', open);
    trigger.classList.toggle('active', open);
    if (parentBox) {
      parentBox.classList.toggle('is-open', open);
      parentBox.classList.toggle('open', open);
      parentBox.classList.toggle('active', open);
      if (window.getComputedStyle(parentBox).position === 'static') {
        parentBox.style.setProperty('position', 'relative');
      }
      Array.from(parentBox.classList).forEach(function(c) {
        if (!c.includes('--')) {
          parentBox.classList.toggle(c + '--open', open);
          parentBox.classList.toggle(c + '--show', open);
          parentBox.classList.toggle(c + '--active', open);
          parentBox.classList.toggle(c + '--open-pc', open);
          parentBox.classList.toggle(c + '--show-pc', open);
        }
      });
      if (parentBox.parentElement) {
        Array.from(parentBox.parentElement.classList).forEach(function(c) {
          if (!c.includes('--')) parentBox.parentElement.classList.toggle(c + '--show', open);
        });
      }
    }
    const navRoot = trigger.parentElement ? trigger.parentElement.closest('header, nav, [role="navigation"], [class*="nav"]:not([class*="nav-filter"]):not([class*="filter"])') : null;
    if (navRoot) {
      navRoot.classList.toggle('is-open', open);
      navRoot.classList.toggle('menu-open', open);
      navRoot.classList.toggle('with-submenu-open', open);
      navRoot.setAttribute('data-nav-open', open ? 'true' : 'false');
      Array.from(navRoot.classList).forEach(function(c) {
        if (!c.includes('--') && (c.includes('nav') || c.includes('gnb') || c.includes('header') || c.includes('menu'))) {
          navRoot.classList.toggle(c + '--opened', open);
          navRoot.classList.toggle(c + '--opended', open);
          navRoot.classList.toggle(c + '--active', open);
          navRoot.classList.toggle(c + '--open', open);
        }
      });
      if (open) {
        navRoot.style.setProperty('--l1-container-current-height', '800px');
      }
    }

    if (panel) {
      const isDrawer = panel.matches('[data-testid*="drawer"], [role="dialog"], [data-baseweb="drawer"], [data-baseweb="modal"], [class*="drawer"], [class*="modal"]') ||
                       !!panel.querySelector('[data-testid*="drawer"], [role="dialog"]');

      if (isDrawer) {
        panel.classList.toggle('is-open', open);
        panel.classList.toggle('open', open);
        if (open) {
          const header = (scope || document).querySelector('header, nav, [role="banner"], [role="navigation"]');
          const headerHeight = header ? Math.round(header.getBoundingClientRect().height) || 64 : 64;

          panel.style.setProperty('display', 'block', 'important');
          panel.style.setProperty('visibility', 'visible', 'important');
          panel.style.setProperty('opacity', '1', 'important');
          panel.style.setProperty('pointer-events', 'auto', 'important');
          panel.style.setProperty('position', 'fixed', 'important');
          panel.style.setProperty('top', headerHeight + 'px');
          panel.style.setProperty('left', '0');
          panel.style.setProperty('width', '100vw');
          panel.style.setProperty('height', 'calc(100vh - ' + headerHeight + 'px)');
          panel.style.setProperty('background', '#ffffff');
          panel.style.setProperty('z-index', '9999');
          panel.style.setProperty('overflow-y', 'auto');
          panel.style.setProperty('box-sizing', 'border-box');

          if (header) {
            header.style.setProperty('z-index', '10001');
            header.style.setProperty('position', 'relative');
          }

          panel.querySelectorAll('.is-open, [class*="css-"], div, section').forEach(function(el) {
            const cs = window.getComputedStyle(el);
            if (cs.display === 'none') el.style.setProperty('display', 'block');
            if (cs.visibility === 'hidden') el.style.setProperty('visibility', 'visible');
          });

          panel.querySelectorAll('button[aria-label*="close" i], button[aria-label="Close"], .close, [class*="close"]').forEach(function(closeBtn) {
            closeBtn.onclick = function(e) {
              e.stopPropagation();
              e.preventDefault();
              setDropdownVisible(trigger, false);
            };
          });

          const escHandler = function(e) {
            if (e.key === 'Escape') {
              setDropdownVisible(trigger, false);
              window.removeEventListener('keydown', escHandler);
            }
          };
          window.addEventListener('keydown', escHandler);
          document.body.style.setProperty('overflow', 'hidden');
        } else {
          panel.style.setProperty('display', 'none', 'important');
          panel.style.setProperty('visibility', 'hidden', 'important');
          document.body.style.removeProperty('overflow');
        }
      }

      // Toggle only the panel element (never climb and hide page ancestors or nav lists)
      const elementsToToggle = [panel].filter(function(el) {
        if (!el || el.contains(trigger)) return false;
        const tag = (el.tagName || '').toLowerCase();
        if (tag === 'ul' || tag === 'ol' || tag === 'nav' || tag === 'header') {
          if (el.id === 'globalnav-list' || (el.className || '').includes('globalnav') || el.querySelector('.globalnav-link, .nav-link')) {
            return false;
          }
        }
        return true;
      });

      elementsToToggle.forEach(function(el) {
        if (open) {
          el.classList.add('is-open', 'open', 'show', 'active');
          el.setAttribute('data-state', 'open');
          el.setAttribute('aria-hidden', 'false');
          if (!isDrawer) {
            el.style.setProperty('display', 'block', 'important');
            el.style.setProperty('visibility', 'visible', 'important');
            el.style.setProperty('opacity', '1', 'important');
            el.style.setProperty('pointer-events', 'auto', 'important');
            el.style.setProperty('max-height', '2000px', 'important');
            el.style.height = 'auto';
          }
          const cs = window.getComputedStyle(el);
          if (cs.position === 'static' && !isDrawer) {
            el.style.setProperty('position', 'absolute');
            el.style.setProperty('top', '100%');
            const triggerRect = trigger.getBoundingClientRect();
            if (triggerRect.right > window.innerWidth * 0.75) {
              el.style.setProperty('right', '0');
              el.style.setProperty('left', 'auto');
            } else {
              el.style.setProperty('left', '0');
              el.style.setProperty('right', 'auto');
            }
            el.style.setProperty('z-index', '1000');
          }
        } else {
          el.classList.remove('is-open', 'open', 'show', 'active');
          el.setAttribute('data-state', 'closed');
          el.setAttribute('aria-hidden', 'true');
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('visibility', 'hidden', 'important');
          el.style.setProperty('opacity', '0', 'important');
          el.style.setProperty('pointer-events', 'none', 'important');
          el.style.setProperty('max-height', '0px', 'important');
        }
      });

      if (open) {
        panel.querySelectorAll('[role="menu"], [role="listbox"], [data-baseweb="menu"], [class*="wrap"], ul').forEach(function(m) {
          m.classList.add('is-open', 'open', 'show', 'active');
          m.style.setProperty('display', 'block', 'important');
          m.style.setProperty('visibility', 'visible', 'important');
          m.style.setProperty('max-height', '2000px', 'important');
          m.style.setProperty('opacity', '1', 'important');
        });
        panel.querySelectorAll('[class*="menu-inner"], [class*="submenu-inner"]').forEach(function(el) {
          el.style.setProperty('visibility', 'visible', 'important');
          el.style.setProperty('opacity', '1', 'important');
          el.style.setProperty('transform', 'translateY(0)', 'important');
          el.style.setProperty('display', 'block', 'important');
        });

        // Unclip any ancestors clipping the dropdown
        let clipAnc = (parentBox || panel).parentElement;
        while (clipAnc && clipAnc !== document.body && clipAnc !== document.documentElement) {
          const cs = window.getComputedStyle(clipAnc);
          if (cs.overflow === 'hidden' || cs.overflowX === 'hidden' || cs.overflowY === 'hidden' || cs.overflow === 'clip') {
            if (!clipAnc.hasAttribute('data-orig-overflow')) {
              clipAnc.setAttribute('data-orig-overflow', clipAnc.style.overflow || '');
            }
            clipAnc.style.setProperty('overflow', 'visible');
            clipAnc.classList.add('has-open-dropdown');
          }
          clipAnc = clipAnc.parentElement;
        }
      } else {
        let clipAnc = (parentBox || panel).parentElement;
        while (clipAnc && clipAnc !== document.body && clipAnc !== document.documentElement) {
          const hasOtherOpen = clipAnc.querySelector('.is-open, [aria-expanded="true"]');
          if (!hasOtherOpen && clipAnc.hasAttribute('data-orig-overflow')) {
            const orig = clipAnc.getAttribute('data-orig-overflow');
            if (orig) {
              clipAnc.style.setProperty('overflow', orig);
            } else {
              clipAnc.style.removeProperty('overflow');
            }
            clipAnc.removeAttribute('data-orig-overflow');
          }
          if (!hasOtherOpen) {
            clipAnc.classList.remove('has-open-dropdown');
          }
          clipAnc = clipAnc.parentElement;
        }
      }
    }
    const icon = trigger.querySelector('svg, .icon, [class*="icon"], [class*="chevron"], [class*="arrow"]');
    if (icon) {
      icon.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
    }
  }

  // 1. Identify all interactive popover/dropdown triggers
  const allDropdownTriggers = Array.from(scope.querySelectorAll(
    'button[aria-expanded], [role="button"][aria-expanded], button[aria-haspopup], [role="button"][aria-haspopup], [data-toggle="dropdown"], [data-bs-toggle="dropdown"], [data-dropdown], button[class*="dropdown-toggle"], [role="button"][class*="dropdown-toggle"], button[class*="opener"], [role="button"][class*="opener"], [id*="menu-button"], [id*="listbox-button"], [class*="nav-filters__item"], [class*="filter-trigger"], [class*="filter__trigger"], [class*="dropdown-trigger"], [class*="dropdown__trigger"], [class*="select-trigger"], [class*="select__trigger"]'
  )).filter(function(b) {
    if (b.hasAttribute('data-has-recorded-interaction')) return false;
    // Skip items inside another dropdown panel (options, subitems, etc.)
    if (b.closest('[class*="dropdown-menu"], [class*="dropdown"], [role="menu"], [role="listbox"], [class*="sublist"]')) return false;
    // Skip nav items managed by the navigation flyout controller
    if (b.hasAttribute('data-flyout-bound') || b.closest('[data-flyout-bound="true"]') || b.closest('[class*="l0-menu"], [class*="nav-item"], .has-dropdown, [class*="has-flyout"], [class*="flyout"], header nav, [role="navigation"]:not([class*="filter"])')) return false;
    const hasPanel = !!findControlledPanel(b);
    if (!hasPanel && !b.matches('button, [role="button"], [aria-expanded], [aria-haspopup]')) return false;
    const cls = (typeof b.className === 'string' ? b.className : (b.getAttribute && b.getAttribute('class')) || '').toLowerCase();
    const lbl = (b.getAttribute('aria-label') || '').toLowerCase();
    const txt = (b.textContent || '').trim().toLowerCase();
    const isMobileNavToggle =
      cls.includes('hamburger') ||
      cls.includes('universal-nav-toggle') ||
      cls.includes('nav-toggle') ||
      cls.includes('mobile-menu') ||
      cls.includes('mobilemenu') ||
      (cls.includes('mobile') && cls.includes('menu')) ||
      cls.includes('menu-toggle') ||
      lbl === 'open menu' ||
      lbl === 'toggle navigation';
    if (isMobileNavToggle) return false;
    if (txt === 'clear all' || txt === 'apply filters' || txt === 'apply sort' || txt === 'close' || txt === 'view more') return false;
    if (cls.includes('clear') || cls.includes('close') || cls.includes('apply') || cls.includes('view-more')) return false;
    return true;
  });

  // Normalize all dropdowns initially to closed
  allDropdownTriggers.forEach(function(b) {
    setDropdownVisible(b, false);
  });

  allDropdownTriggers.forEach(function(btn) {
    let hoverTimer = null;

    // Desktop hover opening & debounced closing (only for non-filter dropdowns; filters use click-only)
    btn.addEventListener('mouseenter', function() {
      if (window.innerWidth > 833 && !btn.matches('[class*="filter"], [class*="select"]')) {
        clearTimeout(hoverTimer);
        allDropdownTriggers.forEach(function(otherBtn) {
          if (otherBtn !== btn) {
            setDropdownVisible(otherBtn, false);
          }
        });
        setDropdownVisible(btn, true);
      }
    });

    btn.addEventListener('mouseleave', function() {
      if (window.innerWidth > 833 && !btn.matches('[class*="filter"], [class*="select"]')) {
        hoverTimer = setTimeout(function() {
          const p = findControlledPanel(btn);
          if (!p || !p.matches(':hover')) {
            setDropdownVisible(btn, false);
          }
        }, 250);
      }
    });

    const panel = findControlledPanel(btn);
    if (panel) {
      panel.addEventListener('mouseenter', function() {
        clearTimeout(hoverTimer);
      });
      panel.addEventListener('mouseleave', function() {
        if (window.innerWidth > 833) {
          hoverTimer = setTimeout(function() {
            setDropdownVisible(btn, false);
          }, 250);
        }
      });
    }

    // Click toggle handler
    btn.addEventListener('click', function(e) {
      clearTimeout(hoverTimer);
      if (btn.tagName === 'A' || btn.getAttribute('href') === '#' || (btn.getAttribute('href') || '').startsWith('javascript:')) {
        e.preventDefault();
      }
      e.stopPropagation();

      const currentlyOpen = btn.getAttribute('aria-expanded') === 'true' || btn.classList.contains('is-open') || btn.classList.contains('open');

      // Mutual exclusion: Close other triggers in the same group/scope
      allDropdownTriggers.forEach(function(otherBtn) {
        if (otherBtn !== btn) {
          setDropdownVisible(otherBtn, false);
        }
      });

      // Toggle this trigger
      setDropdownVisible(btn, !currentlyOpen);
    });
  });

  // Global click-outside to close any open dropdowns
  document.addEventListener('click', function(e) {
    if (e.target && e.target.closest && e.target.closest('button, [role="button"], a, input, select, [role="menu"], [role="listbox"], .synth-dropdown-menu, [class*="dropdown"], [class*="filter"]')) return;
    const clickedInside = allDropdownTriggers.some(function(btn) {
      const panel = findControlledPanel(btn);
      return btn.contains(e.target) || (panel && panel.contains(e.target));
    });
    if (!clickedInside) {
      allDropdownTriggers.forEach(function(btn) {
        setDropdownVisible(btn, false);
      });
    }
  });

  // Universal Filter Subitem Selection (Checkboxes, Category Links, Filter Options)
  const filterSubitems = Array.from(scope.querySelectorAll(
    '[class*="subitem"], [class*="filter-item"], [class*="sublist"] li, [class*="nav-filters__subitem"], [role="menuitemcheckbox"], [role="option"]'
  )).filter(function(item) {
    if (item.matches('button, [class*="nav-filters__item"], [class*="trigger"], [class*="opener"], [class*="toggle"], [aria-haspopup], [aria-expanded]') || item.closest('button, [class*="trigger"], [class*="opener"], [class*="toggle"]')) return false;
    if (allDropdownTriggers.includes(item)) return false;
    // Must be inside a dropdown panel, popover, sublist, or listbox/menu
    return !!item.closest('[class*="dropdown"], [class*="popover"], [class*="sublist"], [role="menu"], [role="listbox"]');
  });

  filterSubitems.forEach(function(item) {
    item.addEventListener('click', function(e) {
      const link = item.tagName === 'A' ? item : item.querySelector('a');
      if (!link || !link.getAttribute('href') || link.getAttribute('href') === '#' || link.getAttribute('href').startsWith('javascript:')) {
        e.preventDefault();
      }
      e.stopPropagation();

      const isMulti = item.closest('[role="group"], [class*="multiselect"], [data-multiselect]');
      if (!isMulti && item.parentElement) {
        Array.from(item.parentElement.children).forEach(function(sib) {
          if (sib !== item) sib.classList.remove('is-active', 'active', 'selected');
        });
      }
      item.classList.toggle('is-active');
      item.classList.toggle('active');
      item.classList.toggle('selected');
    });
  });

  // 2. Universal Option Swatches (Color Chips, Size Buttons, Radio Selectors)
  const optionGroups = Array.from(scope.querySelectorAll(
    '[role="radiogroup"], [class*="swatch"], [class*="option-selector"], [class*="color-list"], [class*="size-list"]'
  )).filter(function(g) {
    return !g.closest('.colornav, [class*="colornav"], [class*="fade-gallery"]');
  });
  optionGroups.forEach(function(group) {
    const options = Array.from(group.querySelectorAll(
      'button, input[type="radio"], [role="radio"], [class*="chip"], [class*="swatch"], [class*="size"], [class*="color"]'
    ));
    options.forEach(function(opt) {
      opt.addEventListener('click', function() {
        const optionTrack = opt.closest('[class*="swiper-wrapper"], [class*="wrap"], [role="radiogroup"], ul, [class*="list"]') || group;
        const trackOptions = Array.from(optionTrack.querySelectorAll('button, input[type="radio"], [role="radio"], [class*="chip"], [class*="swatch"], [class*="size"], [class*="color"]'));

        trackOptions.forEach(function(o) {
          o.classList.remove('selected', 'active', 'is-active');
          o.removeAttribute('aria-checked');
          if (o.tagName === 'INPUT') o.checked = false;
          const slide = o.closest('[class*="slide"], li, [role="listitem"]');
          if (slide) slide.classList.remove('is-checked', 'selected', 'active');
          const blind = o.querySelector('.blind, [class*="sr-only"], [class*="visually-hidden"]');
          if (blind && blind.textContent.includes('selected')) blind.remove();
        });

        opt.classList.add('selected', 'active', 'is-active');
        opt.setAttribute('aria-checked', 'true');
        if (opt.tagName === 'INPUT') opt.checked = true;
        const activeSlide = opt.closest('[class*="slide"], li, [role="listitem"]');
        if (activeSlide) activeSlide.classList.add('is-checked');
        const hasBlind = opt.querySelector('.blind, [class*="sr-only"], [class*="visually-hidden"]');
        if (!hasBlind) {
          const b = document.createElement('span');
          b.className = 'blind';
          b.textContent = 'selected';
          opt.appendChild(b);
        }

        const container = opt.closest('[class*="card"], [class*="item"], article') || group.parentElement;
        if (container) {
          const label = container.querySelector('[class*="selected"], [class*="current-value"], [aria-live]');
          const text = (opt.getAttribute('title') || opt.getAttribute('aria-label') || opt.textContent || '').replace(/selected/gi, '').trim();
          if (label && text) {
            label.textContent = text;
          }
        }
      });
    });
  });

  // Universal Filter Pills & Segmented Tabs Interactivity
  const filterPills = Array.from(scope.querySelectorAll(
    '[role="tab"], [class*="filter"] button, a[class*="rounded-full"], button[class*="rounded-full"], [class*="filter-btn"], button[class*="tab"], li[class*="tab"], a.whitespace-nowrap, button.whitespace-nowrap'
  ));
  if (filterPills.length >= 2) {
    const pillGroups = new Map();
    filterPills.forEach(function(p) {
      const parent = p.closest('ul, ol, nav, [role="tablist"], div') || scope;
      if (!pillGroups.has(parent)) pillGroups.set(parent, []);
      pillGroups.get(parent).push(p);
    });
    pillGroups.forEach(function(pills) {
      if (pills.length >= 2) {
        pills.forEach(function(pill) {
          pill.addEventListener('click', function(e) {
            if (pill.tagName.toLowerCase() === 'a') e.preventDefault();
            pills.forEach(function(other) {
              other.classList.remove('active', 'is-active', 'selected');
              other.setAttribute('aria-selected', 'false');
            });
            pill.classList.add('active', 'is-active', 'selected');
            pill.setAttribute('aria-selected', 'true');
          });
        });
      }
    });
  }

  // 3. Universal Dynamic Filtering & Item Counter Engine
  const filterInputs = Array.from(scope.querySelectorAll(
    'input[type="checkbox"]'
  )).filter(function(inp) {
    const name = (inp.name || '').toLowerCase();
    const id = (inp.id || '').toLowerCase();
    const cls = (typeof inp.className === 'string' ? inp.className : (inp.getAttribute && inp.getAttribute('class')) || '').toLowerCase();
    if (inp.closest('article, [class*="product-card"], [class*="card"]')) return false;
    return !name.includes('search') && !id.includes('search') && !cls.includes('compare');
  });

  const cardCandidates = Array.from(scope.querySelectorAll(
    'article, [role="listitem"], [class*="product-card"], [class*="product-item"], [class*="catalog-item"], [class*="grid-item"], [class*="result-card"], [class*="card"]'
  )).filter(function(el) {
    const tag = el.tagName.toLowerCase();
    if (tag !== 'div' && tag !== 'article' && tag !== 'li' && tag !== 'section') return false;
    const cls = (typeof el.className === 'string' ? el.className : (el.getAttribute && el.getAttribute('class')) || '').toLowerCase();
    if (el.closest('header, nav, [role="navigation"], [class*="filter"], [class*="sidebar"], [class*="menu"], [class*="drawer"]')) return false;
    if (/(?:__name|__title|__badge|__rating|__image|__img|__pic|__option|__chip|__price|__cost|__cta|__btn|__button|__icon|__link|__thumb|__desc|__text|__review|__fiche|__compare)/i.test(cls)) return false;
    if (/(?:-wrap|-wrapper|-container|-list|-track|-body|-head|-row)$/i.test(cls) || cls.includes('content-wrap')) return false;
    return true;
  });

  let filterableItems = cardCandidates.filter(function(item) {
    return !cardCandidates.some(function(parent) {
      return parent !== item && parent.contains(item);
    });
  });

  const resultCounters = Array.from(scope.querySelectorAll(
    '[class*="result-count"], [class*="results-count"], [class*="total-count"], [class*="item-count"], [class*="products-count"], [class*="result"]'
  )).filter(function(c) {
    return !c.matches('button, input, a, [class*="title"], [class*="cart"], [class*="wishlist"]');
  });

  const filterCountBadges = Array.from(scope.querySelectorAll(
    '[class*="title-count"], [class*="filter-count"], [class*="filters-count"]'
  )).filter(function(c) {
    return !c.matches('button, input, a');
  });

  const clearButtons = Array.from(scope.querySelectorAll(
    'button[type="reset"], button[class*="clear"], button[id*="clear"], a[class*="clear"], a[id*="clear"], [role="button"][class*="clear"]'
  )).filter(function(btn) {
    const txt = (btn.textContent || '').trim().toLowerCase();
    const id = (btn.id || '').toLowerCase();
    const cls = (typeof btn.className === 'string' ? btn.className : (btn.getAttribute && btn.getAttribute('class')) || '').toLowerCase();
    return id.includes('clear') || cls.includes('clear') || txt.includes('clear') || txt.includes('reset');
  });

  const activeChipsContainer = scope.querySelector('[class*="selected-list"], [class*="active-filters"], [class*="filter-tags"]');
  const noResultEl = scope.querySelector('[class*="no-result"], [class*="empty-state"]');

  function getInputLabel(inp) {
    const id = inp.id;
    const labelEl = id ? scope.querySelector('label[for="' + CSS.escape(id) + '"]') : null;
    const parentLabel = inp.closest('label');
    return (
      inp.getAttribute('data-local-name') ||
      inp.getAttribute('data-reg-name') ||
      (labelEl ? labelEl.textContent : '') ||
      (parentLabel ? parentLabel.textContent : '') ||
      (inp.parentElement ? inp.parentElement.textContent : '') ||
      (inp.value !== 'on' ? inp.value : '')
    ).trim();
  }

  function cardMatchesOption(haystack, labelText, allCardsHaystacks) {
    const raw = labelText.trim().toLowerCase();
    if (!raw) return true;

    const tokens = raw.split(/[^a-z0-9]+/i).filter(function(t) { return t.length > 0; });
    if (tokens.length === 0) return true;

    const numericTokens = tokens.filter(function(t) { return /^\\d+$/.test(t); });
    if (numericTokens.length > 0) {
      return numericTokens.every(function(num) {
        const numRegex = new RegExp('(?:[^0-9]|^)' + num + '(?:[^0-9]|$)', 'i');
        return numRegex.test(haystack);
      });
    }

    const stopwords = new Set(['and', 'or', 'the', 'in', 'of', 'for', 'with', 'on', 'at', 'to', 'a', 'an']);
    const significantTokens = tokens.filter(function(t) { return !stopwords.has(t) && t.length > 1; });

    if (significantTokens.length === 0) return true;

    const directMatch = significantTokens.every(function(t) { return haystack.includes(t); });
    if (directMatch) return true;

    const tokenExistsInAny = allCardsHaystacks.some(function(h) {
      return significantTokens.every(function(t) { return h.includes(t); });
    });
    return !tokenExistsInAny;
  }

    // 4. Universal Catalog "View More" / "Load More" Pagination Controller
    const catalogViewMoreBtn = Array.from(scope.querySelectorAll(
      'button, a, [role="button"]'
    )).find(function(b) {
      const cls = (typeof b.className === 'string' ? b.className : (b.getAttribute && b.getAttribute('class')) || '').toLowerCase();
      const txt = (b.textContent || '').trim().toLowerCase();
      const lbl = (b.getAttribute('aria-label') || '').toLowerCase();
      if (b.closest('header, nav, [role="navigation"], [class*="filter"], [class*="facet"], [class*="sidebar"], [class*="drawer"]')) return false;
      if (cls.includes('selector-view-more') || cls.includes('selected-view-more')) return false;
      if (cls.includes('view-more') || cls.includes('load-more') || cls.includes('show-more') || txt.includes('view more') || txt.includes('load more') || txt.includes('show more') || lbl.includes('view more') || lbl.includes('load more')) {
        return true;
      }
      return false;
    });

    const initialCountAttr = (typeof scope.getAttribute === 'function' ? scope.getAttribute('data-initial-cards-count') : null) || (typeof scope.closest === 'function' && scope.closest('[data-initial-cards-count]') ? scope.closest('[data-initial-cards-count]').getAttribute('data-initial-cards-count') : null);
    const initialBatchTagged = filterableItems.filter(function(item) {
      return item.getAttribute('data-initial-batch') === 'true';
    });

    let initialBatchSize = filterableItems.length;
    if (initialCountAttr && parseInt(initialCountAttr, 10) > 0) {
      initialBatchSize = parseInt(initialCountAttr, 10);
    } else if (initialBatchTagged.length > 0) {
      initialBatchSize = initialBatchTagged.length;
    } else if (catalogViewMoreBtn && filterableItems.length > 12) {
      initialBatchSize = 12;
    }

    let currentVisibleLimit = initialBatchSize;

    function updateCardVisibilityAndPagination(matchingList) {
      const activeMatches = matchingList !== undefined ? matchingList : filterableItems;
      const matchSet = new Set(activeMatches);
      let shownCount = 0;
      let newlyRevealedCard = null;

      filterableItems.forEach(function(item) {
        if (matchSet.has(item)) {
          if (shownCount < currentVisibleLimit) {
            if (item.style.display === 'none') {
              if (!newlyRevealedCard) newlyRevealedCard = item;
            }
            item.style.display = '';
            item.style.setProperty('visibility', 'visible');
            item.style.setProperty('opacity', '1');
            item.style.setProperty('transform', 'none');
            Array.from(item.classList).forEach(function(c) {
              if (!c.includes('--')) {
                item.classList.add(c + '--active');
                item.classList.add(c + '--visible');
              }
            });
            item.classList.add('is-active', 'active');

            // Hydrate lazy-load images inside newly shown card
            item.querySelectorAll('img[data-src], img[data-desktop-src], img[data-lazy-src], img[data-original]').forEach(function(img) {
              if (!img.src || img.src.startsWith('data:') || img.src === window.location.href) {
                const actualSrc = img.getAttribute('data-src') || img.getAttribute('data-desktop-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-original');
                if (actualSrc) {
                  img.src = actualSrc.startsWith('//') ? ('https:' + actualSrc) : actualSrc;
                }
              }
              const actualSrcset = img.getAttribute('data-srcset');
              if (actualSrcset && !img.srcset) {
                img.srcset = actualSrcset;
              }
            });

            shownCount++;
          } else {
            item.style.display = 'none';
          }
        } else {
          item.style.display = 'none';
        }
      });

      if (catalogViewMoreBtn) {
        const moreAvailable = activeMatches.length > currentVisibleLimit;
        const wrap = catalogViewMoreBtn.closest('[class*="view-more-wrap"], [class*="load-more-wrap"]') || catalogViewMoreBtn;
        wrap.style.display = moreAvailable ? '' : 'none';
      }

      return newlyRevealedCard;
    }

    // Initialize pagination on catalog load
    if (catalogViewMoreBtn && filterableItems.length > initialBatchSize) {
      updateCardVisibilityAndPagination(filterableItems);
    }

    if (catalogViewMoreBtn) {
      catalogViewMoreBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const checkedInputs = filterInputs.filter(function(i) { return i.checked; });
        const matchingItems = getMatchingCards(checkedInputs);
        currentVisibleLimit += initialBatchSize;
        const firstNewCard = updateCardVisibilityAndPagination(matchingItems);
        if (firstNewCard) {
          firstNewCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    }

    // 5. Category Internal "View More" / "Show More" Options Toggle
    const categoryViewMoreBtns = Array.from(scope.querySelectorAll(
      '[class*="selector-view-more"], [class*="filter"] [class*="view-more"], [class*="facet"] [class*="view-more"], [class*="show-more"]'
    )).filter(function(btn) {
      return btn !== catalogViewMoreBtn && !btn.closest('article, [class*="product-card"], [class*="card"]');
    });

    categoryViewMoreBtns.forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const categoryScope = btn.closest('[class*="selector-item"], [class*="filter-item"], [class*="group"], fieldset') || btn.parentElement;
        if (!categoryScope) return;

        const isExpanded = btn.getAttribute('data-rep-expanded') === 'true';
        btn.setAttribute('data-rep-expanded', String(!isExpanded));

        const hiddenOptions = Array.from(categoryScope.querySelectorAll(
          '[style*="display: none"], [style*="display:none"], [class*="hidden"], [class*="more-option"], [aria-hidden="true"], [data-rep-hidden-opt]'
        ));

        hiddenOptions.forEach(function(opt) {
          if (!isExpanded) {
            opt.setAttribute('data-rep-hidden-opt', '1');
            opt.style.display = '';
            opt.removeAttribute('aria-hidden');
            opt.classList.remove('is-hidden', 'hidden');
          } else {
            opt.style.setProperty('display', 'none');
          }
        });

        const txtSpan = btn.querySelector('span') || btn;
        const currentTxt = (txtSpan.textContent || '').trim().toLowerCase();
        if (currentTxt.includes('more')) {
          txtSpan.textContent = txtSpan.textContent.replace(/more/i, 'less');
        } else if (currentTxt.includes('less')) {
          txtSpan.textContent = txtSpan.textContent.replace(/less/i, 'more');
        }
      });
    });

    function getMatchingCards(checkedInputs) {
      if (!checkedInputs || checkedInputs.length === 0) return filterableItems;

      const facetGroups = new Map();
      checkedInputs.forEach(function(inp) {
        const groupKey = (inp.closest('fieldset, [class*="selector-item"], [class*="group"], [class*="filter-section"]') || inp).className || inp.name || 'default';
        if (!facetGroups.has(groupKey)) facetGroups.set(groupKey, []);
        facetGroups.get(groupKey).push(inp);
      });

      const allCardsHaystacks = filterableItems.map(function(item) {
        const itemText = (item.textContent || '').toLowerCase();
        const itemHtml = (item.innerHTML || '').toLowerCase();
        return itemText + ' ' + itemHtml;
      });

      return filterableItems.filter(function(item, idx) {
        const haystack = allCardsHaystacks[idx];
        let matchesAllGroups = true;
        facetGroups.forEach(function(inputsInGroup) {
          const matchesGroup = inputsInGroup.some(function(inp) {
            const rawLabel = getInputLabel(inp);
            return cardMatchesOption(haystack, rawLabel, allCardsHaystacks);
          });
          if (!matchesGroup) matchesAllGroups = false;
        });
        return matchesAllGroups;
      });
    }

    function applyUniversalFilters(resetPagination) {
      if (resetPagination !== false) {
        currentVisibleLimit = initialBatchSize;
      }
      const checkedInputs = filterInputs.filter(function(i) { return i.checked; });

      clearButtons.forEach(function(btn) {
        const show = checkedInputs.length > 0;
        btn.style.display = show ? 'inline-flex' : 'none';
        const clearWrap = btn.closest('[class*="clear-wrap"], [class*="clear_wrap"]');
        if (clearWrap) {
          clearWrap.style.display = show ? '' : 'none';
        }
      });

      if (activeChipsContainer) {
        activeChipsContainer.style.display = checkedInputs.length > 0 ? 'flex' : 'none';
      }

      const matchingItems = getMatchingCards(checkedInputs);
      updateCardVisibilityAndPagination(matchingItems);

      filterCountBadges.forEach(function(b) {
        b.textContent = checkedInputs.length > 0 ? String(checkedInputs.length) : '';
      });
      resultCounters.forEach(function(c) {
        const innerCount = c.querySelector('[class*="count"]');
        if (innerCount) {
          innerCount.textContent = String(matchingItems.length);
        } else if (/\\d+/.test(c.textContent || '')) {
          c.textContent = (c.textContent || '').replace(/\\d+/, String(matchingItems.length));
        } else {
          c.textContent = String(matchingItems.length);
        }
      });

      if (noResultEl) {
        noResultEl.style.display = matchingItems.length === 0 ? 'block' : 'none';
      }

      if (activeChipsContainer) {
        Array.from(activeChipsContainer.querySelectorAll('.rep-dynamic-chip, [data-universal-chip]')).forEach(function(c) { c.remove(); });
        
        const chipSpec = ${JSON.stringify(ast.interactive?.filterChipSpec || null)};
        let itemWrapClass = chipSpec && chipSpec.itemWrapClass;
        let itemClass = chipSpec && chipSpec.itemClass;
        if (!itemWrapClass) {
          const baseClass = (activeChipsContainer.className || '').split(/\\s+/)[0];
          if (baseClass.includes('selected-list')) {
            itemWrapClass = baseClass.replace('selected-list', 'selected-item-wrap');
            itemClass = baseClass.replace('selected-list', 'selected-item');
          } else if (baseClass.includes('active-filters')) {
            itemWrapClass = baseClass.replace('active-filters', 'active-filter-wrap');
            itemClass = baseClass.replace('active-filters', 'active-filter-item');
          } else {
            itemWrapClass = 'rep-dynamic-chip-wrap';
            itemClass = 'rep-dynamic-chip';
          }
        }

        checkedInputs.forEach(function(inp) {
          const chipLabel = getInputLabel(inp) || 'Filter';
          const wrap = document.createElement('div');
          wrap.className = itemWrapClass;
          wrap.setAttribute('role', 'listitem');
          wrap.setAttribute('data-universal-chip', 'true');

          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = itemClass;
          btn.setAttribute('aria-label', chipLabel + '. Deselect filter');
          btn.innerHTML = '<span>' + chipLabel + '</span><svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:middle;margin-left:6px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

          btn.addEventListener('click', function(e) {
            e.preventDefault();
            inp.checked = false;
            inp.dispatchEvent(new Event('change', { bubbles: true }));
            applyUniversalFilters();
          });

          wrap.appendChild(btn);
          const viewMoreWrap = activeChipsContainer.querySelector('[class*="view-more"]');
          if (viewMoreWrap) {
            activeChipsContainer.insertBefore(wrap, viewMoreWrap);
          } else {
            activeChipsContainer.appendChild(wrap);
          }
        });
      }

      checkedInputs.forEach(function(inp) {
        const raw = getInputLabel(inp).trim();
        const numMatch = raw.match(/\\b\\d+\\b/);
        if (numMatch) {
          const num = numMatch[0];
          const cardButtons = Array.from(scope.querySelectorAll('article button, [class*="product-card"] button, [class*="card"] button'));
          const targetBtn = cardButtons.find(function(b) {
            const txt = (b.textContent || '').replace(/selected/gi, '').trim();
            return txt === num || txt.startsWith(num + ' ') || b.getAttribute('data-value') === num || b.getAttribute('value') === num || (b.getAttribute('an-la') && b.getAttribute('an-la').includes(':' + num));
          });
          if (targetBtn) {
            try { targetBtn.click(); } catch(e) {}
          }
        }
      });
    }

    filterInputs.forEach(function(inp) {
      inp.addEventListener('change', function() { applyUniversalFilters(true); });
      const assocLabel = (inp.id ? (scope.querySelector('label[for="' + CSS.escape(inp.id) + '"]') || document.querySelector('label[for="' + CSS.escape(inp.id) + '"]')) : null) || inp.closest('label');
      if (assocLabel) {
        assocLabel.addEventListener('click', function() {
          setTimeout(function() { applyUniversalFilters(true); }, 15);
        });
      }
    });

    clearButtons.forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        filterInputs.forEach(function(i) {
          if (i.checked) {
            i.checked = false;
            i.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
        applyUniversalFilters(true);
      });
    });
      `.trim());
    }

    // 6. Video Auto-Play Resilience
    scripts.push(`
  // Video Auto-Play & Playsinline Handler
  document.querySelectorAll('#${ast.id} video, video').forEach((vid) => {
    if (vid.hasAttribute('autoplay')) {
      vid.muted = true;
      vid.play().catch(() => {});
    }
  });
    `.trim());

    // 7. Universal Scroll Reveal, Scramble Text & SVG Path Animation Controller
    scripts.push(`
  // Universal Scroll Reveal, Scramble Text & SVG Path Animation Controller
  (function() {
    const root = document.querySelector('#${ast.id}') || document;

    // A. Universal Scramble Text / Typewriter Animation
    const scrambleElements = Array.from(root.querySelectorAll('[data-original-text], [data-text], [data-scramble], [data-typer], .scramble-text, [class*="scramble"]'));
    const glyphs = '!<>-_\\\\/[]{}—=+*^?#________';

    function runScramble(target, text, duration) {
      if (!text) return;
      duration = duration || 1000;
      const len = text.length;
      const startTime = performance.now();

      function update(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const resolvedCount = Math.floor(progress * len);

        let output = '';
        for (let i = 0; i < len; i++) {
          if (text[i] === ' ') {
            output += ' ';
          } else if (i < resolvedCount) {
            output += text[i];
          } else {
            output += glyphs[Math.floor(Math.random() * glyphs.length)];
          }
        }
        target.textContent = output;

        if (progress < 1) {
          target._scrambleAnimId = requestAnimationFrame(update);
        } else {
          target.textContent = text;
        }
      }
      if (target._scrambleAnimId) {
        cancelAnimationFrame(target._scrambleAnimId);
      }
      target._scrambleAnimId = requestAnimationFrame(update);
    }

    scrambleElements.forEach(function(el) {
      const targetSpan = el.classList.contains('scramble-text') || (el.className && el.className.includes && el.className.includes('scramble'))
        ? el
        : (el.querySelector('.scramble-text, [class*="scramble"], span') || el);

      const originalText = el.getAttribute('data-original-text') ||
                           el.getAttribute('data-text') ||
                           el.getAttribute('data-scramble') ||
                           el.getAttribute('data-typer') ||
                           targetSpan.textContent.trim();

      if (!originalText) return;

      const interactiveContainer = el.closest('button, a, [class*="overlay"], [class*="badge"], [class*="card"], li') || el;
      if (!interactiveContainer.hasAttribute('data-scramble-bound')) {
        interactiveContainer.setAttribute('data-scramble-bound', 'true');
        interactiveContainer.addEventListener('mouseenter', function() {
          runScramble(targetSpan, originalText, 800);
          const associatedSvg = el.querySelector('svg.pointer-svg path, [class*="pointer"] path');
          if (associatedSvg) {
            drawPath(associatedSvg, 800);
          }
        });
      }
    });

    // B. Universal SVG Path Drawing Animation
    function drawPath(path, duration) {
      duration = duration || 1200;
      let totalLength = 0;
      try {
        totalLength = path.getTotalLength();
      } catch (e) {
        const dashArr = (path.getAttribute('style') || '').match(/stroke-dasharray:\\s*([\\d\\.]+)/);
        totalLength = dashArr ? parseFloat(dashArr[1]) : 250;
      }
      if (!totalLength || isNaN(totalLength)) return;

      path.style.setProperty('stroke-dasharray', totalLength);
      path.style.setProperty('stroke-dashoffset', totalLength);
      path.style.transition = 'none';
      path.getBoundingClientRect();

      path.style.transition = 'stroke-dashoffset ' + (duration / 1000) + 's cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.4s ease';
      path.style.setProperty('stroke-dashoffset', '0');
      path.style.setProperty('opacity', '1');
    }

    const pointerPaths = Array.from(root.querySelectorAll('svg.pointer-svg path, [class*="pointerSvg"] path, [class*="pointer-svg"] path, svg[class*="pointer"] path'));

    // C. Scroll-Triggered Reveal via IntersectionObserver
    let hasAnimated = false;
    const maskVisual = root.querySelector('img[src*="mask"], [class*="maskedImage"], [class*="floating-hero"], [class*="floating-specs"], [class*="glasses"], [class*="specs"]');

    const candidateHeroes = Array.from(root.querySelectorAll('img, [class*="hero-figure"] img, [class*="character"] img')).filter(function(el) {
      if (el === maskVisual) return false;
      const src = (el.src || el.getAttribute('src') || '').toLowerCase();
      const cls = (el.className || '').toString().toLowerCase();
      if (src.includes('mask') || cls.includes('mask') || cls.includes('shadow')) return false;
      return cls.includes('agentmain') || cls.includes('agent-main') || cls.includes('hero-main') || cls.includes('character') ||
             cls.includes('hero-figure') || src.includes('agent-new') || src.includes('character') || src.includes('person') ||
             (src.includes('agent') && !cls.includes('mobile'));
    });
    const targetHero = candidateHeroes.find(function(el) {
      return (el.className || '').toLowerCase().includes('main');
    }) || candidateHeroes[0] || null;

    function triggerEnterAnimations() {
      if (hasAnimated) return;
      hasAnimated = true;

      scrambleElements.forEach(function(el) {
        const targetSpan = el.classList.contains('scramble-text') || (el.className && el.className.includes && el.className.includes('scramble'))
          ? el
          : (el.querySelector('.scramble-text, [class*="scramble"], span') || el);

        const originalText = el.getAttribute('data-original-text') ||
                             el.getAttribute('data-text') ||
                             el.getAttribute('data-scramble') ||
                             el.getAttribute('data-typer') ||
                             targetSpan.textContent.trim();

        if (originalText) {
          runScramble(targetSpan, originalText, 1200);
        }
      });

      pointerPaths.forEach(function(path) {
        drawPath(path, 1400);
      });

      if (!maskVisual || !targetHero) {
        const heroVisuals = Array.from(root.querySelectorAll('[class*="agentMain"], [class*="agent-main"], [class*="hero-visual"]'));
        heroVisuals.forEach(function(visual) {
          visual.style.transition = 'opacity 1s ease-out, transform 1s ease-out';
          visual.style.opacity = '1';
        });
      }
    }

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            triggerEnterAnimations();
          }
        });
      }, { threshold: 0.15 });

      const obsTarget = (root && root.nodeType === 1) ? root : (document.body || document.documentElement);
      if (obsTarget) observer.observe(obsTarget);

      // Universal Scroll-Reveal and Animation Observer for individual animated elements
      const animCandidates = Array.from(root.querySelectorAll(
        '[data-aos], [data-scroll], [data-inview], [class*="animate-"], [class*="reveal"], [class*="fade-in"], [class*="slide-in"], [class*="zoom-in"], [data-motion], [class*="scroll-reveal"], [class*="staggered-"], [data-component-list*="StaggeredFadeIn"], [data-staggered-item]'
      ));
      if (animCandidates.length > 0) {
        const animObserver = new IntersectionObserver(function(entries) {
          entries.forEach(function(entry) {
            if (entry.isIntersecting) {
              const el = entry.target;
              el.classList.add('aos-animate', 'in-view', 'is-revealed', 'is-visible', 'active', 'staggered-end');
              el.classList.remove('staggered-start');
              if (el.hasAttribute('data-staggered-item') || el.querySelectorAll('[data-staggered-item]').length > 0) {
                el.style.setProperty('opacity', '1');
                el.style.setProperty('visibility', 'visible');
                el.querySelectorAll('[data-staggered-item]').forEach(function(item) {
                  item.style.setProperty('opacity', '1');
                  item.style.setProperty('visibility', 'visible');
                  item.style.setProperty('transform', 'none');
                });
              }
              if (el.style.opacity === '0' || el.classList.contains('animate-word') || (el.className && typeof el.className === 'string' && el.className.includes('animate-word'))) {
                el.style.setProperty('opacity', '1');
                el.style.setProperty('transform', 'translateY(0px)');
                const heading = el.closest('h1, h2, h3, [class*="heading"]');
                if (heading) heading.classList.add('word-animation-processed');
              }
              if (el.style.visibility === 'hidden') el.style.visibility = 'visible';
              animObserver.unobserve(el);
            }
          });
        }, { threshold: 0.10 });
        animCandidates.forEach(function(el) { animObserver.observe(el); });
      }
    } else {
      setTimeout(triggerEnterAnimations, 200);
      root.querySelectorAll(
        '[data-aos], [data-scroll], [data-inview], [class*="animate-"], [class*="reveal"], [class*="fade-in"], [class*="slide-in"], [class*="zoom-in"], [data-motion], [class*="staggered-"], [data-component-list*="StaggeredFadeIn"], [data-staggered-item]'
      ).forEach(function(el) {
        el.classList.add('aos-animate', 'in-view', 'is-revealed', 'is-visible', 'active', 'staggered-end');
        el.classList.remove('staggered-start');
        if (el.hasAttribute('data-staggered-item') || el.querySelectorAll('[data-staggered-item]').length > 0) {
          el.style.setProperty('opacity', '1');
          el.style.setProperty('visibility', 'visible');
          el.querySelectorAll('[data-staggered-item]').forEach(function(item) {
            item.style.setProperty('opacity', '1');
            item.style.setProperty('visibility', 'visible');
            item.style.setProperty('transform', 'none');
          });
        }
        if (el.style.opacity === '0' || el.classList.contains('animate-word') || (el.className && typeof el.className === 'string' && el.className.includes('animate-word'))) {
          el.style.setProperty('opacity', '1');
          el.style.setProperty('transform', 'translateY(0px)');
          const heading = el.closest('h1, h2, h3, [class*="heading"]');
          if (heading) heading.classList.add('word-animation-processed');
        }
        if (el.style.visibility === 'hidden') el.style.visibility = 'visible';
      });
    }

    // Universal Lazy Media Hydration in synthesized code
    root.querySelectorAll('img[data-src], img[data-desktop-src], img[data-original], img[data-lazy-src], img[data-srcset], picture source').forEach(function(el) {
      if (el.tagName === 'SOURCE') {
        const srcset = el.getAttribute('srcset') || '';
        const isPlaceholder = !srcset ||
          srcset.includes('data:image/gif;base64,R0lGODlh') ||
          srcset.includes('data:image/svg+xml;base64,') ||
          srcset.trim() === '';
        if (isPlaceholder) {
          const dSet = el.getAttribute('data-srcset');
          if (dSet && !dSet.includes('data:image/gif;base64,R0lGODlh')) {
            el.setAttribute('srcset', dSet);
          } else {
            const siblingImg = el.parentElement ? el.parentElement.querySelector('img') : null;
            if (siblingImg) {
              const actualSrc = siblingImg.getAttribute('data-src') || siblingImg.getAttribute('data-desktop-src') || siblingImg.getAttribute('data-original') || siblingImg.getAttribute('src');
              if (actualSrc && !actualSrc.includes('data:image/gif;base64,R0lGODlh')) {
                el.setAttribute('srcset', actualSrc);
              } else {
                el.remove();
              }
            } else {
              el.remove();
            }
          }
        }
        return;
      }
      const real = el.getAttribute('data-desktop-src') || el.getAttribute('data-src') || el.getAttribute('data-original') || el.getAttribute('data-lazy-src');
      if (real && (!el.src || el.src.startsWith('data:image/gif') || el.src.startsWith('data:image/svg') || el.src === window.location.href)) {
        el.src = real;
      }
      const dSet = el.getAttribute('data-srcset');
      if (dSet && !el.srcset) el.srcset = dSet;
    });

    // Universal Eager Image Preloader for all Carousels, Sliders, and Galleries
    function preloadAllCarouselImages() {
      const carouselContainers = root.querySelectorAll(
        '[class*="media-gallery"], [class*="carousel"], [class*="slider"], [class*="swiper"], [class*="gallery"], [role="region"][aria-roledescription*="carousel"], [aria-roledescription="carousel"]'
      );
      carouselContainers.forEach(function(c) {
        c.querySelectorAll('img').forEach(function(img) {
          img.setAttribute('loading', 'eager');
          img.setAttribute('decoding', 'async');

          const pic = img.closest('picture');
          if (pic) {
            pic.querySelectorAll('source').forEach(function(s) {
              const sSet = s.getAttribute('srcset') || '';
              if (sSet.includes('data:image/gif') || sSet.includes('data:image/svg') || !sSet.trim()) {
                if (img.src && !img.src.startsWith('data:')) {
                  s.setAttribute('srcset', img.src);
                } else {
                  s.remove();
                }
              }
            });
          }

          const realSrc = img.getAttribute('data-src') || img.getAttribute('data-desktop-src') || img.getAttribute('data-mobile-src') || img.getAttribute('data-original') || img.getAttribute('data-lazy-src');
          if (realSrc && (!img.src || img.src.startsWith('data:image/gif') || img.src.startsWith('data:image/svg') || img.src === window.location.href)) {
            img.src = realSrc;
          }
          const realSrcset = img.getAttribute('data-srcset');
          if (realSrcset && (!img.srcset || img.srcset.includes('data:image/gif'))) {
            img.srcset = realSrcset;
          }

          img.classList.add('image--loaded', 'image--main-loaded', 'loaded', 'is-loaded');
          img.style.setProperty('opacity', '1', 'important');
          img.style.setProperty('visibility', 'visible', 'important');
          const pImage = img.closest('.image, [class*="image__"], [class*="img-wrap"]');
          if (pImage) {
            pImage.classList.add('image--loaded', 'image--main-loaded', 'loaded');
          }

          if (img.decode && img.src && !img.src.startsWith('data:')) {
            img.decode().catch(function() {});
          }
        });
      });
    }

    preloadAllCarouselImages();
    window.addEventListener('load', preloadAllCarouselImages);

    // D. Universal Scroll-Tied Floating Hero Mask & Spec Gliding Controller
    if (maskVisual && targetHero) {
      maskVisual.style.removeProperty('translate');
      maskVisual.style.removeProperty('scale');
      maskVisual.style.removeProperty('rotate');
      maskVisual.style.transformOrigin = 'center center';
      maskVisual.style.zIndex = '30';

      let metrics = null;
      function computeMetrics() {
        const prevTransform = maskVisual.style.transform;
        maskVisual.style.transform = 'none';

        const maskRect = maskVisual.getBoundingClientRect();
        const heroRect = targetHero.getBoundingClientRect();
        const initialMaskY = maskRect.top + window.scrollY;
        const initialHeroY = heroRect.top + window.scrollY;

        // Eye position in portraits is approx 1/3 (~33-35%) down the hero figure
        const heroEyesY = initialHeroY + (heroRect.height * 0.33);
        const maskInitialCenter = initialMaskY + (maskRect.height * 0.50);

        let deltaY = heroEyesY - maskInitialCenter + 75;
        if (isNaN(deltaY) || deltaY <= 50) {
          deltaY = 606;
        }

        let scale = 0.52;
        if (maskRect.width > 0 && heroRect.width > 0) {
          scale = Math.min(0.65, Math.max(0.35, (heroRect.width * 0.40) / maskRect.width));
        }

        maskVisual.style.transform = prevTransform;
        return { deltaY: deltaY, targetScale: scale };
      }

      function getMetrics() {
        if (!metrics) {
          metrics = computeMetrics();
        }
        return metrics;
      }

      if (maskVisual.complete && targetHero.complete) {
        metrics = computeMetrics();
      } else {
        maskVisual.addEventListener('load', function() { metrics = computeMetrics(); });
        targetHero.addEventListener('load', function() { metrics = computeMetrics(); });
      }
      window.addEventListener('resize', function() { metrics = null; updateScrollGlide(); }, { passive: true });

      function updateScrollGlide() {
        const m = getMetrics();
        const sectionRect = root.getBoundingClientRect();
        const sectionTop = sectionRect.top + window.scrollY;

        const scrollStart = sectionTop <= 150 ? 0 : (sectionTop - 50);
        const scrollDistance = 600;
        const relScroll = window.scrollY - scrollStart;
        const progress = Math.min(1, Math.max(0, relScroll / scrollDistance));

        const currentY = progress * m.deltaY;
        const currentScale = 1.0 - (progress * (1.0 - m.targetScale));

        maskVisual.style.setProperty('transform', 'translate3d(0px, ' + currentY.toFixed(2) + 'px, 0px) scale(' + currentScale.toFixed(4) + ')');

        // Hero face color reveals as specs touch down (progress 0.65 -> 0.95)
        // Silhouette remains visible underneath
        const faceAlpha = Math.min(1, Math.max(0, (progress - 0.65) / 0.30));
        targetHero.style.setProperty('opacity', faceAlpha.toFixed(2));

        // When specs land, trigger scramble text and SVG pointer lines
        if (progress >= 0.70 && !hasAnimated) {
          triggerEnterAnimations();
        }
      }

      updateScrollGlide();

      let ticking = false;
      window.addEventListener('scroll', function() {
        if (!ticking) {
          requestAnimationFrame(function() {
            updateScrollGlide();
            ticking = false;
          });
          ticking = true;
        }
      }, { passive: true });

    } else if (maskVisual) {
      let ticking = false;
      window.addEventListener('scroll', function() {
        if (!ticking) {
          requestAnimationFrame(function() {
            const rect = root.getBoundingClientRect();
            if (rect.top < window.innerHeight && rect.bottom > 0) {
              const scrollProgress = Math.max(0, Math.min(1, (window.innerHeight - rect.top) / (window.innerHeight + rect.height)));
              const translateY = (scrollProgress - 0.5) * 40;
              const scale = 1 - (scrollProgress * 0.08);
              maskVisual.style.transform = 'translateY(' + translateY.toFixed(1) + 'px) scale(' + scale.toFixed(3) + ')';
              maskVisual.style.transition = 'transform 0.1s ease-out';
            }
            ticking = false;
          });
          ticking = true;
        }
      }, { passive: true });
    }
  })();
    `.trim());

    // 8. Universal Interactive Product Viewer & Detent Pose Slider Controller
    scripts.push(`
  // Universal Interactive Product Viewer & Detent Pose Slider Controller
  (function() {
    const root = document.querySelector('#${ast.id}') || document;
    const viewerComponent = root.querySelector('.product-viewer-component, [data-component-list*="ProductViewer"], [class*="product-viewer"]');
    if (!viewerComponent) return;

    const controlItems = Array.from(viewerComponent.querySelectorAll('ul.control-group > li, .control-group > .control-item, li.control-item'));
    if (controlItems.length === 0) return;

    // Unhide 3D loader overlay, reveal media gallery & control buttons
    viewerComponent.querySelectorAll('.viewer--loading').forEach(function(el) {
      el.classList.remove('viewer--loading');
      el.classList.add('viewer--loaded');
    });
    viewerComponent.querySelectorAll('.loader, .loader-background, [class*="loader"], .product-viewer-canvas.entice').forEach(function(el) {
      el.style.display = 'none';
    });

    const mediaGallery = viewerComponent.querySelector('.product-viewer-media-gallery, [class*="product-viewer-media-gallery"]');
    if (mediaGallery) {
      mediaGallery.style.opacity = '1';
      mediaGallery.style.visibility = 'visible';
      mediaGallery.style.display = 'block';
    }

    const controlButtons = Array.from(viewerComponent.querySelectorAll('.control-item-open, li.control-item > button'));
    controlButtons.forEach(function(btn) {
      btn.style.visibility = 'visible';
    });
    viewerComponent.querySelectorAll('.control-item-label').forEach(function(lbl) {
      lbl.style.opacity = '1';
      lbl.style.visibility = 'visible';
    });

    const mediaList = Array.from(viewerComponent.querySelectorAll('.product-viewer-media, [class*="product-viewer-media"]'));
    const prevBtns = Array.from(viewerComponent.querySelectorAll('.paddlenav-prev'));
    const nextBtns = Array.from(viewerComponent.querySelectorAll('.paddlenav-next'));
    const closeBtns = Array.from(viewerComponent.querySelectorAll('.close-button'));

    // Dynamic measurements with fallbacks
    const contractedWidths = [206, 168, 142, 136, 136, 152, 158];
    const expandedHeights = [174, 128, 128, 128, 128, 128, 128];
    const getCardWidth = function() { return Math.min(425, window.innerWidth - 48); };

    let activeIndex = 0;
    let isTransitioning = false;

    // Initialize all items in explicit pixel dimensions for smooth interpolation
    controlItems.forEach(function(item, idx) {
      const isInitial = idx === 0;
      const w = isInitial ? getCardWidth() : (contractedWidths[idx] || 150);
      const h = isInitial ? (expandedHeights[idx] || 130) : 56;
      const r = isInitial ? 18 : 980;
      const bg = isInitial ? 'rgba(255, 255, 255, 0.94)' : 'rgba(255, 255, 255, 0.85)';
      const sh = isInitial ? '0 12px 36px rgba(0, 0, 0, 0.16)' : '0 2px 12px rgba(0, 0, 0, 0.08)';

      item.style.setProperty('width', w + 'px', 'important');
      item.style.setProperty('height', h + 'px', 'important');
      item.style.setProperty('border-radius', r + 'px', 'important');
      item.style.setProperty('background', bg, 'important');
      item.style.setProperty('box-shadow', sh, 'important');

      if (isInitial) {
        item.classList.add('expanded', 'is-active', 'active', 'current', 'open');
        item.setAttribute('aria-expanded', 'true');
      } else {
        item.classList.remove('expanded', 'is-active', 'active', 'current', 'open');
        item.setAttribute('aria-expanded', 'false');
      }

      const prevBtn = item.querySelector('.paddlenav-prev');
      const nextBtn = item.querySelector('.paddlenav-next');
      if (prevBtn) prevBtn.disabled = (idx === 0);
      if (nextBtn) nextBtn.disabled = (idx === controlItems.length - 1);
    });

    function activatePose(newIndex) {
      if (isTransitioning) return;
      if (newIndex === activeIndex) {
        // Toggle collapse back to resting pill
        isTransitioning = true;
        const item = controlItems[activeIndex];
        item.classList.remove('expanded', 'is-active', 'active', 'current', 'open');
        item.setAttribute('aria-expanded', 'false');
        item.style.setProperty('width', (contractedWidths[activeIndex] || 150) + 'px', 'important');
        item.style.setProperty('height', '56px', 'important');
        item.style.setProperty('border-radius', '980px', 'important');
        item.style.setProperty('background', 'rgba(255, 255, 255, 0.85)', 'important');
        item.style.setProperty('box-shadow', '0 2px 12px rgba(0, 0, 0, 0.08)', 'important');
        activeIndex = -1;
        setTimeout(function() { isTransitioning = false; }, 400);
        return;
      }

      if (newIndex < 0 || newIndex >= controlItems.length) return;
      isTransitioning = true;

      const prevIndex = activeIndex;
      activeIndex = newIndex;

      // Collapse all other items smoothly
      controlItems.forEach(function(item, idx) {
        if (idx !== newIndex) {
          item.classList.remove('expanded', 'is-active', 'active', 'current', 'open');
          item.setAttribute('aria-expanded', 'false');
          item.style.setProperty('width', (contractedWidths[idx] || 150) + 'px', 'important');
          item.style.setProperty('height', '56px', 'important');
          item.style.setProperty('border-radius', '980px', 'important');
          item.style.setProperty('background', 'rgba(255, 255, 255, 0.85)', 'important');
          item.style.setProperty('box-shadow', '0 2px 12px rgba(0, 0, 0, 0.08)', 'important');
        }
      });

      // Expand target item smoothly
      const targetItem = controlItems[newIndex];
      targetItem.classList.add('expanded', 'is-active', 'active', 'current', 'open');
      targetItem.setAttribute('aria-expanded', 'true');
      targetItem.style.setProperty('width', getCardWidth() + 'px', 'important');
      targetItem.style.setProperty('height', (expandedHeights[newIndex] || 130) + 'px', 'important');
      targetItem.style.setProperty('border-radius', '18px', 'important');
      targetItem.style.setProperty('background', 'rgba(255, 255, 255, 0.94)', 'important');
      targetItem.style.setProperty('box-shadow', '0 12px 36px rgba(0, 0, 0, 0.16)', 'important');

      // Update paddle navigation disabled states
      const prevBtn = targetItem.querySelector('.paddlenav-prev');
      const nextBtn = targetItem.querySelector('.paddlenav-next');
      if (prevBtn) prevBtn.disabled = (newIndex === 0);
      if (nextBtn) nextBtn.disabled = (newIndex === controlItems.length - 1);

      // Synchronize media cross-fade
      const stateName = targetItem.getAttribute('data-viewer-state') || '';
      mediaList.forEach(function(m, idx) {
        const matches = stateName ? m.className.includes(stateName) : idx === newIndex;
        if (matches) {
          m.classList.add('active', 'is-active');
          m.style.display = 'grid';
          m.style.visibility = 'visible';
          m.style.opacity = '0';
          m.style.transition = 'opacity 400ms cubic-bezier(0.25, 1, 0.5, 1), transform 400ms cubic-bezier(0.25, 1, 0.5, 1)';
          m.style.transform = 'scale(0.98)';
          requestAnimationFrame(function() {
            m.style.opacity = '1';
            m.style.transform = 'scale(1)';
          });
        } else if (m.classList.contains('active') || m.classList.contains('is-active')) {
          m.style.transition = 'opacity 350ms cubic-bezier(0.25, 1, 0.5, 1), transform 350ms cubic-bezier(0.25, 1, 0.5, 1)';
          m.style.opacity = '0';
          m.style.transform = 'scale(1.02)';
          setTimeout(function() {
            m.classList.remove('active', 'is-active');
            m.style.display = 'none';
          }, 350);
        }
      });

      setTimeout(function() {
        isTransitioning = false;
      }, 400);
    }

    // Attach click listeners to control items & buttons
    controlItems.forEach(function(item, idx) {
      const openBtn = item.querySelector('.control-item-open, button');
      if (openBtn) {
        openBtn.addEventListener('click', function(e) {
          e.preventDefault();
          activatePose(idx);
        }, true);
      }

      item.addEventListener('click', function(e) {
        if (e.target && e.target.closest('.paddlenav-button, .paddlenav-prev, .paddlenav-next')) return;
        e.preventDefault();
        activatePose(idx);
      });

      const prevBtn = item.querySelector('.paddlenav-prev');
      if (prevBtn) {
        prevBtn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          if (activeIndex > 0) activatePose(activeIndex - 1);
        }, true);
      }

      const nextBtn = item.querySelector('.paddlenav-next');
      if (nextBtn) {
        nextBtn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          if (activeIndex < controlItems.length - 1) activatePose(activeIndex + 1);
        }, true);
      }
    });

    // Delegated Paddlenav arrows and close button fallback
    viewerComponent.addEventListener('click', function(e) {
      const prev = e.target && e.target.closest ? e.target.closest('.paddlenav-prev') : null;
      if (prev) {
        e.preventDefault();
        e.stopPropagation();
        if (activeIndex > 0) activatePose(activeIndex - 1);
        return;
      }
      const next = e.target && e.target.closest ? e.target.closest('.paddlenav-next') : null;
      if (next) {
        e.preventDefault();
        e.stopPropagation();
        if (activeIndex < controlItems.length - 1) activatePose(activeIndex + 1);
        return;
      }
      const close = e.target && e.target.closest ? e.target.closest('.close-button') : null;
      if (close) {
        e.preventDefault();
        e.stopPropagation();
        if (activeIndex >= 0) activatePose(activeIndex);
      }
    });

    // Detent Slider Handler
    const sliderInputs = Array.from(viewerComponent.querySelectorAll('.control-detent-slider--input, input[type="range"]'));
    sliderInputs.forEach(function(slider) {
      const thumb = slider.closest('.control-item-content, .control-item')?.querySelector('.control-detent-slider--thumb');
      function updateSlider() {
        const min = parseFloat(slider.getAttribute('min') || '0');
        const max = parseFloat(slider.getAttribute('max') || '1');
        const val = parseFloat(slider.value || '0');
        const pct = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
        if (thumb) {
          const wrapper = slider.parentElement;
          const trackWidth = wrapper ? wrapper.clientWidth - thumb.clientWidth : 150;
          thumb.style.transform = 'translateX(' + ((pct / 100) * trackWidth).toFixed(1) + 'px)';
        }
      }
      slider.addEventListener('input', updateSlider);
      slider.addEventListener('change', updateSlider);
      updateSlider();
    });
  })();

  // Universal continuous looping & auto-recovery for animation videos
  const animVideos = Array.from(document.querySelectorAll('video[data-inline-media], video.pin-offset, [class*="inline-media"] video'));
  animVideos.forEach(function(v) {
    v.muted = true;
    v.loop = true;
    v.setAttribute('playsinline', '');
    if (v.paused) {
      v.play().catch(function() {});
    }
    v.addEventListener('ended', function() {
      v.currentTime = 0;
      v.play().catch(function() {});
    });
  });
      `.trim());

    if (scripts.length === 0) {
      return '';
    }

    const isolatedScripts = scripts.map((s) => `try {\n      ${s.split('\n').join('\n      ')}\n    } catch (err) {\n      console.warn('[Synthesized Controller Error]', err);\n    }`);

    return `
/**
 * Synthesized Interactive Behaviors (Section: ${ast.archetype})
 * Zero external dependencies. Modern Vanilla ES6.
 */
(function() {
  function init() {
    // Universal Navigation Interceptor: prevent external links from navigating away
    document.addEventListener('click', function(e) {
      const a = e.target && e.target.closest ? e.target.closest('a') : null;
      if (a) {
        const href = a.getAttribute('href');
        if (href && (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('/'))) {
          e.preventDefault();
        }
      }
    }, false);

    // Universal Inline Video Animation Controller (Dynamic Viewport Play-Once)
    try {
      const inlineVideos = document.querySelectorAll(
        'video[data-inline-media-basepath], video[data-inline-media-play-kf], .inline-media-wrapper video, video[role="img"], [data-media-type="video"] video'
      );
      if (inlineVideos.length > 0) {
        function activateVideo(vid) {
          if (vid.getAttribute('data-has-played')) return;
          vid.setAttribute('data-has-played', 'true');
          vid.muted = true;
          vid.playsInline = true;
          vid.loop = false;
          const wrapper = vid.closest('.inline-media-wrapper, .media-block, .media-container, .inline-media-component-container, .video-wrapper') || vid.parentElement;
          if (wrapper) {
            wrapper.classList.remove('idle', 'loading-empty', 'media-unloaded');
            wrapper.classList.add('loaded', 'playing', 'has-played');
          }
          const playPromise = vid.play();
          if (playPromise !== undefined) {
            playPromise.catch(function() {});
          }
          vid.addEventListener('ended', function() {
            if (wrapper) {
              wrapper.classList.remove('playing');
              wrapper.classList.add('ended');
            }
          }, { once: true });
        }

        if ('IntersectionObserver' in window) {
          const playOnceObserver = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
              if (entry.isIntersecting) {
                activateVideo(entry.target);
              }
            });
          }, { threshold: 0.15 });

          inlineVideos.forEach(function(vid) {
            vid.muted = true;
            vid.playsInline = true;
            vid.loop = false;
            playOnceObserver.observe(vid);
          });
        } else {
          inlineVideos.forEach(function(vid) {
            activateVideo(vid);
          });
        }
      }
    } catch (e) {}

    ${isolatedScripts.join('\n\n    ')}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
`.trim();
  }
}
