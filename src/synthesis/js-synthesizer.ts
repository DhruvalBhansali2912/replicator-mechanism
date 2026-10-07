import { SectionAST } from './types.js';

export class JsSynthesizer {
  /**
   * Synthesizes modular, zero-dependency vanilla ES6 for interactive section behaviors.
   */
  public synthesize(ast: SectionAST): string {
    const scripts: string[] = [];

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
      const triggers = queryElements(interaction.triggerSelector);
      if (!triggers.length) return;

      triggers.forEach(function(trigger) {
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
      rawLower.includes('globalnav') ||
      rawLower.includes('<nav') ||
      rawLower.includes('<header') ||
      rawLower.includes('mega-menu') ||
      rawLower.includes('site-header');

    if (isNavigationSection) {
      scripts.push(`
  // Navigation & Dropdown Mega-Menu Controller
  const navRoot = document.querySelector('#${ast.id}') || document.querySelector('header, nav, [role="navigation"], .site-header, #globalnav');
  const menuBtn = navRoot ? Array.from(navRoot.querySelectorAll(
    '.universal-nav-toggle, button[class*="menutrigger"], button[class*="hamburger"], button[class*="nav-toggle"], [class*="nav-toggle"] button, [class*="menu-toggle"] button, button[class*="menu-toggle"], button[class*="menu-btn" i], [class*="mobile-menu-btn" i], button[class*="mobile-menu-btn" i], [class*="menutrigger"] button, button[aria-controls*="nav" i], button[aria-controls*="menu" i], button[aria-label*="menu" i], button[aria-label="Open Menu" i], button[aria-label="Toggle navigation" i]'
  )).find(function(el) {
    const cls = (el.className || '').toLowerCase();
    const lbl = (el.getAttribute('aria-label') || '').toLowerCase();
    const parentCls = (el.parentElement ? el.parentElement.className : '').toLowerCase();
    if (cls.includes('back') || cls.includes('submenu') || cls.includes('close') || cls.includes('search')) return false;
    if (parentCls.includes('submenu-trigger') || parentCls.includes('menuback')) return false;
    return true;
  }) : null;
  // 1. Resolve drawer via W3C aria-controls or standard mobile drawer selectors
  let drawer = null;
  if (menuBtn && menuBtn.getAttribute('aria-controls')) {
    drawer = document.getElementById(menuBtn.getAttribute('aria-controls'));
  }
  if (!drawer && navRoot) {
    drawer = navRoot.querySelector(
      '[role="dialog"], [role="navigation"], [id*="mobile-menu" i], [class*="mobile-menu" i], [class*="menu-drawer" i], [class*="mobile-nav" i], [class*="drawer" i], [class*="sidebar" i], [class*="nav-drawer" i]'
    );
  }
  if (!drawer) {
    drawer = document.querySelector(
      '[role="dialog"][class*="menu" i], [role="dialog"][id*="menu" i], [id*="mobile-menu" i], [class*="mobile-menu" i], [class*="menu-drawer" i], [class*="drawer" i], [class*="sidebar" i], [class*="mobile-nav" i]'
    );
  }
  const menuBackBtn = navRoot ? navRoot.querySelector('.globalnav-menuback-button, [class*="menuback"]') : null;

  // Universal Responsive Navigation Synchronization:
  // Dynamically synchronize drawer visibility with hamburger toggle state across viewports.
  function syncMobileNavState() {
    if (!drawer || !menuBtn) return;
    try {
      const isMobile = window.getComputedStyle(menuBtn).display !== 'none';
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
    const ariaTriggers = Array.from(item.querySelectorAll('[aria-controls]'));
    for (let i = 0; i < ariaTriggers.length; i++) {
      const ctrlId = ariaTriggers[i].getAttribute('aria-controls');
      if (ctrlId) {
        const controlled = document.getElementById(ctrlId);
        if (controlled && controlled !== item) return controlled;
      }
    }
    const candidates = Array.from(item.querySelectorAll(
      '.nav-dropdown-menu, [role="menu"], [class*="dropdown-menu"], [class*="submenu"], [class*="flyout"], [class*="dropdown"], [class*="megamenu"], [class*="nav-tab__overlay"], [class*="menu__overlay"], [class*="overlay"]'
    ));
    const match = candidates.find(function(el) {
      if (el === item) return false;
      const cls = (el.getAttribute('class') || '').toLowerCase();
      // Exclude trigger buttons, links, icons, toggles, chevrons, containers and wrappers
      if (cls.includes('trigger') || cls.includes('button') || cls.includes('btn') || cls.includes('link') || cls.includes('toggle') || cls.includes('icon') || cls.includes('chevron') || cls.includes('container') || cls.includes('wrapper')) {
        return false;
      }
      // Exclude container menu list if this is a nav item
      if (cls.includes('globalnav-menu') && !cls.includes('submenu')) {
        return false;
      }
      return el.children.length > 0;
    });
    return match || null;
  }

  const allNavCandidates = navRoot ? Array.from(navRoot.querySelectorAll(
    '.nav-item, [class*="nav-item"], .globalnav-item, li, [role="menuitem"], [class*="menu-item"], [class*="nav-tab"]'
  )).filter(function(el) {
    const cls = (el.getAttribute('class') || '').toLowerCase();
    // Exclude dropdown/flyout panels themselves from being considered nav items
    if (cls.includes('dropdown') || cls.includes('overlay') || cls.includes('flyout') || cls.includes('submenu')) {
      return false;
    }
    // Exclude BEM element children (title, wrapper, content, scroll, inner)
    if (cls.includes('__title') || cls.includes('__wrapper') || cls.includes('__content') || cls.includes('__scroll') || cls.includes('__inner')) {
      return false;
    }
    return true;
  }) : [];

  const navDropdownItems = allNavCandidates.filter(function(item) {
    // 1. Exclude drawer containers, menu wrappers, and back buttons
    if (drawer && (drawer === item || item.classList.contains('globalnav-menu') || item.classList.contains('mobile-nav-drawer'))) return false;
    if (item.matches('[class*="drawer"], [class*="menu-container"], .globalnav-menuback, [class*="menuback"]')) return false;

    // 2. Dropdown element must exist for this item
    const dd = getDropdownFor(item);
    if (!dd) return false;

    // 3. Exclude elements that are inside another dropdown/flyout
    if (item.parentElement && item.parentElement.closest('.nav-dropdown-menu, [class*="dropdown-menu"], [class*="submenu-content"], [class*="submenu-group"], [class*="submenu-list"], [class*="flyout-content"], [class*="flyout-group"], [class*="flyout-list"], [class*="nav-tab__overlay"], [class*="overlay"]')) {
      return false;
    }

    return true;
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
                        const lower = cls.toLowerCase();
                        if (prefixes.some(function(p) { return lower.startsWith(p); })) {
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
    });
    applyFrameworkStateClasses(it, false);
    const itDropdown = getDropdownFor(it);
    if (itDropdown) {
      itDropdown.classList.remove('is-open', 'open', 'show', 'active');
      applyFrameworkStateClasses(itDropdown, false);
      itDropdown.style.visibility = '';
      itDropdown.style.opacity = '';
      itDropdown.style.height = '';
      itDropdown.style.minHeight = '';
      itDropdown.style.display = '';
      itDropdown.style.pointerEvents = '';
      itDropdown.style.removeProperty('--r-globalnav-flyout-height');
      itDropdown.style.removeProperty('--flyout-height');
      itDropdown.querySelectorAll('[class*="submenu-list-item"], [class*="list-item"], a, [class*="content"], [class*="group"], [class*="header"]').forEach(function(el) {
        el.style.opacity = '';
        el.style.visibility = '';
        el.style.pointerEvents = '';
      });
    }
    // Clean up aria-expanded and active state on the item itself and all non-dropdown descendants
    if (it.getAttribute('aria-expanded')) it.setAttribute('aria-expanded', 'false');
    it.querySelectorAll('[aria-expanded]').forEach(function(el) {
      if (!itDropdown || !itDropdown.contains(el)) el.setAttribute('aria-expanded', 'false');
    });
    it.querySelectorAll('.active, .is-active').forEach(function(ch) {
      if (!itDropdown || !itDropdown.contains(ch)) {
        ch.classList.remove('active', 'is-active');
        applyFrameworkStateClasses(ch, false);
      }
    });

    const curtains = document.querySelectorAll('.globalnav-curtain, [class*="curtain"], [class*="backdrop"], [class*="scrim"], [class*="overlay-cover"]');
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
        'globalnav-menu-open', 'globalnav-with-menu-open',
        'has-flyout-open', 'globalnav-with-flyout-open',
        'globalnav-with-submenu-open', 'with-submenu-open'
      );
      Array.from(nr.classList).forEach(function(cls) {
        if (cls.includes('menu-open') || cls.includes('flyout-open') || cls.includes('submenu-open') || cls.endsWith('-open')) {
          nr.classList.remove(cls);
        }
      });
      nr.style.removeProperty('--r-globalnav-flyout-height');
      nr.style.removeProperty('--flyout-height');
    });
    if (drawer) {
      drawer.classList.remove('is-open', 'open');
      drawer.setAttribute('aria-hidden', 'true');
      const isMobile = menuBtn && window.getComputedStyle(menuBtn).display !== 'none';
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
      if (drawer.getAttribute('data-offscreen-offset')) {
        drawer.style.transform = '';
        drawer.removeAttribute('data-offscreen-offset');
      }
      applyFrameworkStateClasses(drawer, false);
    }
    if (menuBtn) {
      menuBtn.setAttribute('aria-expanded', 'false');
      menuBtn.classList.remove('is-active', 'is-open');
      menuBtn.querySelectorAll('animate[id*="close"]').forEach(function(anim) {
        if (typeof anim.beginElement === 'function') {
          try { anim.beginElement(); } catch (_) {}
        }
      });
    }
    navDropdownItems.forEach(function(it) {
      closeFlyoutItem(it);
    });
    activeFlyoutItem = null;
    const curtain = document.querySelector('.globalnav-curtain, [class*="curtain"], [class*="backdrop"], [class*="scrim"]');
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
        navRoot.classList.remove('is-open', 'has-flyout-open');
        Array.from(navRoot.classList).forEach(function(cls) {
          if (cls.includes('with-flyout-open')) navRoot.classList.remove(cls);
        });
        navRoot.style.removeProperty('--r-globalnav-flyout-height');
      }
      const curtain = document.querySelector('.globalnav-curtain, [class*="curtain"], [class*="backdrop"], [class*="scrim"]');
      if (curtain) {
        curtain.style.opacity = '';
        curtain.style.visibility = '';
        curtain.classList.remove('is-active', 'is-open');
      }
    }, 150);
  }

  if (menuBtn && !menuBtn.hasAttribute('data-menu-bound')) {
    menuBtn.setAttribute('data-menu-bound', 'true');
    menuBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      const allNavRoots = [navRoot];
      const ih = navRoot ? navRoot.querySelector('header, nav, [role="navigation"]') : null;
      if (ih) allNavRoots.push(ih);
      const ph = navRoot ? navRoot.closest('header, nav, [role="navigation"]') : null;
      if (ph) allNavRoots.push(ph);

      const isCurrentlyOpen = (menuBtn && menuBtn.classList.contains('is-active')) ||
        (drawer && drawer.classList.contains('is-open')) ||
        allNavRoots.some(function(nr) {
          return nr.classList.contains('menu-open') ||
            nr.classList.contains('globalnav-menu-open') ||
            nr.classList.contains('is-open');
        });

      if (isCurrentlyOpen) {
        closeAllNav();
      } else {
        allNavRoots.forEach(function(nr) {
          nr.classList.add('menu-open', 'is-open', 'nav-open', 'globalnav-menu-open', 'globalnav-with-menu-open');
        });
        if (drawer) {
          drawer.classList.add('is-open', 'open');
          drawer.setAttribute('aria-hidden', 'false');
          drawer.style.visibility = 'visible';
          drawer.style.opacity = '1';
          drawer.style.pointerEvents = 'auto';

          // Apply framework active/open state classes dynamically
          applyFrameworkStateClasses(drawer, true);

          // Viewport geometry safety net: If drawer is positioned offscreen by CSS transforms or offsets, bring it on-screen
          try {
            const rect = drawer.getBoundingClientRect();
            if (rect.left >= window.innerWidth) {
              drawer.setAttribute('data-offscreen-offset', 'right');
              drawer.style.transform = 'translateX(-100%)';
            } else if (rect.right <= 0) {
              drawer.setAttribute('data-offscreen-offset', 'left');
              drawer.style.transform = 'translateX(100%)';
            }
          } catch (_) {}
        }
        menuBtn.setAttribute('aria-expanded', 'true');
        menuBtn.classList.add('is-active', 'is-open');
        menuBtn.querySelectorAll('animate[id*="open"]').forEach(function(anim) {
          if (typeof anim.beginElement === 'function') {
            try { anim.beginElement(); } catch (_) {}
          }
        });
      }
    });
  }

  // Bind close buttons inside drawer
  const drawerCloseBtns = drawer ? Array.from(drawer.querySelectorAll(
    'button[class*="close" i], button[aria-label*="close" i], [class*="closeButton" i], [class*="close-button" i], .close-btn, [id*="close" i]'
  )) : [];
  drawerCloseBtns.forEach(function(cb) {
    if (cb.hasAttribute('data-close-bound')) return;
    cb.setAttribute('data-close-bound', 'true');
    cb.addEventListener('click', function(e) {
      e.stopPropagation();
      closeAllNav();
    });
  });

  if (menuBackBtn && !menuBackBtn.hasAttribute('data-back-bound')) {
    menuBackBtn.setAttribute('data-back-bound', 'true');
    menuBackBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (navRoot) {
        navRoot.classList.remove('globalnav-with-submenu-open', 'with-submenu-open');
        Array.from(navRoot.classList).forEach(function(cls) {
          if (cls.includes('submenu-open')) navRoot.classList.remove(cls);
        });
      }
      navDropdownItems.forEach(function(it) {
        closeFlyoutItem(it);
      });
      activeFlyoutItem = null;
    });
  }

  // Universal mobile accordion toggle for submenus and drawer categories
  const accordionButtons = Array.from(document.querySelectorAll(
    '.mobile-nav-accordion-btn, .toggle-button, [class*="accordion-trigger"], [class*="accordion-button"], [class*="accordion-toggle"], [class*="toggle-btn"], button[aria-controls*="toggle" i], button[aria-controls*="content" i], button[aria-controls*="collapse" i]'
  ));
  accordionButtons.forEach(function(btn) {
    if (btn.hasAttribute('data-accordion-bound')) return;
    btn.setAttribute('data-accordion-bound', 'true');
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      let target = null;
      const controlsId = btn.getAttribute('aria-controls');
      if (controlsId) {
        const container = btn.closest('[role="dialog"], header, nav, section, [class*="accordion"], .mobile-nav-item, li');
        target = (container ? container.querySelector('#' + controlsId) : null) || document.getElementById(controlsId);
      }
      if (!target) {
        target = btn.nextElementSibling || (btn.parentElement ? btn.parentElement.querySelector('.toggle-content, [class*="accordion-content"], [class*="content"]') : null);
      }
      const parentContainer = btn.closest('[class*="accordion" i], [class*="toggle" i], [class*="collapse" i], .mobile-nav-item, li');
      const isCurrentlyOpen = btn.getAttribute('aria-expanded') === 'true' ||
        (parentContainer && parentContainer.classList.contains('is-open')) ||
        (target && (target.classList.contains('is-open') || target.style.display === 'block'));

      const willOpen = !isCurrentlyOpen;
      btn.setAttribute('aria-expanded', String(willOpen));
      if (parentContainer) {
        parentContainer.classList.toggle('is-open', willOpen);
        parentContainer.classList.toggle('open', willOpen);
        applyFrameworkStateClasses(parentContainer, willOpen);
      }
      if (target) {
        target.classList.toggle('is-open', willOpen);
        target.classList.toggle('open', willOpen);
        target.style.display = willOpen ? 'block' : 'none';
        applyFrameworkStateClasses(target, willOpen);
      }
    });
  });

  navDropdownItems.forEach(function(item) {
    if (item.hasAttribute('data-flyout-bound')) return;
    item.setAttribute('data-flyout-bound', 'true');
    const dropdown = getDropdownFor(item);
    if (!dropdown) return;

    // Select the item triggers (button or link), outside the dropdown panel
    const triggers = Array.from(item.querySelectorAll(':scope > a, :scope > button, button, a, [role="button"], [class*="trigger"], a.nav-link, button.nav-link')).filter(function(el) {
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

      triggers.forEach(function(trg) { trg.setAttribute('aria-expanded', 'true'); trg.classList.add('active', 'is-active'); });

      const content = dropdown.querySelector('[class*="content"], [class*="inner"], [class*="container"]') || dropdown.firstElementChild || dropdown;
      const h = Math.max(content ? content.scrollHeight : 0, dropdown.scrollHeight, 380);

      if (navRoot) {
        navRoot.classList.add('is-open', 'has-flyout-open');
        Array.from(navRoot.classList).forEach(function(cls) {
          if ((cls.includes('globalnav') || cls.includes('nav')) && !cls.includes('with-flyout-open')) {
            navRoot.classList.add(cls + '-with-flyout-open');
          }
        });
        navRoot.style.setProperty('--r-globalnav-flyout-height', (h + 30) + 'px');
      }

      dropdown.style.setProperty('--r-globalnav-flyout-height', (h + 30) + 'px');
      dropdown.style.setProperty('--flyout-height', (h + 30) + 'px');
      dropdown.style.minHeight = (h + 30) + 'px';
      dropdown.style.height = 'auto';
      dropdown.style.setProperty('visibility', 'visible', 'important');
      dropdown.style.setProperty('opacity', '1', 'important');
      dropdown.style.setProperty('display', 'block', 'important');
      dropdown.setAttribute('aria-hidden', 'false');
      dropdown.classList.add('is-open', 'open', 'show', 'active');

      // Apply framework state classes dynamically to dropdown and triggers
      applyFrameworkStateClasses(dropdown, true);
      triggers.forEach(function(trg) {
        applyFrameworkStateClasses(trg, true);
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

      // Only reveal authentic curtain overlays if the navigation explicitly uses an Apple globalnav curtain
      if (navRoot && (navRoot.matches('[class*="globalnav"], [class*="with-curtain"]') || dropdown.matches('[class*="megamenu"], [class*="mega-menu"]'))) {
        const curtains = document.querySelectorAll('.globalnav-curtain, [class*="curtain"]:not(.nav-curtain), [class*="backdrop"], [class*="scrim"], [class*="overlay-cover"]');
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

    function handleDesktopHoverOrFocus() {
      if (window.innerWidth <= 833) return;
      openFlyout();
    }

    function handleDesktopLeaveOrBlur() {
      if (window.innerWidth <= 833) return;
      scheduleFlyoutClose();
    }

    // Attach desktop hover & focus interactions unconditionally for desktop viewports
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

        if (!isAnchorNav || window.innerWidth <= 833) {
          e.preventDefault();
          e.stopPropagation();
          const isSubOpen = item.classList.contains('is-open') || trg.getAttribute('aria-expanded') === 'true';
          if (isSubOpen) {
            closeFlyoutItem(item);
            if (navRoot) navRoot.classList.remove('globalnav-with-submenu-open', 'with-submenu-open');
          } else {
            navDropdownItems.forEach(function(other) {
              if (other !== item) closeFlyoutItem(other);
            });
            openFlyout();
            if (navRoot) navRoot.classList.add('globalnav-with-submenu-open', 'with-submenu-open');
          }
        }
      });
    });
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
      closeAllNav();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllNav();
    }
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
  const panelBackdrop = document.querySelector('.nav-curtain, .globalnav-curtain, [class*="backdrop"], [class*="curtain"], [class*="scrim"]');
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

    // Universal Tabbed Sections & Panes Controller
    const hasTabs =
      ast.archetype === 'tabs' ||
      ast.archetype === 'features' ||
      rawLower.includes('tab__item') ||
      rawLower.includes('tab-item') ||
      rawLower.includes('feature-tab') ||
      rawLower.includes('role="tab"') ||
      rawLower.includes('role="tablist"') ||
      rawLower.includes('tab-list') ||
      rawLower.includes('tabs-nav') ||
      rawLower.includes('tab-header') ||
      rawLower.includes('tablist');

    if (hasTabs) {
      scripts.push(`
  // Universal Tabbed Sections Controller
  (function() {
    const tabScope = document.getElementById('${ast.id}') || document.querySelector('.feature-tab, [class*="feature-tab"], [role="tablist"], [class*="tab"]') || document;
    
    // Find tab list headers or groups
    const tabLists = Array.from(tabScope.querySelectorAll(
      '[role="tablist"], [class*="tab-header"], [class*="tab__header"], [class*="tab-nav"], [class*="tabs-nav"], [class*="tab-list"], [class*="tabList"], [class*="nav-tabs"], ul[class*="tabs"]'
    ));
    
    const tabGroups = tabLists.length > 0 ? tabLists : [tabScope];
    
    tabGroups.forEach(function(group) {
      const tabs = Array.from(group.querySelectorAll(
        '[role="tab"], [class*="tab__item"], [class*="tab-item"], button[class*="tab"], li[class*="tab"], [data-tab]'
      )).filter(function(el) {
        const cls = (el.className || '').toLowerCase();
        return !cls.includes('panel') && !cls.includes('content') && !cls.includes('pane') && !cls.includes('container') && !cls.includes('wrapper');
      });

      if (tabs.length <= 1) return;

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

      // If no valid direct ID controls found, locate pane elements in tabScope
      if (panes.length === 0) {
        const paneCandidates = Array.from(tabScope.querySelectorAll(
          '[role="tabpanel"], [class*="tab__pane"], [class*="tab-pane"], [class*="tab-content"], [data-tab-pane], [data-tab-pane-index], [class*="tab_panel"]'
        )).filter(function(p) {
          return !group.contains(p);
        });

        // Filter out nested descendant panes so only top-level pane containers are matched
        const topPanes = paneCandidates.filter(function(p) {
          return !paneCandidates.some(function(other) {
            return other !== p && other.contains(p);
          });
        });

        if (topPanes.length > 0) {
          panes = topPanes;
        }
      }

      function setActiveTab(targetIdx) {
        tabs.forEach(function(t, i) {
          const isAct = i === targetIdx;
          t.setAttribute('aria-selected', String(isAct));
          t.setAttribute('tabindex', isAct ? '0' : '-1');
          
          if (isAct) {
            t.classList.add('is-active', 'active', 'selected');
            const clList = Array.from(t.classList);
            clList.forEach(function(c) {
              if (c.includes('tab') && !c.includes('active')) {
                t.classList.add(c + '--active');
                t.classList.add(c + '-active');
              }
            });
          } else {
            t.classList.remove('is-active', 'active', 'selected');
            Array.from(t.classList).forEach(function(c) {
              if (c.endsWith('--active') || c.endsWith('-active') || c.endsWith('_active')) {
                t.classList.remove(c);
              }
            });
          }
        });

        // Switch matching panes
        if (panes.length > 1) {
          panes.forEach(function(p, i) {
            const isAct = i === targetIdx;
            p.setAttribute('aria-hidden', String(!isAct));
            if (isAct) {
              p.classList.add('is-active', 'active');
              p.style.display = '';
              p.style.opacity = '1';
              p.style.visibility = 'visible';
            } else {
              p.classList.remove('is-active', 'active');
              p.style.display = 'none';
              p.style.opacity = '0';
              p.style.visibility = 'hidden';
            }
          });
        } else if (panes.length === 1) {
          // If only 1 pane exists in DOM, never hide it! Keep it visible so layout never breaks
          panes[0].style.display = '';
          panes[0].style.opacity = '1';
          panes[0].style.visibility = 'visible';
          panes[0].setAttribute('aria-hidden', 'false');
          panes[0].classList.add('is-active', 'active');
        }
      }

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
    });
  })();
      `.trim());
    }

    // 3. Carousel slide indicators / dots & arrow controls
    const isCatalogOrFilter =
      ast.archetype === 'features' ||
      ast.archetype === 'pricing' ||
      ast.archetype === 'faq';

    if (
      !isCatalogOrFilter &&
      (ast.carouselDots ||
        ast.layout === 'hero-overlay' ||
        (ast.images && ast.images.length > 1) ||
        ast.rawSectionHtml?.includes('carousel') ||
        ast.rawSectionHtml?.includes('swiper') ||
        ast.rawSectionHtml?.includes('slick') ||
        ast.rawSectionHtml?.includes('glide') ||
        ast.rawSectionHtml?.includes('splide') ||
        ast.rawSectionHtml?.includes('slider'))
    ) {
      scripts.push(`
  // Universal Carousel: Transform/Translate, Horizontal Scroll-Snap & Stacked Slide Controllers
  const sectionScope = document.getElementById('${ast.id}') || document.querySelector('section, [class*="hero"], [class*="carousel"]') || document;

  // 1. Detect Universal Transform / Translate Slider (Swiper, Slick, Glide, Splide, Embla, CSS transform tracks)
  const transformTrack = sectionScope.querySelector(
    '.swiper-wrapper, ' +
    '.slick-track, ' +
    '.glide__slides, ' +
    '.splide__list, ' +
    '[class*="slider-track"], ' +
    '[class*="slides-wrapper"], ' +
    '[class*="carousel-wrapper"], ' +
    '[class*="slider__wrapper"], ' +
    '[class*="carousel__track"]'
  ) || Array.from(sectionScope.querySelectorAll('div, ul, ol')).find(function(el) {
    const cls = (typeof el.className === 'string' ? el.className : (el.getAttribute && el.getAttribute('class')) || '').toLowerCase();
    if (cls.includes('container') && !cls.includes('wrapper')) return false;
    const kids = Array.from(el.children);
    return kids.length > 1 && kids.some(function(k) {
      const kCls = (typeof k.className === 'string' ? k.className : (k.getAttribute && k.getAttribute('class')) || '').toLowerCase();
      return kCls.includes('slide');
    });
  });

  if (transformTrack) {
    const allSlides = Array.from(transformTrack.children).filter(function(el) {
      const elCls = (typeof el.className === 'string' ? el.className : (el.getAttribute && el.getAttribute('class')) || '').toLowerCase();
      return el.nodeType === 1 && (el.offsetWidth > 0 || elCls.includes('slide'));
    });

    const nonDupSlides = allSlides.filter(function(s) {
      const sCls = (typeof s.className === 'string' ? s.className : (s.getAttribute && s.getAttribute('class')) || '').toLowerCase();
      return !sCls.includes('duplicate') && !sCls.includes('clone');
    });
    const uniqueSlides = nonDupSlides.length > 0 ? nonDupSlides : allSlides;
    const baseIdx = Math.max(allSlides.indexOf(uniqueSlides[0]), 0);

    // Indicator bars, dots, or bullets
    const bars = Array.from(sectionScope.querySelectorAll(
      'button[class*="bar"], ' +
      'button[class*="bullet"], ' +
      'button[class*="dot"], ' +
      'button[class*="indicator"], ' +
      '.swiper-pagination-bullet, ' +
      '[class*="pagination"] button, ' +
      '[class*="controller__bar"], ' +
      '[role="tab"]:not([role="tablist"])'
    )).filter(function(b) {
      const cls = (b.className || '').toLowerCase();
      return !cls.includes('prev') && !cls.includes('next') && !cls.includes('arrow') && !cls.includes('nav');
    });

    // Previous and Next buttons (query ALL matching buttons so both desktop & mobile controls are wired)
    const prevBtns = Array.from(sectionScope.querySelectorAll(
      'button[class*="prev"], [class*="navigator__button--prev"], .swiper-button-prev, .slick-prev, [class*="arrow-prev"], [aria-label*="prev" i], [class*="indicator--prev"], [class*="indicator__arrow"][class*="prev"]'
    ));
    const nextBtns = Array.from(sectionScope.querySelectorAll(
      'button[class*="next"], [class*="navigator__button--next"], .swiper-button-next, .slick-next, [class*="arrow-next"], [aria-label*="next" i], [class*="indicator--next"], [class*="indicator__arrow"][class*="next"]'
    ));

    // Progress bar fill elements
    const progressFills = Array.from(sectionScope.querySelectorAll(
      '.progressbar-indicator__bar-fill, ' +
      '.swiper-pagination-progressbar-fill, ' +
      '[class*="progressbar__fill"], ' +
      '[class*="progress-bar__fill"], ' +
      '[class*="progress-fill"], ' +
      '[class*="bar-fill"]'
    ));

    // Inject SVG icons if arrows have no visible text or SVG
    prevBtns.forEach(function(btn) {
      if (!btn.querySelector('svg, img') && (btn.innerText || btn.textContent || '').trim() === '') {
        btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));"><polyline points="15 18 9 12 15 6"></polyline></svg>';
      }
    });
    nextBtns.forEach(function(btn) {
      if (!btn.querySelector('svg, img') && (btn.innerText || btn.textContent || '').trim() === '') {
        btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));"><polyline points="9 18 15 12 9 6"></polyline></svg>';
      }
    });

    let currentIndex = 0;
    let autoplayTimer = null;
    const pauseBtn = sectionScope.querySelector('.controller__icon-container, [class*="pause-btn"], [aria-label*="pause" i]');
    const hasAutoplay = !!pauseBtn || /hero|banner/i.test(sectionScope.className || '');
    let isPlaying = hasAutoplay;

    const container = transformTrack.parentElement || transformTrack;
    if (container) {
      container.classList.add('swiper-container-initialized', 'is-initialized');
    }

    function getSlideStep() {
      if (uniqueSlides.length > 1) {
        const s0 = uniqueSlides[0];
        const s1 = uniqueSlides[1];
        const step = s1.offsetLeft - s0.offsetLeft;
        if (step > 20) return step;
      }
      if (uniqueSlides.length > 0 && uniqueSlides[0].offsetWidth > 50) {
        return uniqueSlides[0].offsetWidth;
      }
      if (uniqueSlides.length > 0) {
        const styleW = parseFloat(uniqueSlides[0].style.width || '') || parseFloat(window.getComputedStyle(uniqueSlides[0]).width || '');
        if (styleW > 50) return styleW;
      }
      const cW = container.clientWidth || sectionScope.clientWidth || 1200;
      return cW / Math.min(uniqueSlides.length, 4);
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
      const containerWidth = container.clientWidth || sectionScope.clientWidth || window.innerWidth || 1200;
      const totalWidth = getTotalWidth();
      return Math.max(0, totalWidth - containerWidth);
    }

    function getMaxIndex() {
      if (uniqueSlides.length <= 1) return 0;
      const step = getSlideStep();
      const maxOffset = getMaxOffset();
      if (maxOffset <= 0) {
        return uniqueSlides.length - 1;
      }
      const steps = Math.ceil(maxOffset / step);
      return Math.max(1, Math.min(steps, uniqueSlides.length - 1));
    }

    const isBounded = prevBtns.some(function(b) {
      return b.hasAttribute('disabled') || b.classList.contains('disabled') || b.classList.contains('swiper-button-disabled');
    }) || !allSlides.some(function(s) {
      const c = (s.className || '').toLowerCase();
      return c.includes('duplicate') || c.includes('clone');
    });

    function goToSlide(targetIdx) {
      if (uniqueSlides.length === 0) return;
      const maxIdx = isBounded ? getMaxIndex() : (uniqueSlides.length - 1);
      const maxOffset = getMaxOffset();
      const step = getSlideStep();

      if (isBounded) {
        currentIndex = Math.max(0, Math.min(targetIdx, maxIdx));
      } else {
        currentIndex = (targetIdx + uniqueSlides.length) % uniqueSlides.length;
      }

      const targetSlide = uniqueSlides[currentIndex];
      let offset = (targetSlide && targetSlide.offsetLeft > 0)
        ? targetSlide.offsetLeft
        : currentIndex * step;

      if (isBounded && maxOffset > 0 && offset > maxOffset) {
        offset = maxOffset;
      }

      transformTrack.style.transition = 'transform 500ms cubic-bezier(0.25, 1, 0.5, 1)';
      transformTrack.style.transform = 'translate3d(' + (-offset) + 'px, 0px, 0px)';

      // Update indicator bars / bullets
      bars.forEach(function(b, idx) {
        const isActive = idx === currentIndex;
        b.classList.toggle('controller__bar--current', isActive);
        b.classList.toggle('swiper-pagination-bullet-active', isActive);
        b.classList.toggle('is-active', isActive);
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-selected', String(isActive));
        b.setAttribute('tabindex', isActive ? '0' : '-1');
      });

      // Update progress bar fill
      if (progressFills.length > 0) {
        const totalSteps = maxIdx > 0 ? (maxIdx + 1) : uniqueSlides.length;
        const ratio = totalSteps > 1 ? Math.min(1, Math.max(0.05, (currentIndex + 1) / totalSteps)) : 1;
        progressFills.forEach(function(fill) {
          fill.style.transition = 'transform 300ms cubic-bezier(0.25, 1, 0.5, 1), width 300ms cubic-bezier(0.25, 1, 0.5, 1)';
          fill.style.transform = 'translate3d(0px, 0px, 0px) scaleX(' + ratio + ') scaleY(1)';
          fill.style.transformOrigin = 'left center';
          fill.style.width = (ratio * 100) + '%';
        });
      }

      // Update aria-hidden and active classes on slides
      const containerWidth = container.clientWidth || sectionScope.clientWidth || window.innerWidth;
      allSlides.forEach(function(s) {
        const isActive = s === targetSlide;
        const sLeft = s.offsetLeft;
        const isVisible = (sLeft >= offset - 5) && (sLeft < offset + containerWidth - 5);
        s.classList.toggle('swiper-slide-active', isActive);
        s.classList.toggle('is-active', isActive);
        if ((s.className || '').includes('recommended-product-carousel__item')) {
          s.classList.add('co78-recommended-product-carousel--active');
        }
        s.setAttribute('aria-hidden', String(!isVisible));
      });

      // Update Prev / Next button states
      const isStart = currentIndex <= 0;
      const isEnd = isBounded && (currentIndex >= maxIdx || (maxOffset > 0 && offset >= maxOffset - 2));

      prevBtns.forEach(function(b) {
        if (isBounded) {
          b.disabled = isStart;
          if (isStart) {
            b.setAttribute('disabled', 'true');
            b.setAttribute('aria-disabled', 'true');
            b.classList.add('swiper-button-disabled', 'disabled');
          } else {
            b.removeAttribute('disabled');
            b.setAttribute('aria-disabled', 'false');
            b.classList.remove('swiper-button-disabled', 'disabled');
          }
        }
      });

      nextBtns.forEach(function(b) {
        if (isBounded) {
          b.disabled = isEnd;
          if (isEnd) {
            b.setAttribute('disabled', 'true');
            b.setAttribute('aria-disabled', 'true');
            b.classList.add('swiper-button-disabled', 'disabled');
          } else {
            b.removeAttribute('disabled');
            b.setAttribute('aria-disabled', 'false');
            b.classList.remove('swiper-button-disabled', 'disabled');
          }
        }
      });

      if (container) {
        container.classList.toggle('swiper-slide--beginning', isStart);
        container.classList.toggle('swiper-slide--end', isEnd);
      }
    }

    function resetAutoplay() {
      if (autoplayTimer) clearInterval(autoplayTimer);
      if (isPlaying && uniqueSlides.length > 1) {
        autoplayTimer = setInterval(function() {
          goToSlide(currentIndex + 1);
        }, 5000);
      }
    }

    // Initialize to slide 0
    goToSlide(0);
    resetAutoplay();

    // Bind bar / indicator clicks
    bars.forEach(function(bar, idx) {
      bar.addEventListener('click', function(e) {
        e.preventDefault();
        goToSlide(idx);
        resetAutoplay();
      });
    });

    // Bind navigation buttons
    prevBtns.forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        goToSlide(currentIndex - 1);
        resetAutoplay();
      });
    });

    nextBtns.forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        goToSlide(currentIndex + 1);
        resetAutoplay();
      });
    });

    // Pause on hover, resume on leave
    sectionScope.addEventListener('mouseenter', function() {
      if (autoplayTimer) clearInterval(autoplayTimer);
    });
    sectionScope.addEventListener('mouseleave', function() {
      resetAutoplay();
    });

    // Pause button toggle (e.g. controller icon)
    if (pauseBtn) {
      pauseBtn.addEventListener('click', function(e) {
        e.preventDefault();
        isPlaying = !isPlaying;
        const icon = pauseBtn.querySelector('i, svg');
        if (isPlaying) {
          resetAutoplay();
          if (icon) icon.className = icon.className.replace('play', 'pause');
        } else {
          if (autoplayTimer) clearInterval(autoplayTimer);
          if (icon) icon.className = icon.className.replace('pause', 'play');
        }
      });
    }

    // Touch swipe support
    let touchStartX = 0;
    sectionScope.addEventListener('touchstart', function(e) {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    sectionScope.addEventListener('touchend', function(e) {
      const touchEndX = e.changedTouches[0].screenX;
      if (touchStartX - touchEndX > 50) {
        goToSlide(currentIndex + 1);
        resetAutoplay();
      } else if (touchEndX - touchStartX > 50) {
        goToSlide(currentIndex - 1);
        resetAutoplay();
      }
    }, { passive: true });

    // Keyboard navigation
    sectionScope.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowRight') {
        goToSlide(currentIndex + 1);
        resetAutoplay();
      } else if (e.key === 'ArrowLeft') {
        goToSlide(currentIndex - 1);
        resetAutoplay();
      }
    });

    // Responsive window resize recalculation
    window.addEventListener('resize', function() {
      goToSlide(currentIndex);
    });
  } else {
    // 2. Detect Horizontal Scroll-Snap Carousels (e.g. Freeflow carousels, Card carousels, Product sliders)
    const scrollContainers = Array.from(sectionScope.querySelectorAll(
      '.tcl-freeflow-carousel, [class*="freeflow"], [class*="card_carousel"], [class*="scroll-snap"], [class*="slides-container"], [class*="carousel-track"]'
    )).concat(
      Array.from(sectionScope.querySelectorAll('div, section, ul')).filter(el => {
        const cs = window.getComputedStyle(el);
        const isScrollX = cs.overflowX === 'scroll' || cs.overflowX === 'auto';
        return isScrollX && el.scrollWidth > el.clientWidth;
      })
    );

    const scrollTrack = scrollContainers[0] || null;

    if (scrollTrack) {
      const slides = Array.from(scrollTrack.querySelectorAll(
        '.tcl-freeflow-carousel-container__slide-container, [class*="slide-container"], [class*="carousel-item"], [class*="card"], li'
      )).filter(s => s.parentElement === scrollTrack || s.parentElement?.parentElement === scrollTrack);

      const prevBtns = Array.from(sectionScope.querySelectorAll(
        '.tcl-carousel__nav--inline-start, button[class*="prev"], .carousel-arrow-prev, [class*="arrow-prev"], [aria-label*="prev" i], [class*="indicator--prev"], [class*="indicator__arrow"][class*="prev"]'
      ));
      const nextBtns = Array.from(sectionScope.querySelectorAll(
        '.tcl-carousel__nav--inline-end, button[class*="next"], .carousel-arrow-next, [class*="arrow-next"], [aria-label*="next" i], [class*="indicator--next"], [class*="indicator__arrow"][class*="next"]'
      ));

      function getSlideWidth() {
        if (slides.length > 0) {
          const r = slides[0].getBoundingClientRect();
          return r.width > 50 ? r.width + 16 : 400;
        }
        return scrollTrack.clientWidth * 0.85;
      }

      prevBtns.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          scrollTrack.scrollBy({ left: -getSlideWidth(), behavior: 'smooth' });
        });
      });

      nextBtns.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          scrollTrack.scrollBy({ left: getSlideWidth(), behavior: 'smooth' });
        });
      });
    }

    // 3. Stacked Carousel Slide Indicators & Controls
    const rawDots = Array.from(sectionScope.querySelectorAll(
      '.hero-dot, ' +
      'button[class*="bullet"], ' +
      'button[class*="dot"], ' +
      'button[class*="indicator"], ' +
      '.swiper-pagination-bullet'
    ));
    const dots = Array.from(new Set(rawDots)).filter(d => !d.classList.contains('carousel-arrow') && !d.matches('[class*="arrow"]'));

    const heroSlides = Array.from(sectionScope.querySelectorAll('.hero-slide'));
    const rawSlides = Array.from(sectionScope.querySelectorAll(
      '[class*="carousel-slide"], [class*="carousel__slide"], .slide'
    )).filter(el => !el.classList.contains('carousel') && !el.matches('[class*="track"]') && !el.matches('[class*="wrapper"]'));
    const slides = heroSlides.length > 0 ? heroSlides : rawSlides;

    function getActiveIndex() {
      for (let i = 0; i < dots.length; i++) {
        if (
          dots[i].getAttribute('aria-selected') === 'true' ||
          dots[i].classList.contains('is-active') ||
          dots[i].classList.contains('active')
        ) {
          return i;
        }
      }
      return 0;
    }

    function goToSlide(targetIdx) {
      if (dots.length === 0) return;
      const boundedIdx = (targetIdx + dots.length) % dots.length;
      dots.forEach((d, idx) => {
        const isActive = idx === boundedIdx;
        d.classList.toggle('is-active', isActive);
        d.classList.toggle('active', isActive);
        d.setAttribute('aria-selected', String(isActive));
        d.setAttribute('tabindex', isActive ? '0' : '-1');
      });

      if (slides.length > 0) {
        slides.forEach((s, idx) => {
          const isActive = idx === boundedIdx;
          s.classList.toggle('is-active', isActive);
          s.classList.toggle('active', isActive);
          s.setAttribute('aria-hidden', String(!isActive));
          if (s.classList.contains('hero-slide')) {
            s.style.opacity = isActive ? '1' : '0';
            s.style.visibility = isActive ? 'visible' : 'hidden';
            s.style.pointerEvents = isActive ? 'auto' : 'none';
            s.style.zIndex = isActive ? '2' : '1';
          } else if (slides.length > 1) {
            s.style.display = isActive ? '' : 'none';
          }
        });
      }
    }

    dots.forEach((dot, idx) => {
      dot.addEventListener('click', () => {
        goToSlide(idx);
      });
      dot.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          const nextIdx = (idx + 1) % dots.length;
          goToSlide(nextIdx);
          dots[nextIdx]?.focus();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          const prevIdx = (idx - 1 + dots.length) % dots.length;
          goToSlide(prevIdx);
          dots[prevIdx]?.focus();
        }
      });
    });

    // Prev / Next arrow controls for stacked slides
    const prevBtns = sectionScope.querySelectorAll(
      '.carousel-arrow-prev, ' +
      '[class*="prev"], ' +
      '[class*="arrow-left"], ' +
      '[aria-label*="previous" i]'
    );
    const nextBtns = sectionScope.querySelectorAll(
      '.carousel-arrow-next, ' +
      '[class*="next"], ' +
      '[class*="arrow-right"], ' +
      '[aria-label*="next" i]'
    );

    prevBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        if (scrollTrack) return; // handled by scroll-snap handler
        e.preventDefault();
        const current = getActiveIndex();
        goToSlide(current - 1);
      });
    });

    nextBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        if (scrollTrack) return; // handled by scroll-snap handler
        e.preventDefault();
        const current = getActiveIndex();
        goToSlide(current + 1);
      });
    });

    // Touch swipe support for carousel
    let touchStartX = 0;
    const sectionEl = document.getElementById('${ast.id}') || (sectionScope instanceof HTMLElement ? sectionScope : null);
    if (sectionEl && dots.length > 1) {
      sectionEl.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });

      sectionEl.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].screenX;
        const current = getActiveIndex();
        if (touchStartX - touchEndX > 50) {
          goToSlide(current + 1);
        } else if (touchEndX - touchStartX > 50) {
          goToSlide(current - 1);
        }
      }, { passive: true });
    }

    // Ensure initial slide matches active dot
    if (dots.length > 0) {
      goToSlide(getActiveIndex());
    }
  }
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

  const footerCategoryItems = Array.from(footerScope.querySelectorAll(
    '.footer-category, ' +
    '.footer-column__item, ' +
    '[class*="footer-col"], ' +
    '[class*="directory-column-section"], ' +
    '[class*="footer-nav__group"], ' +
    '[class*="footer-block"]'
  ));

  footerCategoryItems.forEach(function(item) {
    const trigger = item.querySelector(
      '.footer-category__anchor, ' +
      'a[class*="category__anchor"], ' +
      'button[class*="category__anchor"], ' +
      'button[class*="directory-column-section-title-button"], ' +
      '[class*="footer-accordion-btn"], ' +
      '[class*="accordion-toggle"], ' +
      'a[role="button"], ' +
      'button'
    ) || item.querySelector('h2, h3, h4, h5, [class*="title"], [class*="heading"]');

    const content = item.querySelector(
      '.footer-category__list-wrap, ' +
      '.footer-category__list, ' +
      '[class*="directory-column-section-list"], ' +
      '[class*="category__list"], ' +
      '[class*="footer-col__list"], ' +
      '[class*="content"], ' +
      'ul, ol, nav'
    );

    const title = item.querySelector(
      '.footer-category__title, ' +
      '[class*="category__title"], ' +
      'h2, h3, h4, h5, [class*="title"], [class*="heading"]'
    );

    if (trigger && content) {
      function toggleAccordion(e) {
        if (e) {
          const href = trigger.getAttribute('href');
          if (!href || href === '#' || href.startsWith('javascript:')) {
            e.preventDefault();
          }
        }

        const isCurrentlyOpen = trigger.classList.contains('footer-category__anchor--active') ||
          trigger.classList.contains('is-open') ||
          trigger.classList.contains('active') ||
          trigger.getAttribute('aria-expanded') === 'true' ||
          item.classList.contains('is-open') ||
          item.classList.contains('active') ||
          (content.style.display === 'block');

        if (isCurrentlyOpen) {
          trigger.classList.remove('footer-category__anchor--active', 'is-open', 'active', 'is-active');
          trigger.setAttribute('aria-expanded', 'false');
          item.classList.remove('is-open', 'active', 'is-active', 'expanded');
          content.classList.remove('is-open', 'active', 'is-active', 'open');
          if (content.style.display === 'block') {
            content.style.display = '';
          }
          const labelSpan = trigger.querySelector('[data-i18n-open], [data-i18n-close], .hidden');
          if (labelSpan) {
            labelSpan.textContent = labelSpan.getAttribute('data-i18n-open') || 'open';
          }
        } else {
          trigger.classList.add('footer-category__anchor--active', 'is-open', 'active', 'is-active');
          trigger.setAttribute('aria-expanded', 'true');
          item.classList.add('is-open', 'active', 'is-active', 'expanded');
          content.classList.add('is-open', 'active', 'is-active', 'open');
          const computed = window.getComputedStyle(content);
          if (computed.display === 'none') {
            content.style.display = 'block';
          }
          const labelSpan = trigger.querySelector('[data-i18n-open], [data-i18n-close], .hidden');
          if (labelSpan) {
            labelSpan.textContent = labelSpan.getAttribute('data-i18n-close') || 'Close';
          }
        }
      }

      trigger.addEventListener('click', toggleAccordion);

      if (title && title !== trigger) {
        title.style.cursor = 'pointer';
        title.addEventListener('click', function(e) {
          if (window.innerWidth < 768 || window.getComputedStyle(trigger).display !== 'none') {
            toggleAccordion(e);
          }
        });
      }
    }
  });

  window.addEventListener('resize', function() {
    if (window.innerWidth >= 768) {
      footerCategoryItems.forEach(function(item) {
        const content = item.querySelector('.footer-category__list-wrap, .footer-category__list, ul, nav');
        if (content && content.style.display === 'none') {
          content.style.display = '';
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
      Boolean(
        ast.rawSectionHtml &&
          (ast.rawSectionHtml.includes('input') ||
            ast.rawSectionHtml.includes('filter') ||
            ast.rawSectionHtml.includes('sort') ||
            ast.rawSectionHtml.includes('dropdown') ||
            ast.rawSectionHtml.includes('option'))
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
    if (sib && (
      sib.getAttribute('role') === 'menu' ||
      sib.getAttribute('role') === 'listbox' ||
      sib.getAttribute('role') === 'dialog' ||
      /(?:menu|option|dropdown|popover|content|panel|list)/i.test(sib.className || '')
    )) {
      return sib;
    }
    // Check inside immediate container
    const parentBox = trigger.closest('[class*="item"], [class*="container"], [class*="wrap"], [role="listitem"], li, div');
    if (parentBox) {
      const panel = Array.from(parentBox.querySelectorAll(
        '[role="menu"], [role="listbox"], [role="dialog"], [class*="menu"], [class*="option"], [class*="dropdown"], [class*="popover"], [class*="content"]'
      )).find(function(p) { return p !== trigger && !trigger.contains(p); });
      if (panel) return panel;
    }
    return null;
  }

  function setDropdownVisible(trigger, open) {
    if (!trigger) return;
    const panel = findControlledPanel(trigger);
    const parentBox = trigger.closest('[class*="item"], [class*="container"], [class*="wrap"], [role="listitem"], li, div');

    trigger.setAttribute('aria-expanded', String(open));
    if (parentBox) {
      parentBox.classList.toggle('is-open', open);
      parentBox.classList.toggle('open', open);
      Array.from(parentBox.classList).forEach(function(c) {
        if (!c.includes('--')) {
          parentBox.classList.toggle(c + '--open', open);
          parentBox.classList.toggle(c + '--show', open);
          parentBox.classList.toggle(c + '--active', open);
          parentBox.classList.toggle(c + '--open-pc', open);
          parentBox.classList.toggle(c + '--show-pc', open);
        }
      });
      if (open) {
        Array.from(parentBox.attributes).forEach(function(attr) {
          if (attr.name.startsWith('data-rep-removed-')) {
            const originalCls = attr.name.replace('data-rep-removed-', '');
            parentBox.classList.add(originalCls);
          }
        });
      }
    }
    if (panel) {
      if (open) {
        panel.classList.add('is-open', 'open', 'show', 'active');
        panel.style.removeProperty('display');
        panel.style.removeProperty('opacity');
        panel.style.removeProperty('visibility');
        panel.style.removeProperty('pointer-events');
        panel.style.removeProperty('transform');
        if (window.getComputedStyle(panel).display === 'none') {
          panel.style.setProperty('display', 'block', 'important');
        }
        if (window.getComputedStyle(panel).visibility === 'hidden') {
          panel.style.setProperty('visibility', 'visible', 'important');
        }
        if (window.getComputedStyle(panel).opacity === '0') {
          panel.style.setProperty('opacity', '1', 'important');
        }
        panel.style.setProperty('pointer-events', 'auto', 'important');
        panel.style.setProperty('z-index', '100', 'important');
      } else {
        panel.classList.remove('is-open', 'open', 'show', 'active');
        panel.style.setProperty('display', 'none', 'important');
        panel.style.setProperty('opacity', '0', 'important');
        panel.style.setProperty('visibility', 'hidden', 'important');
        panel.style.setProperty('pointer-events', 'none', 'important');
      }
    }
    const icon = trigger.querySelector('svg, .icon, [class*="icon"], [class*="chevron"], [class*="arrow"]');
    if (icon) {
      icon.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
    }
  }

  // 1. Identify all interactive popover/dropdown triggers
  const allDropdownTriggers = Array.from(scope.querySelectorAll(
    'button[aria-expanded], [role="button"][aria-expanded], button[aria-haspopup], [role="button"][aria-haspopup], [data-toggle="dropdown"], [data-bs-toggle="dropdown"], [data-dropdown], button[class*="dropdown-toggle"], [role="button"][class*="dropdown-toggle"], button[class*="opener"], [role="button"][class*="opener"]'
  )).filter(function(b) {
    if (b.hasAttribute('data-has-recorded-interaction')) return false;
    const cls = (b.className || '').toLowerCase();
    const lbl = (b.getAttribute('aria-label') || '').toLowerCase();
    const txt = (b.textContent || '').trim().toLowerCase();
    if (cls.includes('hamburger') || lbl.includes('navigation') || b.closest('nav, [role="navigation"]')) return false;
    if (txt === 'clear all' || txt === 'apply filters' || txt === 'apply sort' || txt === 'close' || txt === 'view more') return false;
    if (cls.includes('clear') || cls.includes('close') || cls.includes('apply') || cls.includes('view-more')) return false;
    return true;
  });

  // Normalize all dropdowns initially to closed
  allDropdownTriggers.forEach(function(b) {
    setDropdownVisible(b, false);
  });

  allDropdownTriggers.forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();

      const currentlyOpen = btn.getAttribute('aria-expanded') === 'true';

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

  // 2. Universal Option Swatches (Color Chips, Size Buttons, Radio Selectors)
  const optionGroups = Array.from(scope.querySelectorAll(
    '[role="radiogroup"], [class*="swatch"], [class*="option-selector"], [class*="color-list"], [class*="size-list"]'
  ));
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

  // 3. Universal Dynamic Filtering & Item Counter Engine
  const filterInputs = Array.from(scope.querySelectorAll(
    'input[type="checkbox"]'
  )).filter(function(inp) {
    const name = (inp.name || '').toLowerCase();
    const id = (inp.id || '').toLowerCase();
    const cls = (inp.className || '').toLowerCase();
    if (inp.closest('article, [class*="product-card"], [class*="card"]')) return false;
    return !name.includes('search') && !id.includes('search') && !cls.includes('compare');
  });

  const cardCandidates = Array.from(scope.querySelectorAll(
    'article, [role="listitem"], [class*="product-card"], [class*="product-item"], [class*="catalog-item"], [class*="grid-item"], [class*="result-card"], [class*="card"]'
  )).filter(function(el) {
    const tag = el.tagName.toLowerCase();
    if (tag !== 'div' && tag !== 'article' && tag !== 'li' && tag !== 'section') return false;
    const cls = (el.className || '').toLowerCase();
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
    const cls = (btn.className || '').toLowerCase();
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
      const cls = (b.className || '').toLowerCase();
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
            item.style.setProperty('visibility', 'visible', 'important');
            item.style.setProperty('opacity', '1', 'important');
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
            opt.style.setProperty('display', '', 'important');
            opt.removeAttribute('aria-hidden');
            opt.classList.remove('is-hidden', 'hidden');
          } else {
            opt.style.setProperty('display', 'none', 'important');
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

      path.style.setProperty('stroke-dasharray', totalLength, 'important');
      path.style.setProperty('stroke-dashoffset', totalLength, 'important');
      path.style.transition = 'none';
      path.getBoundingClientRect();

      path.style.transition = 'stroke-dashoffset ' + (duration / 1000) + 's cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.4s ease';
      path.style.setProperty('stroke-dashoffset', '0', 'important');
      path.style.setProperty('opacity', '1', 'important');
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

      observer.observe(root);
    } else {
      setTimeout(triggerEnterAnimations, 200);
    }

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

        maskVisual.style.setProperty('transform', 'translate3d(0px, ' + currentY.toFixed(2) + 'px, 0px) scale(' + currentScale.toFixed(4) + ')', 'important');

        // Hero face color reveals as specs touch down (progress 0.65 -> 0.95)
        // Silhouette remains visible underneath
        const faceAlpha = Math.min(1, Math.max(0, (progress - 0.65) / 0.30));
        targetHero.style.setProperty('opacity', faceAlpha.toFixed(2), 'important');

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
