import Module from '../__module';
import Block from '../block';
import SelectionUtils from '../selection';
import * as _ from '../utils';

/**
 *
 */
export default class CrossBlockSelection extends Module {
  /**
   * Block where selection is started
   */
  private firstSelectedBlock: Block;

  /**
   * Last selected Block
   */
  private lastSelectedBlock: Block;

  /**
   * Module preparation
   *
   * @returns {Promise}
   */
  public async prepare(): Promise<void> {
    const { Listeners } = this.Editor;

    Listeners.on(document, 'mousedown', (event: MouseEvent) => {
      this.enableCrossBlockSelection(event);
    });

    // prevent interfering with dragNDrop module
    Listeners.on(document, 'dragstart', (event: DragEvent) => {
      this.Editor.BlockSelection.clearSelection(event);
      Listeners.off(document, 'mouseover', this.onMouseOver);
      Listeners.off(document, 'mouseup', this.onMouseUp);
    });
  }

  /**
   * Sets up listeners
   *
   * @param {MouseEvent} event - mouse down event
   */
  public watchSelection(event: MouseEvent): void {
    if (event.button !== _.mouseButtons.LEFT) {
      return;
    }

    const { BlockManager, Listeners } = this.Editor;

    this.firstSelectedBlock = BlockManager.getBlock(event.target as HTMLElement);
    this.lastSelectedBlock = this.firstSelectedBlock;

    Listeners.on(document, 'mouseover', this.onMouseOver);
    Listeners.on(document, 'mouseup', this.onMouseUp);
  }

  /**
   * return boolean is cross block selection started
   */
  public get isCrossBlockSelectionStarted(): boolean {
    return !!this.firstSelectedBlock &&
      !!this.lastSelectedBlock;
  }

  /**
   * Change selection state of the next Block
   * Used for CBS via Shift + arrow keys
   *
   * @param {boolean} next - if true, toggle next block. Previous otherwise
   */
  public toggleBlockSelectedState(next = true): void {
    const { BlockManager, BlockSelection } = this.Editor;
    let isInitialSelection = false;

    if (!this.lastSelectedBlock) {
      this.lastSelectedBlock = this.firstSelectedBlock = BlockManager.currentBlock;
      isInitialSelection = true;
    }

    if (this.firstSelectedBlock === this.lastSelectedBlock) {
      this.firstSelectedBlock.selected = true;

      BlockSelection.clearCache();
      SelectionUtils.get().removeAllRanges();

      // first cross-block selection via arrow keys should only select currentBlock
      if (isInitialSelection) return;
    }

    const nextBlockIndex = BlockManager.blocks.indexOf(this.lastSelectedBlock) + (next ? 1 : -1);
    const nextBlock = BlockManager.blocks[nextBlockIndex];

    if (!nextBlock) {
      return;
    }

    if (this.lastSelectedBlock.selected !== nextBlock.selected) {
      nextBlock.selected = true;

      BlockSelection.clearCache();
    } else {
      this.lastSelectedBlock.selected = false;

      BlockSelection.clearCache();
    }

    this.lastSelectedBlock = nextBlock;

    /** close InlineToolbar when Blocks selected */
    this.Editor.InlineToolbar.close();

    nextBlock.holder.scrollIntoView({
      block: 'nearest',
    });
  }

  /**
   * Clear saved state
   *
   * @param {Event} reason - event caused clear of selection
   */
  public clear(reason?: Event): void {
    const { BlockManager, BlockSelection, Caret } = this.Editor;
    const fIndex = BlockManager.blocks.indexOf(this.firstSelectedBlock);
    const lIndex = BlockManager.blocks.indexOf(this.lastSelectedBlock);

    if (BlockSelection.anyBlockSelected && fIndex > -1 && lIndex > -1) {
      if (reason && reason instanceof KeyboardEvent) {
        /**
         * Set caret depending on pressed key if pressed key is an arrow.
         */
        switch (reason.keyCode) {
          case _.keyCodes.DOWN:
          case _.keyCodes.RIGHT:
            Caret.setToBlock(BlockManager.blocks[Math.max(fIndex, lIndex)], Caret.positions.END);
            break;

          case _.keyCodes.UP:
          case _.keyCodes.LEFT:
            Caret.setToBlock(BlockManager.blocks[Math.min(fIndex, lIndex)], Caret.positions.START);
            break;
          default:
            Caret.setToBlock(BlockManager.blocks[Math.max(fIndex, lIndex)], Caret.positions.END);
        }
      } else {
        /**
         * By default set caret at the end of the last selected block
         */
        Caret.setToBlock(BlockManager.blocks[Math.max(fIndex, lIndex)], Caret.positions.END);
      }
    }

    this.firstSelectedBlock = this.lastSelectedBlock = null;
  }

  /**
   * Enables Cross Block Selection
   *
   * @param {MouseEvent} event - mouse down event
   */
  private enableCrossBlockSelection(event: MouseEvent): void {
    const { UI } = this.Editor;

    /**
     * Each mouse down on must disable selectAll state
     */
    if (!SelectionUtils.isCollapsed) {
      this.Editor.BlockSelection.clearSelection(event);
    }

    /**
     * If mouse down is performed inside the editor, we should watch CBS
     */
    if (UI.nodes.redactor.contains(event.target as Node)) {
      this.watchSelection(event);
    } else {
      /**
       * Otherwise, clear selection
       */
      this.Editor.BlockSelection.clearSelection(event);
    }
  }

  /**
   * Mouse up event handler.
   * Removes the listeners
   */
  private onMouseUp = (): void => {
    const { Listeners } = this.Editor;

    Listeners.off(document, 'mouseover', this.onMouseOver);
    Listeners.off(document, 'mouseup', this.onMouseUp);
  }

  /**
   * Mouse over event handler
   * Gets target and related blocks and change selected state for blocks in between
   *
   * @param {MouseEvent} event - mouse over event
   */
  private onMouseOver = (event: MouseEvent): void => {
    const { BlockManager, BlockSelection } = this.Editor;

    const relatedBlock = BlockManager.getBlockByChildNode(event.relatedTarget as Node) || this.lastSelectedBlock;
    const targetBlock = BlockManager.getBlockByChildNode(event.target as Node);

    if (!relatedBlock || !targetBlock) {
      return;
    }

    if (targetBlock === relatedBlock) {
      return;
    }

    if (relatedBlock === this.firstSelectedBlock) {
      SelectionUtils.get().removeAllRanges();

      this.toggleBlocksSelectedState(relatedBlock, targetBlock, true);

      BlockSelection.clearCache();

      return;
    }

    /**
     * Ideally we'd maintain the original block as selected when passing over it, but in order
     * to maintain consistency with the original state when starting a selection, we mark the original
     * block to unselected when crossing over it.
     */
    if (targetBlock === this.firstSelectedBlock) {
      this.toggleBlocksSelectedState(relatedBlock, targetBlock, false);
      this.lastSelectedBlock = targetBlock;

      BlockSelection.clearCache();

      return;
    }

    this.Editor.InlineToolbar.close();

    this.toggleBlocksSelectedState(relatedBlock, targetBlock);
    this.lastSelectedBlock = targetBlock;
  }

  /**
   * Change blocks selection state between passed two blocks.
   *
   * @param {Block} firstBlock - first block in range
   * @param {Block} lastBlock - last block in range
   * @param {boolean} forceState - whether all blocks in the range should be forced to true/false
   */
  private toggleBlocksSelectedState(firstBlock: Block, lastBlock: Block, forceState?: boolean): void {
    const { BlockManager, BlockSelection } = this.Editor;
    const fIndex = BlockManager.blocks.indexOf(firstBlock);
    const lIndex = BlockManager.blocks.indexOf(lastBlock);

    /**
     * If first and last block have the different selection state AND
     * all blocks in between have the same selected state as the last block,
     * it means we should't toggle selection of the first selected block.
     *
     * If first and last block have the same selection state we
     * shouldn't toggle the last selected block.
     */
    const mixedSelection = ((): boolean => {
      for (let i = Math.min(fIndex, lIndex); i <= Math.max(fIndex, lIndex); i++) {
        if (firstBlock !== BlockManager.blocks[i] && lastBlock !== BlockManager.blocks[i] && lastBlock.selected !== BlockManager.blocks[i].selected) {
          return true;
        }
      }

      return false;
    })();

    const shouldntSelectFirstBlock = firstBlock.selected !== lastBlock.selected && !mixedSelection;
    const shouldntSelectLastBlock = firstBlock.selected === lastBlock.selected;

    for (let i = Math.min(fIndex, lIndex); i <= Math.max(fIndex, lIndex); i++) {
      const block = BlockManager.blocks[i];

      if (forceState !== undefined) {
        BlockManager.blocks[i].selected = forceState;

        BlockSelection.clearCache();
      } else if (block !== this.firstSelectedBlock &&
          (!shouldntSelectFirstBlock || block !== firstBlock) &&
          (!shouldntSelectLastBlock || block !== lastBlock)) {
        BlockManager.blocks[i].selected = !BlockManager.blocks[i].selected;

        BlockSelection.clearCache();
      }
    }
  }
}
