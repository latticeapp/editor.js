import SelectionUtils from '../selection';

import $ from '../dom';
import * as _ from '../utils';
import { API, InlineTool, SanitizerConfig } from '../../../types';
import { Notifier, Toolbar, I18n } from '../../../types/api';

/**
 * Link Tool
 *
 * Inline Toolbar Tool
 *
 * Wrap selected text with <a> tag
 */
export default class TagInlineTool implements InlineTool {
  /**
   * Specifies Tool as Inline Toolbar Tool
   *
   * @returns {boolean}
   */
  public static isInline = true;

  /**
   * Title for hover-tooltip
   */
  public static title = 'Tag';

  /**
   * Sanitizer Rule
   * Leave <a> tags
   *
   * @returns {object}
   */
  public static get sanitize(): SanitizerConfig {
    return {
      a: {
        href: true,
        target: '_blank',
        rel: 'nofollow',
      },
    } as SanitizerConfig;
  }

  /**
   * Native Document's commands for link/unlink
   */
  private readonly commandTag: string = 'createLink';
  private readonly commandUntag: string = 'unlink';

  /**
   * Enter key code
   */
  private readonly ENTER_KEY: number = 13;

  /**
   * Styles
   */
  private readonly CSS = {
    button: 'ce-inline-tool',
    buttonActive: 'ce-inline-tool--active',
    buttonModifier: 'ce-inline-tool--tag',
    buttonUnlink: 'ce-inline-tool--untag',
    input: 'ce-inline-tool-input',
    inputShowed: 'ce-inline-tool-input--showed',
  };

  /**
   * Elements
   */
  private nodes: {
    button: HTMLButtonElement;
    input: HTMLInputElement;
  } = {
    button: null,
    input: null,
  };

  /**
   * SelectionUtils instance
   */
  private selection: SelectionUtils;

  /**
   * Input opening state
   */
  private inputOpened = false;

  /**
   * Available Toolbar methods (open/close)
   */
  private toolbar: Toolbar;

  /**
   * Available inline toolbar methods (open/close)
   */
  private inlineToolbar: Toolbar;

  /**
   * Notifier API methods
   */
  private notifier: Notifier;

  /**
   * I18n API
   */
  private i18n: I18n;

  /**
   * @param {API} api - Editor.js API
   */
  constructor({ api }) {
    this.toolbar = api.toolbar;
    this.inlineToolbar = api.inlineToolbar;
    this.notifier = api.notifier;
    this.i18n = api.i18n;
    this.selection = new SelectionUtils();
  }

  /**
   * Create button for Inline Toolbar
   */
  public render(): HTMLElement {
    this.nodes.button = document.createElement('button') as HTMLButtonElement;
    this.nodes.button.type = 'button';
    this.nodes.button.classList.add(this.CSS.button, this.CSS.buttonModifier);
    this.nodes.button.appendChild($.svg('tag', 14, 10));
    this.nodes.button.appendChild($.svg('untag', 15, 11));

    return this.nodes.button;
  }

  /**
   * Input for the tag
   */
  public renderActions(): HTMLElement {
    this.nodes.input = document.createElement('input') as HTMLInputElement;
    this.nodes.input.placeholder = this.i18n.t('Add a tag');
    this.nodes.input.classList.add(this.CSS.input);
    this.nodes.input.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.keyCode === this.ENTER_KEY) {
        this.enterPressed(event);
      }
    });

    return this.nodes.input;
  }

  /**
   * Handle clicks on the Inline Toolbar icon
   *
   * @param {Range} range - range to wrap with link
   */
  public surround(range: Range): void {
    /**
     * Range will be null when user makes second click on the 'tag icon' to close opened input
     */
    if (range) {
      /**
       * Save selection before change focus to the input
       */
      if (!this.inputOpened) {
        /** Create blue background instead of selection */
        this.selection.setFakeBackground();
        this.selection.save();
      } else {
        this.selection.restore();
        this.selection.removeFakeBackground();
      }
      const parentAnchor = this.selection.findParentTag('A');

      /**
       * Untag icon pressed
       */
      if (parentAnchor) {
        this.selection.expandToTag(parentAnchor);
        this.untag();
        this.closeActions();
        this.checkState();
        this.toolbar.close();

        return;
      }
    }

    this.toggleActions();
  }

  /**
   * Check selection and set activated state to button if there are <a> tag
   *
   * @param {Selection} selection - selection to check
   */
  public checkState(selection?: Selection): boolean {
    const anchorTag = this.selection.findParentTag('A');

    if (anchorTag) {
      this.nodes.button.classList.add(this.CSS.buttonUnlink);
      this.nodes.button.classList.add(this.CSS.buttonActive);
      this.openActions();

      /**
       * Fill input value with link href
       */
      const hrefAttr = anchorTag.getAttribute('href');

      this.nodes.input.value = hrefAttr !== 'null' ? hrefAttr : '';

      this.selection.save();
    } else {
      this.nodes.button.classList.remove(this.CSS.buttonUnlink);
      this.nodes.button.classList.remove(this.CSS.buttonActive);
    }

    return !!anchorTag;
  }

  /**
   * Function called with Inline Toolbar closing
   */
  public clear(): void {
    this.closeActions();
  }

  /**
   * Set a shortcut
   */
  public get shortcut(): string {
    return 'CMD+T';
  }

  /**
   * Show/close link input
   */
  private toggleActions(): void {
    if (!this.inputOpened) {
      this.openActions(true);
    } else {
      this.closeActions(false);
    }
  }

  /**
   * @param {boolean} needFocus - on link creation we need to focus input. On editing - nope.
   */
  private openActions(needFocus = false): void {
    this.nodes.input.classList.add(this.CSS.inputShowed);
    if (needFocus) {
      this.nodes.input.focus();
    }
    this.inputOpened = true;
  }

  /**
   * Close input
   *
   * @param {boolean} clearSavedSelection — we don't need to clear saved selection
   *                                        on toggle-clicks on the icon of opened Toolbar
   */
  private closeActions(clearSavedSelection = true): void {
    if (this.selection.isFakeBackgroundEnabled) {
      // if actions is broken by other selection We need to save new selection
      const currentSelection = new SelectionUtils();

      currentSelection.save();

      this.selection.restore();
      this.selection.removeFakeBackground();

      // and recover new selection after removing fake background
      currentSelection.restore();
    }

    this.nodes.input.classList.remove(this.CSS.inputShowed);
    this.nodes.input.value = '';
    if (clearSavedSelection) {
      this.selection.clearSaved();
    }
    this.inputOpened = false;
  }

  /**
   * Enter pressed on input
   *
   * @param {KeyboardEvent} event - enter keydown event
   */
  private enterPressed(event: KeyboardEvent): void {
    let value = this.nodes.input.value || '';

    if (!value.trim()) {
      this.selection.restore();
      this.untag();
      event.preventDefault();
      this.closeActions();

      return;
    }

    if (!this.validateTag(value)) {
      this.notifier.show({
        message: 'Tag is not valid.',
        style: 'error',
      });

      _.log('Incorrect Tag', 'warn', value);

      return;
    }

    value = this.prepareTag(value);

    this.selection.restore();
    this.selection.removeFakeBackground();

    this.insertTag(value);

    /**
     * Preventing events that will be able to happen
     */
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    this.selection.collapseToEnd();
    this.inlineToolbar.close();
  }

  /**
   * Detects if passed string is a valid tag
   *
   * @param {string} str - string to validate
   * @returns {boolean}
   */
  private validateTag(str: string): boolean {
    /**
     * Only allow alphanumeric and whitespace
     */
    return /[a-zA-Z0-9\s]+/.test(str);
  }

  /**
   * Process tag before injection
   * - sanitize
   * - add brackets to tags
   *
   * @param {string} tag - raw user input
   */
  private prepareTag(tag: string): string {
    tag = tag.trim();
    tag = this.addBrackets(tag);

    return tag;
  }

  /**
   * Add brackets to the tag like '[[i am a tag]]'
   *
   * @param {string} tag - string to process
   */
  private addBrackets(tag: string): string {
    /**
     * If brackets already exist, do nothing
     */
    if (/^\[\[[a-zA-Z0-9\s]+\]\]/.test(tag)) {
      return tag;
    }

    return `[[${tag}]]`;
  }

  /**
   * Remove brackets from the tag like '[[i am a tag]]'
   *
   * @param {string} tag - string to process
   */
  private removeBrackets(tag: string): string {
    /**
     * If no brackets found, do nothing
     */
    if (!/^\[\[[a-zA-Z0-9\s]+\]\]/.test(tag)) {
      return tag;
    }

    return tag.slice(2, tag.length - 2);
  }

  /**
   * Inserts <a> tag with "href"
   *
   * @param {string} tag - "href" value
   */
  private insertTag(tag: string): void {
    /**
     * Edit all tag, not selected part
     */
    const anchorTag = this.selection.findParentTag('A');

    if (anchorTag) {
      this.selection.expandToTag(anchorTag);
    }

    // TODO: make tag point to the correct url here for the tag's page
    const tagLink = `/tags/${this.removeBrackets(tag)}`;
    document.execCommand(this.commandTag, false, tagLink);
  }

  /**
   * Removes <a> tag
   */
  private untag(): void {
    document.execCommand(this.commandUntag);
  }
}
