if (typeof ot === 'undefined') {
  // Export for browsers
  var ot = {};
}

ot.UndoManager = ((() => {
  const NORMAL_STATE = 'normal';
  const UNDOING_STATE = 'undoing';
  const REDOING_STATE = 'redoing';

  // Create a new UndoManager with an optional maximum history size.
  class UndoManager {
    constructor (maxItems) {
      this.maxItems = maxItems || 50;
      this.state = NORMAL_STATE;
      this.dontCompose = false;
      this.undoStack = [];
      this.redoStack = [];
    }

    // Add an operation to the undo or redo stack, depending on the current state
    // of the UndoManager. The operation added must be the inverse of the last
    // edit. When `compose` is true, compose the operation with the last operation
    // unless the last operation was alread pushed on the redo stack or was hidden
    // by a newer operation on the undo stack.
    add (operation, compose) {
      if (this.state === UNDOING_STATE) {
        this.redoStack.push(operation);
        this.dontCompose = true;
      } else if (this.state === REDOING_STATE) {
        this.undoStack.push(operation);
        this.dontCompose = true;
      } else {
        const undoStack = this.undoStack;
        if (!this.dontCompose && compose && undoStack.length > 0) {
          undoStack.push(operation.compose(undoStack.pop()));
        } else {
          undoStack.push(operation);
          if (undoStack.length > this.maxItems) {
            undoStack.shift();
          }
        }
        this.dontCompose = false;
        this.redoStack = [];
      }
    }

    // Transform the undo and redo stacks against a operation by another client.
    transform (operation) {
      this.undoStack = transformStack(this.undoStack, operation);
      this.redoStack = transformStack(this.redoStack, operation);
    }

    // Perform an undo by calling a function with the latest operation on the undo
    // stack. The function is expected to call the `add` method with the inverse
    // of the operation, which pushes the inverse on the redo stack.
    performUndo (fn) {
      this.state = UNDOING_STATE;
      if (this.undoStack.length === 0) {
        throw new Error("undo not possible");
      }
      fn(this.undoStack.pop());
      this.state = NORMAL_STATE;
    }

    // The inverse of `performUndo`.
    performRedo (fn) {
      this.state = REDOING_STATE;
      if (this.redoStack.length === 0) {
        throw new Error("redo not possible");
      }
      fn(this.redoStack.pop());
      this.state = NORMAL_STATE;
    }

    // Is the undo stack not empty?
    canUndo () {
      return this.undoStack.length !== 0;
    }

    // Is the redo stack not empty?
    canRedo () {
      return this.redoStack.length !== 0;
    }

    // Whether the UndoManager is currently performing an undo.
    isUndoing () {
      return this.state === UNDOING_STATE;
    }

    // Whether the UndoManager is currently performing a redo.
    isRedoing () {
      return this.state === REDOING_STATE;
    }
  }

  function transformStack (stack, operation) {
    const newStack = [];
    const Operation = operation.constructor;
    for (let i = stack.length - 1; i >= 0; i--) {
      const pair = Operation.transform(stack[i], operation);
      if (typeof pair[0].isNoop !== 'function' || !pair[0].isNoop()) {
        newStack.push(pair[0]);
      }
      operation = pair[1];
    }
    return newStack.reverse();
  }

  return UndoManager;
})());

// Export for CommonJS
if (typeof module === 'object') {
  module.exports = ot.UndoManager;
}
